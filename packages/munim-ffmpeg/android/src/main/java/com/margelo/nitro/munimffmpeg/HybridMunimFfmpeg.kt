package com.margelo.nitro.munimffmpeg

import androidx.annotation.Keep
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.FFmpegKitConfig
import com.arthenica.ffmpegkit.FFprobeKit
import com.arthenica.ffmpegkit.ReturnCode
import com.arthenica.ffmpegkit.Session
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise

@Keep
@DoNotStrip
class HybridMunimFfmpeg : HybridMunimFfmpegSpec() {
  override val ffmpegVersion: String
    get() = FFmpegKitConfig.getFFmpegVersion()

  override fun execute(
    arguments_: Array<String>,
    onLog: ((message: String) -> Unit)?,
    onStatistics: ((
      timeMs: Double,
      sizeBytes: Double,
      bitrateKbits: Double,
      speed: Double,
      videoFrameNumber: Double,
      fps: Double,
      quality: Double,
    ) -> Unit)?,
  ): Promise<FFmpegSessionResult> {
    val promise = Promise<FFmpegSessionResult>()

    try {
      FFmpegKit.executeWithArgumentsAsync(
        arguments_,
        { session -> promise.resolve(session.toResult()) },
        { log -> onLog?.invoke(log.message) },
        { statistics ->
          onStatistics?.invoke(
            statistics.time,
            statistics.size.toDouble(),
            statistics.bitrate,
            statistics.speed,
            statistics.videoFrameNumber.toDouble(),
            statistics.videoFps,
            statistics.videoQuality,
          )
        },
      )
    } catch (error: Throwable) {
      promise.reject(error)
    }

    return promise
  }

  override fun probe(
    arguments_: Array<String>,
    onLog: ((message: String) -> Unit)?,
  ): Promise<FFmpegSessionResult> {
    val promise = Promise<FFmpegSessionResult>()

    try {
      FFprobeKit.executeWithArgumentsAsync(
        arguments_,
        { session -> promise.resolve(session.toResult()) },
        { log -> onLog?.invoke(log.message) },
      )
    } catch (error: Throwable) {
      promise.reject(error)
    }

    return promise
  }

  override fun getMediaInformation(path: String): Promise<String> {
    return Promise.async {
      val session = FFprobeKit.executeWithArguments(
        arrayOf(
          "-v",
          "error",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          "-show_chapters",
          path,
        ),
      )
      val returnCode = session.returnCode

      if (!ReturnCode.isSuccess(returnCode)) {
        throw IllegalStateException(
          session.failStackTrace ?: session.output.ifEmpty {
            "FFprobe failed with return code ${returnCode?.value ?: -1}"
          },
        )
      }

      session.output
    }
  }

  override fun cancel(sessionId: Double?) {
    if (sessionId == null) {
      FFmpegKit.cancel()
    } else {
      FFmpegKit.cancel(sessionId.toLong())
    }
  }

  override fun cancelAll() {
    FFmpegKit.cancel()
  }

  private fun Session.toResult(): FFmpegSessionResult {
    val code = returnCode
    return FFmpegSessionResult(
      sessionId = sessionId.toDouble(),
      returnCode = (code?.value ?: -1).toDouble(),
      success = ReturnCode.isSuccess(code),
      cancelled = ReturnCode.isCancel(code),
      state = state.name.lowercase(),
      durationMs = duration.toDouble(),
      output = output,
      failStackTrace = failStackTrace,
    )
  }
}
