import Foundation
import NitroModules

/// How often batched log callbacks are delivered; shared by every session and
/// read once when a session starts.
private final class LogSettings {
  static let shared = LogSettings()

  private let lock = NSLock()
  private var interval: TimeInterval = 0.1

  var batchInterval: TimeInterval {
    get {
      lock.lock()
      defer { lock.unlock() }
      return interval
    }
    set {
      lock.lock()
      interval = newValue
      lock.unlock()
    }
  }
}

/// Batched log deliveries. Serial, so the timer flush and the final flush of a
/// session can never hand its chunks over out of order.
private let logQueue = DispatchQueue(label: "com.munimtech.ffmpeg.logs", qos: .utility)

/// Per-run callback target, handed to the core as the context pointer. The
/// core only routes callbacks to whichever session actually holds its
/// execution lock, so concurrently submitted sessions never see each other's
/// logs.
private final class Session {
  let onLog: ((String) -> Void)?
  let onStatistics: ((Double, Double, Double, Double, Double, Double, Double) -> Void)?
  private let batchInterval: TimeInterval
  private var buffer = ""
  /// Logged but not yet handed to `onLog`.
  private var pending = ""
  private var flushScheduled = false
  // FFmpeg logs from several of its own threads at once, so the buffers need
  // the lock even though each session belongs to a single execution.
  private let lock = NSLock()

  init(
    onLog: ((String) -> Void)?,
    onStatistics: ((Double, Double, Double, Double, Double, Double, Double) -> Void)? = nil,
    batchInterval: TimeInterval = LogSettings.shared.batchInterval
  ) {
    self.onLog = onLog
    self.onStatistics = onStatistics
    self.batchInterval = batchInterval
  }

  /// Every message FFmpeg logs. Each `onLog` call is a hop onto the JS thread,
  /// so with a batch interval the messages are collected here and delivered
  /// together at most once per interval instead of one call per line.
  func append(_ text: String) {
    lock.lock()
    buffer += text
    guard let onLog else {
      lock.unlock()
      return
    }
    if batchInterval <= 0 {
      lock.unlock()
      onLog(text)
      return
    }
    pending += text
    let schedule = !flushScheduled
    flushScheduled = true
    lock.unlock()

    if schedule {
      logQueue.asyncAfter(deadline: .now() + batchInterval) { self.deliver() }
    }
  }

  /// Delivers whatever is still pending. Called when the run ends, before its
  /// promise settles, so every log line arrives ahead of the result.
  func flush() {
    guard onLog != nil, batchInterval > 0 else { return }
    logQueue.sync { deliver() }
  }

  /// Runs on `logQueue` only.
  private func deliver() {
    lock.lock()
    let chunk = pending
    pending = ""
    flushScheduled = false
    lock.unlock()
    if !chunk.isEmpty { onLog?(chunk) }
  }

  var output: String {
    lock.lock()
    defer { lock.unlock() }
    return buffer
  }
}

private let installCallbacks: Void = munim_ffmpeg_set_callbacks({ context, message in
  guard let context, let message else { return }
  let session = Unmanaged<Session>.fromOpaque(context).takeUnretainedValue()
  let text = String(cString: message)
  session.append(text)
}, { context, timeMs, sizeBytes, bitrate, speed, frame, fps, quality in
  guard let context else { return }
  let session = Unmanaged<Session>.fromOpaque(context).takeUnretainedValue()
  session.onStatistics?(timeMs, sizeBytes, bitrate, speed, frame, fps, quality)
}, nil)

/// FFmpeg registers Apple's supplemental AV1 and VP9 decoders only on macOS.
/// iOS 26.2 added the same VideoToolbox call, so it is made here once before
/// the first run, letting `-hwaccel videotoolbox` reach those decoders. It is
/// looked up at runtime because SDKs before iOS 26.2 do not declare it for iOS;
/// on older systems, or if the symbol is missing, this does nothing.
private let registerSupplementalDecoders: Void = {
  guard #available(iOS 26.2, *) else { return }
  // RTLD_DEFAULT is a C macro Swift cannot import: ((void *)-2) on Darwin.
  guard
    let symbol = dlsym(
      UnsafeMutableRawPointer(bitPattern: -2),
      "VTRegisterSupplementalVideoDecoderIfAvailable"
    )
  else { return }
  typealias Register = @convention(c) (UInt32) -> Void
  let register = unsafeBitCast(symbol, to: Register.self)
  // kCMVideoCodecType_AV1 ('av01') and kCMVideoCodecType_VP9 ('vp09').
  for codec: UInt32 in [0x6176_3031, 0x7670_3039] {
    register(codec)
  }
}()

/// What the module remembers about each session id. Whether an unfinished
/// session is queued, running or paused is asked of the scheduler and the C
/// core, which are the only places that know.
private final class SessionRegistry {
  enum Kind { case execute, probe }

  private var kinds: [Double: Kind] = [:]
  private var finished: [Double: FFmpegSessionState] = [:]
  private var finishedOrder: [Double] = []
  private let lock = NSLock()
  /// Finished sessions are forgotten, oldest first, beyond this many.
  private let finishedLimit = 512

  func register(_ sessionId: Double, _ kind: Kind) {
    lock.lock()
    kinds[sessionId] = kind
    lock.unlock()
  }

  func finish(_ sessionId: Double, returnCode: Int32) {
    let state: FFmpegSessionState =
      returnCode == Int32(MUNIM_FFMPEG_CANCELLED) ? .cancelled
      : returnCode == 0 ? .completed
      : .failed
    lock.lock()
    kinds[sessionId] = nil
    finished[sessionId] = state
    finishedOrder.append(sessionId)
    if finishedOrder.count > finishedLimit {
      finished[finishedOrder.removeFirst()] = nil
    }
    lock.unlock()
  }

  /// nil once finished or never issued.
  func activeKind(_ sessionId: Double) -> Kind? {
    lock.lock()
    defer { lock.unlock() }
    return kinds[sessionId]
  }

  func finishedState(_ sessionId: Double) -> FFmpegSessionState? {
    lock.lock()
    defer { lock.unlock() }
    return finished[sessionId]
  }
}

/// Runs sessions one at a time, in order. fftools keeps its state in globals,
/// so the C core can only run one execution at a time anyway; queueing here
/// rather than inside the core means a queued session holds no thread, and can
/// be cancelled on its own without touching the one that is running.
private final class SessionScheduler {
  struct Job {
    let id: Double
    /// Runs the session to completion and settles its promise.
    let run: () -> Void
    /// Settles the promise of a session that was cancelled before it started.
    let drop: () -> Void
  }

  private let lock = NSLock()
  private var queue: [Job] = []
  private var running: Job?
  /// Whether the running job has gone into the C core yet.
  private var entered = false
  /// Set when the running job is cancelled before it reached the core.
  private var cancelledBeforeStart = false
  private let executionQueue = DispatchQueue(label: "com.munimtech.ffmpeg", qos: .userInitiated)
  private let verifyQueue = DispatchQueue(label: "com.munimtech.ffmpeg.cancel", qos: .userInitiated)

  func submit(_ job: Job) {
    lock.lock()
    if running == nil {
      start(job)
    } else {
      queue.append(job)
    }
    lock.unlock()
  }

  /// Callers hold `lock`.
  private func start(_ job: Job) {
    running = job
    entered = false
    cancelledBeforeStart = false
    executionQueue.async { self.execute(job) }
  }

  private func execute(_ job: Job) {
    lock.lock()
    let cancelled = cancelledBeforeStart
    entered = !cancelled
    lock.unlock()

    if cancelled { job.drop() } else { job.run() }

    lock.lock()
    running = nil
    if !queue.isEmpty { start(queue.removeFirst()) }
    lock.unlock()
  }

  func isRunning(_ id: Double) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return running?.id == id
  }

  /// Cancels one session: a queued one is dropped, the running one stopped.
  func cancel(_ id: Double) {
    lock.lock()
    if let index = queue.firstIndex(where: { $0.id == id }) {
      let job = queue.remove(at: index)
      lock.unlock()
      _ = munim_ffmpeg_resume(Int64(id))
      job.drop()
      return
    }
    if running?.id == id { stopRunning() }
    lock.unlock()
  }

  func cancelAll() {
    lock.lock()
    let dropped = queue
    queue.removeAll()
    if running != nil { stopRunning() }
    lock.unlock()
    for job in dropped {
      _ = munim_ffmpeg_resume(Int64(job.id))
      job.drop()
    }
  }

  /// Callers hold `lock`, so no queued job can start until this returns.
  private func stopRunning() {
    guard let job = running else { return }
    guard entered else {
      cancelledBeforeStart = true
      return
    }
    // Cancelling the core clears every pause; sessions still waiting here
    // keep theirs.
    let paused = queue.map(\.id).filter { munim_ffmpeg_is_paused(Int64($0)) != 0 }
    munim_ffmpeg_cancel()
    for id in paused { _ = munim_ffmpeg_pause(Int64(id)) }

    // The job may be between entering the core and the core reading its
    // cancel counter, in which case it would start regardless. Once the core
    // reports it running, cancel again; if it already stopped, nothing to do.
    if munim_ffmpeg_running_session() != Int64(job.id) {
      verifyQueue.async { self.cancelOnceRunning(job.id) }
    }
  }

  private func cancelOnceRunning(_ id: Double) {
    for _ in 0..<2000 {
      guard isRunning(id) else { return }
      if munim_ffmpeg_running_session() == Int64(id) {
        lock.lock()
        if running?.id == id {
          let paused = queue.map(\.id).filter { munim_ffmpeg_is_paused(Int64($0)) != 0 }
          munim_ffmpeg_cancel()
          for queued in paused { _ = munim_ffmpeg_pause(Int64(queued)) }
        }
        lock.unlock()
        return
      }
      usleep(500)
    }
  }
}

final class HybridMunimFfmpeg: HybridMunimFfmpegSpec {
  private var sessionCounter: Double = 0
  /// Ids for internal runs (getMediaInformation) count down from -1, so they
  /// can never collide with, or be cancelled as, a caller's session.
  private var internalCounter: Double = 0
  private let registry = SessionRegistry()
  private let scheduler = SessionScheduler()

  var ffmpegVersion: String {
    String(cString: munim_ffmpeg_version())
  }

  private func nextSession() -> Double {
    sessionCounter += 1
    return sessionCounter
  }

  private static func temporaryFile() -> String {
    FileManager.default.temporaryDirectory
      .appendingPathComponent("munim-ffmpeg-\(UUID().uuidString)")
      .path
  }

  private static func result(
    sessionId: Double,
    returnCode: Int32,
    output: String,
    startedAt: Date
  ) -> FFmpegSessionResult {
    FFmpegSessionResult(
      sessionId: sessionId,
      returnCode: Double(returnCode),
      success: returnCode == 0,
      cancelled: returnCode == Int32(MUNIM_FFMPEG_CANCELLED),
      state: "completed",
      durationMs: Date().timeIntervalSince(startedAt) * 1000,
      output: output,
      failStackTrace: nil
    )
  }

  func execute(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onStatistics: ((_ timeMs: Double, _ sizeBytes: Double, _ bitrateKbits: Double, _ speed: Double, _ videoFrameNumber: Double, _ fps: Double, _ quality: Double) -> Void)?,
    onSessionCreated: ((_ sessionId: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()
    let sessionId = nextSession()
    let startedAt = Date()
    registry.register(sessionId, .execute)
    onSessionCreated?(sessionId)

    scheduler.submit(SessionScheduler.Job(
      id: sessionId,
      run: { [registry] in
        // ffmpeg prints reports such as -encoders to stdout rather than through
        // its logger, so it is captured to a file and appended to the output.
        let printedPath = Self.temporaryFile()

        _ = installCallbacks
        _ = registerSupplementalDecoders
        let session = Session(onLog: onLog, onStatistics: onStatistics)

        let returnCode = withExtendedLifetime(session) {
          withArrayOfCStrings(arguments_) { argv in
            munim_ffmpeg_execute_session(
              Int32(arguments_.count),
              argv,
              printedPath,
              Unmanaged.passUnretained(session).toOpaque(),
              Int64(sessionId)
            )
          }
        }
        // A pause that raced the end of the run would otherwise stay listed.
        _ = munim_ffmpeg_resume(Int64(sessionId))
        session.flush()
        registry.finish(sessionId, returnCode: returnCode)

        let printed = (try? String(contentsOfFile: printedPath, encoding: .utf8)) ?? ""
        try? FileManager.default.removeItem(atPath: printedPath)

        promise.resolve(
          withResult: Self.result(
            sessionId: sessionId,
            returnCode: returnCode,
            output: session.output + printed,
            startedAt: startedAt
          )
        )
      },
      drop: { [registry] in
        registry.finish(sessionId, returnCode: Int32(MUNIM_FFMPEG_CANCELLED))
        promise.resolve(
          withResult: Self.result(
            sessionId: sessionId,
            returnCode: Int32(MUNIM_FFMPEG_CANCELLED),
            output: "",
            startedAt: startedAt
          )
        )
      }
    ))

    return promise
  }

  func probe(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onSessionCreated: ((_ sessionId: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()
    let sessionId = nextSession()
    let startedAt = Date()
    registry.register(sessionId, .probe)
    onSessionCreated?(sessionId)

    scheduler.submit(SessionScheduler.Job(
      id: sessionId,
      run: { [registry] in
        let (returnCode, report) = Self.runProbe(arguments_, onLog: onLog, sessionId: sessionId)
        registry.finish(sessionId, returnCode: returnCode)
        promise.resolve(
          withResult: Self.result(
            sessionId: sessionId,
            returnCode: returnCode,
            output: report,
            startedAt: startedAt
          )
        )
      },
      drop: { [registry] in
        registry.finish(sessionId, returnCode: Int32(MUNIM_FFMPEG_CANCELLED))
        promise.resolve(
          withResult: Self.result(
            sessionId: sessionId,
            returnCode: Int32(MUNIM_FFMPEG_CANCELLED),
            output: "",
            startedAt: startedAt
          )
        )
      }
    ))

    return promise
  }

  func getMediaInformation(path: String) throws -> Promise<String> {
    let promise = Promise<String>()
    internalCounter -= 1
    let id = internalCounter

    scheduler.submit(SessionScheduler.Job(
      id: id,
      run: {
        let (returnCode, report) = Self.runProbe(
          [
            "-v", "error",
            "-print_format", "json",
            "-show_format", "-show_streams", "-show_chapters",
            path,
          ],
          onLog: nil,
          sessionId: id
        )

        if returnCode != 0 {
          promise.reject(
            withError: MunimFfmpegError.executionFailed(
              report.isEmpty ? "FFprobe failed with return code \(returnCode)" : report
            )
          )
          return
        }

        promise.resolve(withResult: report)
      },
      drop: {
        promise.reject(withError: MunimFfmpegError.cancelled)
      }
    ))

    return promise
  }

  /// ffprobe writes its report to stdout, which is not reachable from an app,
  /// so it is pointed at a temporary file with `-o` and read back.
  private static func runProbe(
    _ arguments: [String],
    onLog: ((String) -> Void)?,
    sessionId: Double
  ) -> (Int32, String) {
    let destination = temporaryFile()

    _ = installCallbacks
    _ = registerSupplementalDecoders
    let session = Session(onLog: onLog)

    let returnCode = withExtendedLifetime(session) {
      withArrayOfCStrings(arguments) { argv in
        munim_ffmpeg_probe_session(
          Int32(arguments.count),
          argv,
          destination,
          Unmanaged.passUnretained(session).toOpaque(),
          Int64(sessionId)
        )
      }
    }
    session.flush()

    let report = (try? String(contentsOfFile: destination, encoding: .utf8)) ?? ""
    try? FileManager.default.removeItem(atPath: destination)

    return (returnCode, report.isEmpty ? session.output : report)
  }

  private static func validate(_ sessionId: Double) throws {
    guard
      sessionId.isFinite,
      sessionId > 0,
      sessionId.rounded(.towardZero) == sessionId,
      sessionId <= 9_007_199_254_740_991
    else {
      throw MunimFfmpegError.invalidSessionId(sessionId)
    }
  }

  func cancel(sessionId: Double?) throws {
    guard let sessionId else {
      scheduler.cancelAll()
      return
    }
    try Self.validate(sessionId)
    // A finished or unknown session has nothing left to cancel.
    guard registry.activeKind(sessionId) != nil else { return }
    scheduler.cancel(sessionId)
  }

  func cancelAll() throws {
    scheduler.cancelAll()
  }

  func pause(sessionId: Double) throws -> Bool {
    try Self.validate(sessionId)
    guard registry.activeKind(sessionId) == .execute else { return false }
    _ = munim_ffmpeg_pause(Int64(sessionId))
    // The run may have ended between the check and the pause; the core drops
    // the pause of a finished session, so report what actually happened.
    if registry.activeKind(sessionId) == nil {
      _ = munim_ffmpeg_resume(Int64(sessionId))
      return false
    }
    return true
  }

  func resume(sessionId: Double) throws -> Bool {
    try Self.validate(sessionId)
    return munim_ffmpeg_resume(Int64(sessionId)) != 0
  }

  func getSessionState(sessionId: Double) throws -> FFmpegSessionState {
    try Self.validate(sessionId)
    if let state = registry.finishedState(sessionId) { return state }
    guard registry.activeKind(sessionId) != nil else { return .unknown }
    if munim_ffmpeg_is_paused(Int64(sessionId)) != 0 { return .paused }
    return scheduler.isRunning(sessionId) ? .running : .queued
  }

  func setLogBatchInterval(intervalMs: Double) throws {
    guard intervalMs.isFinite, intervalMs >= 0 else {
      throw MunimFfmpegError.invalidInterval(intervalMs)
    }
    LogSettings.shared.batchInterval = min(intervalMs, 5000) / 1000
  }
}

/// Builds a C `argv` that stays valid for the duration of `body`.
private func withArrayOfCStrings<R>(
  _ values: [String],
  _ body: (UnsafePointer<UnsafePointer<CChar>?>?) -> R
) -> R {
  var pointers = values.map { strdup($0) }
  defer { pointers.forEach { free($0) } }

  return pointers.withUnsafeMutableBufferPointer { buffer in
    buffer.baseAddress!.withMemoryRebound(
      to: UnsafePointer<CChar>?.self,
      capacity: buffer.count
    ) { body($0) }
  }
}

private enum MunimFfmpegError: LocalizedError {
  case executionFailed(String)
  case invalidSessionId(Double)
  case invalidInterval(Double)
  case cancelled

  var errorDescription: String? {
    switch self {
    case .executionFailed(let message):
      return message
    case .invalidSessionId(let sessionId):
      return "Invalid FFmpeg session ID: \(sessionId). Expected a positive safe integer."
    case .invalidInterval(let interval):
      return "Invalid log batch interval: \(interval). Expected a finite number of milliseconds >= 0."
    case .cancelled:
      return "FFprobe was cancelled before it started"
    }
  }
}
