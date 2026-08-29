import NitroModules
import ffmpegkit

final class HybridMunimFfmpeg: HybridMunimFfmpegSpec {
  var ffmpegVersion: String {
    FFmpegKitConfig.getFFmpegVersion()
  }

  func execute(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onStatistics: ((_ timeMs: Double, _ sizeBytes: Double, _ bitrateKbits: Double, _ speed: Double, _ videoFrameNumber: Double, _ fps: Double, _ quality: Double) -> Void)?,
    onSessionCreated: ((_ sessionId: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()

    let session = FFmpegKit.execute(
      withArgumentsAsync: arguments_,
      withCompleteCallback: { session in
        guard let session else {
          promise.reject(withError: MunimFfmpegError.missingSession)
          return
        }
        promise.resolve(withResult: Self.result(from: session))
      },
      withLogCallback: { log in
        guard let message = log?.getMessage() else { return }
        onLog?(message)
      },
      withStatisticsCallback: { statistics in
        guard let statistics else { return }
        onStatistics?(
          statistics.getTime(),
          Double(statistics.getSize()),
          statistics.getBitrate(),
          statistics.getSpeed(),
          Double(statistics.getVideoFrameNumber()),
          Double(statistics.getVideoFps()),
          Double(statistics.getVideoQuality())
        )
      }
    )
    if let session {
      onSessionCreated?(Double(session.getId()))
    }

    return promise
  }

  func probe(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onSessionCreated: ((_ sessionId: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()

    let session = FFprobeKit.execute(
      withArgumentsAsync: arguments_,
      withCompleteCallback: { session in
        guard let session else {
          promise.reject(withError: MunimFfmpegError.missingSession)
          return
        }
        promise.resolve(withResult: Self.result(from: session))
      },
      withLogCallback: { log in
        guard let message = log?.getMessage() else { return }
        onLog?(message)
      }
    )
    if let session {
      onSessionCreated?(Double(session.getId()))
    }

    return promise
  }

  func getMediaInformation(path: String) throws -> Promise<String> {
    let promise = Promise<String>()
    let arguments = [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-show_chapters",
      path,
    ]

    FFprobeKit.execute(
      withArgumentsAsync: arguments,
      withCompleteCallback: { session in
        guard let session else {
          promise.reject(withError: MunimFfmpegError.missingSession)
          return
        }
        let returnCode = session.getReturnCode()
        guard ReturnCode.isSuccess(returnCode) else {
          let message = session.getFailStackTrace() ?? session.getOutput() ?? "FFprobe failed"
          promise.reject(withError: MunimFfmpegError.executionFailed(message))
          return
        }
        promise.resolve(withResult: session.getOutput() ?? "{}")
      }
    )

    return promise
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
      FFmpegKit.cancel(Int(sessionId))
    } else {
      FFmpegKit.cancel()
    }
  }

  func cancelAll() throws {
    FFmpegKit.cancel()
  }

  // `String(describing:)` on the imported NS_ENUM yields "sessionstate(rawvalue: 3)".
  // Android reports the Java enum name, so map to the same lowercase names here.
  private static func stateName(_ state: SessionState) -> String {
    switch state {
    case .created: return "created"
    case .running: return "running"
    case .failed: return "failed"
    case .completed: return "completed"
    @unknown default: return "unknown"
    }
  }

  private static func result(from session: Session) -> FFmpegSessionResult {
    let returnCode = session.getReturnCode()
    return FFmpegSessionResult(
      sessionId: Double(session.getId()),
      returnCode: Double(returnCode?.getValue() ?? -1),
      success: ReturnCode.isSuccess(returnCode),
      cancelled: ReturnCode.isCancel(returnCode),
      state: Self.stateName(session.getState()),
      durationMs: Double(session.getDuration()),
      output: session.getOutput() ?? "",
      failStackTrace: session.getFailStackTrace()
    )
  }
}

private enum MunimFfmpegError: LocalizedError {
  case missingSession
  case executionFailed(String)
  case invalidSessionId(Double)

  var errorDescription: String? {
    switch self {
    case .missingSession:
      return "FFmpegKit did not return a session."
    case .executionFailed(let message):
      return message
    case .invalidSessionId(let sessionId):
      return "Invalid FFmpeg session ID: \(sessionId). Expected a positive safe integer."
    }
  }
}
