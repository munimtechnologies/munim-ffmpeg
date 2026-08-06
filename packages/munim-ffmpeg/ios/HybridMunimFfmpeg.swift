import NitroModules
import ffmpegkit

final class HybridMunimFfmpeg: HybridMunimFfmpegSpec {
  var ffmpegVersion: String {
    FFmpegKitConfig.getFFmpegVersion()
  }

  func execute(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?,
    onStatistics: ((_ timeMs: Double, _ sizeBytes: Double, _ bitrateKbits: Double, _ speed: Double, _ videoFrameNumber: Double, _ fps: Double, _ quality: Double) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()

    FFmpegKit.execute(
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

    return promise
  }

  func probe(
    arguments_: [String],
    onLog: ((_ message: String) -> Void)?
  ) throws -> Promise<FFmpegSessionResult> {
    let promise = Promise<FFmpegSessionResult>()

    FFprobeKit.execute(
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
      FFmpegKit.cancel(Int(sessionId))
    } else {
      FFmpegKit.cancel()
    }
  }

  func cancelAll() throws {
    FFmpegKit.cancel()
  }

  private static func result(from session: Session) -> FFmpegSessionResult {
    let returnCode = session.getReturnCode()
    return FFmpegSessionResult(
      sessionId: Double(session.getId()),
      returnCode: Double(returnCode?.getValue() ?? -1),
      success: ReturnCode.isSuccess(returnCode),
      cancelled: ReturnCode.isCancel(returnCode),
      state: String(describing: session.getState()).lowercased(),
      durationMs: Double(session.getDuration()),
      output: session.getOutput() ?? "",
      failStackTrace: session.getFailStackTrace()
    )
  }
}

private enum MunimFfmpegError: LocalizedError {
  case missingSession
  case executionFailed(String)

  var errorDescription: String? {
    switch self {
    case .missingSession:
      return "FFmpegKit did not return a session."
    case .executionFailed(let message):
      return message
    }
  }
}
