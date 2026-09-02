package com.margelo.nitro.munimffmpeg

import android.system.Os
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.io.File

/**
 * Per-run callback target. The JNI bridge holds a global reference to this
 * object for the duration of its execution and the native core only routes
 * callbacks to whichever session actually holds the execution lock, so
 * concurrently submitted sessions never see each other's logs.
 */
@Keep
@DoNotStrip
class FFmpegSession(
  private val logSink: ((String) -> Unit)?,
  private val statisticsSink: ((
    timeMs: Double,
    sizeBytes: Double,
    bitrateKbits: Double,
    speed: Double,
    videoFrameNumber: Double,
    fps: Double,
    quality: Double,
  ) -> Unit)?,
) {
  private val buffer = StringBuilder()

  val output: String
    get() = synchronized(buffer) { buffer.toString() }

  // FFmpeg logs from several of its own threads at once, so the buffer needs
  // the lock even though each session belongs to a single execution.
  @Keep
  @DoNotStrip
  fun onLog(message: String) {
    synchronized(buffer) { buffer.append(message) }
    logSink?.invoke(message)
  }

  @Keep
  @DoNotStrip
  fun onStatistics(
    timeMs: Double,
    sizeBytes: Double,
    bitrateKbits: Double,
    speed: Double,
    videoFrameNumber: Double,
    fps: Double,
    quality: Double,
  ) {
    statisticsSink?.invoke(timeMs, sizeBytes, bitrateKbits, speed, videoFrameNumber, fps, quality)
  }
}

/**
 * Thin wrapper over FFmpeg 9's own command-line tools, compiled to run inside
 * the app process.
 *
 * fftools keeps its parsed command in file-scope globals, so exactly one
 * execution runs at a time; the native core serialises callers and cancels
 * anything still queued when [nativeCancel] is called.
 */
@Keep
@DoNotStrip
object FFmpegNative {
  init {
    configureFontconfig()
    System.loadLibrary("munimffmpeg")
  }

  /** Return code the tools report when a run was cancelled. */
  const val CANCELLED = 255

  external fun nativeVersion(): String

  external fun nativeExecute(
    arguments: Array<String>,
    stdoutPath: String,
    session: FFmpegSession,
  ): Int

  external fun nativeExecuteProbe(
    arguments: Array<String>,
    outputPath: String,
    session: FFmpegSession,
  ): Int

  external fun nativeCancel()

  /**
   * libass discovers fonts through fontconfig, and Android has no fonts.conf,
   * so one pointing at the system font directories is written to the app's
   * cache and exported before FFmpeg first runs. Without it, `subtitles=` and
   * `drawtext` render nothing. Apps that manage their own fontconfig setup can
   * set FONTCONFIG_FILE first; it is never overwritten.
   */
  private fun configureFontconfig() {
    runCatching {
      if (!System.getenv("FONTCONFIG_FILE").isNullOrEmpty()) return

      val root = File(System.getProperty("java.io.tmpdir"), "munim-ffmpeg-fontconfig")
      val cache = File(root, "cache")
      cache.mkdirs()

      val configuration = File(root, "fonts.conf")
      configuration.writeText(
        """
        <?xml version="1.0"?>
        <!DOCTYPE fontconfig SYSTEM "fonts.dtd">
        <fontconfig>
          <dir>/system/fonts</dir>
          <dir>/system/font</dir>
          <dir>/product/fonts</dir>
          <cachedir>${cache.absolutePath}</cachedir>
        </fontconfig>
        """.trimIndent()
      )

      Os.setenv("FONTCONFIG_FILE", configuration.absolutePath, true)
    }
  }
}
