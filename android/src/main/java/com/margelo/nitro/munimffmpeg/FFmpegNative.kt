package com.margelo.nitro.munimffmpeg

import android.system.Os
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/** How often batched log callbacks are delivered, shared by every session. */
internal object LogBatching {
  @Volatile
  var intervalMs: Long = 100

  /**
   * Delivers batched logs. Single-threaded, so the timer flush and the final
   * flush of a session can never hand its chunks over out of order.
   */
  val executor: ScheduledExecutorService =
    Executors.newSingleThreadScheduledExecutor { runnable ->
      Thread(runnable, "munim-ffmpeg-logs").apply { isDaemon = true }
    }
}

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
  private val batchIntervalMs: Long = LogBatching.intervalMs,
) {
  private val buffer = StringBuilder()

  /** Logged but not yet handed to [logSink]. */
  private val pending = StringBuilder()
  private var flushScheduled = false

  val output: String
    get() = synchronized(buffer) { buffer.toString() }

  /**
   * Every message FFmpeg logs. Each [logSink] call is a hop onto the JS
   * thread, so with a batch interval the messages are collected here and
   * delivered together at most once per interval instead of one call per line.
   * FFmpeg logs from several of its own threads at once, hence the lock.
   */
  @Keep
  @DoNotStrip
  fun onLog(message: String) {
    val sink = logSink
    var schedule = false
    synchronized(buffer) {
      buffer.append(message)
      if (sink == null) return
      if (batchIntervalMs > 0) {
        pending.append(message)
        schedule = !flushScheduled
        flushScheduled = true
      }
    }

    if (batchIntervalMs <= 0) {
      sink?.invoke(message)
    } else if (schedule) {
      LogBatching.executor.schedule({ deliver() }, batchIntervalMs, TimeUnit.MILLISECONDS)
    }
  }

  /**
   * Delivers whatever is still pending. Called when the run ends, before its
   * promise settles, so every log line arrives ahead of the result.
   */
  fun flush() {
    if (logSink == null || batchIntervalMs <= 0) return
    LogBatching.executor.submit { deliver() }.get()
  }

  /** Runs on [LogBatching.executor] only. */
  private fun deliver() {
    val chunk = synchronized(buffer) {
      val text = pending.toString()
      pending.setLength(0)
      flushScheduled = false
      text
    }
    if (chunk.isNotEmpty()) logSink?.invoke(chunk)
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
    sessionId: Long,
  ): Int

  external fun nativeExecuteProbe(
    arguments: Array<String>,
    outputPath: String,
    session: FFmpegSession,
    sessionId: Long,
  ): Int

  external fun nativeCancel()

  external fun nativePause(sessionId: Long): Boolean

  external fun nativeResume(sessionId: Long): Boolean

  external fun nativeIsPaused(sessionId: Long): Boolean

  /** Id of the execution or probe currently running, or 0. */
  external fun nativeRunningSession(): Long

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
