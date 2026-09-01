package com.margelo.nitro.munimffmpeg

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import java.io.File
import java.util.concurrent.atomic.AtomicLong

@Keep
@DoNotStrip
class HybridMunimFfmpeg : HybridMunimFfmpegSpec() {
  override val ffmpegVersion: String
    get() = FFmpegNative.nativeVersion()

  private val sessions = AtomicLong(0)

  private fun nextSession() = sessions.incrementAndGet().toDouble()

  private fun result(
    sessionId: Double,
    returnCode: Int,
    output: String,
    durationMs: Long,
  ): FFmpegSessionResult {
    val cancelled = returnCode == FFmpegNative.CANCELLED
    return FFmpegSessionResult(
      sessionId = sessionId,
      returnCode = returnCode.toDouble(),
      success = returnCode == 0,
      cancelled = cancelled,
      state = "completed",
      durationMs = durationMs.toDouble(),
      output = output,
      failStackTrace = null,
    )
  }

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
    onSessionCreated: ((sessionId: Double) -> Unit)?,
  ): Promise<FFmpegSessionResult> {
    val sessionId = nextSession()
    onSessionCreated?.invoke(sessionId)

    return Promise.async {
      val startedAt = System.currentTimeMillis()
      // ffmpeg prints reports such as -encoders and -protocols to stdout rather
      // than through its logger, so it is captured to a file and appended.
      val stdout = File.createTempFile("munim-ffmpeg", ".txt")

      val session = FFmpegSession(
        logSink = { message -> onLog?.invoke(message) },
        statisticsSink = onStatistics,
      )
      val returnCode = FFmpegNative.nativeExecute(arguments_, stdout.absolutePath, session)

      val printed = runCatching { stdout.readText() }.getOrDefault("")
      stdout.delete()

      result(sessionId, returnCode, session.output + printed, System.currentTimeMillis() - startedAt)
    }
  }

  override fun probe(
    arguments_: Array<String>,
    onLog: ((message: String) -> Unit)?,
    onSessionCreated: ((sessionId: Double) -> Unit)?,
  ): Promise<FFmpegSessionResult> {
    val sessionId = nextSession()
    onSessionCreated?.invoke(sessionId)

    return Promise.async {
      val startedAt = System.currentTimeMillis()
      val (returnCode, report) = runProbe(arguments_, onLog)
      result(sessionId, returnCode, report, System.currentTimeMillis() - startedAt)
    }
  }

  override fun getMediaInformation(path: String): Promise<String> {
    return Promise.async {
      val (returnCode, report) = runProbe(
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
        null,
      )

      if (returnCode != 0) {
        throw IllegalStateException(
          report.ifEmpty { "FFprobe failed with return code $returnCode" }
        )
      }

      report
    }
  }

  /**
   * ffprobe writes its report to stdout, which is not reachable from an app, so
   * it is pointed at a temporary file with `-o` and read back.
   */
  private fun runProbe(
    arguments: Array<String>,
    onLog: ((message: String) -> Unit)?,
  ): Pair<Int, String> {
    val destination = File.createTempFile("munim-ffprobe", ".txt")
    try {
      val session = FFmpegSession(
        logSink = { message -> onLog?.invoke(message) },
        statisticsSink = null,
      )
      val returnCode =
        FFmpegNative.nativeExecuteProbe(arguments, destination.absolutePath, session)

      val report = destination.readText()
      return returnCode to report.ifEmpty { session.output }
    } finally {
      destination.delete()
    }
  }

  override fun cancel(sessionId: Double?) {
    if (sessionId != null) {
      require(
        sessionId.isFinite() &&
          sessionId > 0 &&
          sessionId % 1.0 == 0.0 &&
          sessionId <= 9_007_199_254_740_991.0,
      ) {
        "Invalid FFmpeg session ID: $sessionId. Expected a positive safe integer."
      }
    }
    // Only one execution runs at a time, so a targeted cancel and cancelAll()
    // are the same operation.
    FFmpegNative.nativeCancel()
  }

  override fun cancelAll() {
    FFmpegNative.nativeCancel()
  }
}
