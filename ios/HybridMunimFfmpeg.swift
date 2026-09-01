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

final class HybridMunimFfmpeg: HybridMunimFfmpegSpec {
  private var sessionCounter: Double = 0

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
          munim_ffmpeg_execute_ctx(
            Int32(arguments_.count),
            argv,
            printedPath,
            Unmanaged.passUnretained(session).toOpaque()
          )
        }
      }

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
    onSessionCreated?(sessionId)

    executionQueue.async {
      let startedAt = Date()
      let (returnCode, report) = Self.runProbe(arguments_, onLog: onLog)
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
    onLog: ((String) -> Void)?
  ) -> (Int32, String) {
    let destination = temporaryFile()

    _ = installCallbacks
    let session = Session(onLog: onLog)

    let returnCode = withExtendedLifetime(session) {
      withArrayOfCStrings(arguments) { argv in
        munim_ffmpeg_probe_ctx(
          Int32(arguments.count),
          argv,
          destination,
          Unmanaged.passUnretained(session).toOpaque()
        )
      }
    }

    let report = (try? String(contentsOfFile: destination, encoding: .utf8)) ?? ""
    try? FileManager.default.removeItem(atPath: destination)

    return (returnCode, report.isEmpty ? session.output : report)
  }

  func cancel(sessionId: Double?) throws {
    if let sessionId {
      guard
        sessionId.isFinite,
        sessionId > 0,
        sessionId.rounded(.towardZero) == sessionId,
        sessionId <= 9_007_199_254_740_991
      else {
        throw MunimFfmpegError.invalidSessionId(sessionId)
      }
    }
    // One execution runs at a time, so cancelling a specific session and
    // cancelling everything are the same operation.
    munim_ffmpeg_cancel()
  }

  func cancelAll() throws {
    munim_ffmpeg_cancel()
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
