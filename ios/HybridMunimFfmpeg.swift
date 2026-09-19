import Foundation
import NitroModules

/// Per-run callback target, handed to the core as the context pointer. The
/// core only routes callbacks to whichever session actually holds its
/// execution lock, so concurrently submitted sessions never see each other's
/// logs.
private final class Session {
  let onLog: ((String) -> Void)?
  let onStatistics: ((Double, Double, Double, Double, Double, Double, Double) -> Void)?
  private var buffer = ""
  // FFmpeg logs from several of its own threads at once, so the buffer needs
  // the lock even though each session belongs to a single execution.
  private let lock = NSLock()

  init(
    onLog: ((String) -> Void)?,
    onStatistics: ((Double, Double, Double, Double, Double, Double, Double) -> Void)? = nil
  ) {
    self.onLog = onLog
    self.onStatistics = onStatistics
  }

  func append(_ text: String) {
    lock.lock()
    buffer += text
    lock.unlock()
  }

  var output: String {
    lock.lock()
    defer { lock.unlock() }
    return buffer
  }
}

// Concurrent on purpose: the C core serialises executions behind its own lock,
// and a request that is waiting there can still be cancelled. A serial queue
// would hold the second call outside the core, where cancelAll() cannot see it.
private let executionQueue = DispatchQueue(
  label: "com.munimtech.ffmpeg",
  qos: .userInitiated,
  attributes: .concurrent
)

private let installCallbacks: Void = munim_ffmpeg_set_callbacks({ context, message in
  guard let context, let message else { return }
  let session = Unmanaged<Session>.fromOpaque(context).takeUnretainedValue()
  let text = String(cString: message)
  session.append(text)
  session.onLog?(text)
}, { context, timeMs, sizeBytes, bitrate, speed, frame, fps, quality in
  guard let context else { return }
  let session = Unmanaged<Session>.fromOpaque(context).takeUnretainedValue()
  session.onStatistics?(timeMs, sizeBytes, bitrate, speed, frame, fps, quality)
}, nil)

/// What the module remembers about each session id. Whether an unfinished
/// session is queued, running or paused is asked of the C core, which is the
/// only place that knows.
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

final class HybridMunimFfmpeg: HybridMunimFfmpegSpec {
  private var sessionCounter: Double = 0
  private let registry = SessionRegistry()

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

  private func result(
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
    registry.register(sessionId, .execute)
    onSessionCreated?(sessionId)

    executionQueue.async {
      let startedAt = Date()
      // ffmpeg prints reports such as -encoders to stdout rather than through
      // its logger, so it is captured to a file and appended to the output.
      let printedPath = Self.temporaryFile()

      _ = installCallbacks
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
      self.registry.finish(sessionId, returnCode: returnCode)

      let printed = (try? String(contentsOfFile: printedPath, encoding: .utf8)) ?? ""
      try? FileManager.default.removeItem(atPath: printedPath)

      promise.resolve(
        withResult: self.result(
          sessionId: sessionId,
          returnCode: returnCode,
          output: session.output + printed,
          startedAt: startedAt
        )
      )
    }

    return promise
  }

  func probe(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onSessionCreated: ((_ sessionId: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()
    let sessionId = nextSession()
    registry.register(sessionId, .probe)
    onSessionCreated?(sessionId)

    executionQueue.async {
      let startedAt = Date()
      let (returnCode, report) = Self.runProbe(arguments_, onLog: onLog, sessionId: sessionId)
      self.registry.finish(sessionId, returnCode: returnCode)
      promise.resolve(
        withResult: self.result(
          sessionId: sessionId,
          returnCode: returnCode,
          output: report,
          startedAt: startedAt
        )
      )
    }

    return promise
  }

  func getMediaInformation(path: String) throws -> Promise<String> {
    let promise = Promise<String>()

    executionQueue.async {
      let (returnCode, report) = Self.runProbe(
        [
          "-v", "error",
          "-print_format", "json",
          "-show_format", "-show_streams", "-show_chapters",
          path,
        ],
        onLog: nil
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
    }

    return promise
  }

  /// ffprobe writes its report to stdout, which is not reachable from an app,
  /// so it is pointed at a temporary file with `-o` and read back.
  private static func runProbe(
    _ arguments: [String],
    onLog: ((String) -> Void)?,
    sessionId: Double = 0
  ) -> (Int32, String) {
    let destination = temporaryFile()

    _ = installCallbacks
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
    if let sessionId {
      try Self.validate(sessionId)
    }
    // One execution runs at a time, so cancelling a specific session and
    // cancelling everything are the same operation.
    munim_ffmpeg_cancel()
  }

  func cancelAll() throws {
    munim_ffmpeg_cancel()
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
    return munim_ffmpeg_running_session() == Int64(sessionId) ? .running : .queued
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

  var errorDescription: String? {
    switch self {
    case .executionFailed(let message):
      return message
    case .invalidSessionId(let sessionId):
      return "Invalid FFmpeg session ID: \(sessionId). Expected a positive safe integer."
    }
  }
}
