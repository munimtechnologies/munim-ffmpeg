package com.margelo.nitro.munimffmpeg

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.ThreadFactory
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

@Keep
@DoNotStrip
class HybridMunimFfmpeg : HybridMunimFfmpegSpec() {
  override val ffmpegVersion: String
    get() = FFmpegNative.nativeVersion()

  private val sessions = AtomicLong(0)
  private val registry = SessionRegistry()

  private fun nextSession() = sessions.incrementAndGet().toDouble()

  /**
   * Runs [block] on a dedicated FFmpeg thread and settles a [Promise] with its
   * outcome. Nitro's `Promise.async` shares Kotlin's default coroutine pool,
   * which only has one thread per CPU core: a multi-minute transcode plus a
   * few queued sessions would park the whole pool and starve every other
   * coroutine in the app. FFmpeg work therefore gets its own unbounded pool.
   */
  private fun <T> runOnFfmpegThread(block: () -> T): Promise<T> {
    val promise = Promise<T>()
    executor.execute {
      try {
        promise.resolve(block())
      } catch (error: Throwable) {
        promise.reject(error)
      }
    }
    return promise
  }

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
    registry.register(sessionId, SessionRegistry.Kind.EXECUTE)
    onSessionCreated?.invoke(sessionId)

    return runOnFfmpegThread {
      val startedAt = System.currentTimeMillis()
      // ffmpeg prints reports such as -encoders and -protocols to stdout rather
      // than through its logger, so it is captured to a file and appended.
      val stdout = File.createTempFile("munim-ffmpeg", ".txt")

      val session = FFmpegSession(
        logSink = { message -> onLog?.invoke(message) },
        statisticsSink = onStatistics,
      )
      val returnCode =
        FFmpegNative.nativeExecute(arguments_, stdout.absolutePath, session, sessionId.toLong())
      // A pause that raced the end of the run would otherwise stay listed.
      FFmpegNative.nativeResume(sessionId.toLong())
      registry.finish(sessionId, returnCode)

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
    registry.register(sessionId, SessionRegistry.Kind.PROBE)
    onSessionCreated?.invoke(sessionId)

    return runOnFfmpegThread {
      val startedAt = System.currentTimeMillis()
      val (returnCode, report) = runProbe(arguments_, onLog, sessionId.toLong())
      registry.finish(sessionId, returnCode)
      result(sessionId, returnCode, report, System.currentTimeMillis() - startedAt)
    }
  }

  override fun getMediaInformation(path: String): Promise<String> {
    return runOnFfmpegThread {
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
    sessionId: Long = 0,
  ): Pair<Int, String> {
    val destination = File.createTempFile("munim-ffprobe", ".txt")
    try {
      val session = FFmpegSession(
        logSink = { message -> onLog?.invoke(message) },
        statisticsSink = null,
      )
      val returnCode =
        FFmpegNative.nativeExecuteProbe(arguments, destination.absolutePath, session, sessionId)

      val report = destination.readText()
      return returnCode to report.ifEmpty { session.output }
    } finally {
      destination.delete()
    }
  }

  private fun validate(sessionId: Double) {
    require(
      sessionId.isFinite() &&
        sessionId > 0 &&
        sessionId % 1.0 == 0.0 &&
        sessionId <= 9_007_199_254_740_991.0,
    ) {
      "Invalid FFmpeg session ID: $sessionId. Expected a positive safe integer."
    }
  }

  override fun cancel(sessionId: Double?) {
    if (sessionId != null) validate(sessionId)
    // Only one execution runs at a time, so a targeted cancel and cancelAll()
    // are the same operation.
    FFmpegNative.nativeCancel()
  }

  override fun cancelAll() {
    FFmpegNative.nativeCancel()
  }

  override fun pause(sessionId: Double): Boolean {
    validate(sessionId)
    if (registry.activeKind(sessionId) != SessionRegistry.Kind.EXECUTE) return false
    FFmpegNative.nativePause(sessionId.toLong())
    // The run may have ended between the check and the pause.
    if (registry.activeKind(sessionId) == null) {
      FFmpegNative.nativeResume(sessionId.toLong())
      return false
    }
    return true
  }

  override fun resume(sessionId: Double): Boolean {
    validate(sessionId)
    return FFmpegNative.nativeResume(sessionId.toLong())
  }

  override fun getSessionState(sessionId: Double): FFmpegSessionState {
    validate(sessionId)
    registry.finishedState(sessionId)?.let { return it }
    if (registry.activeKind(sessionId) == null) return FFmpegSessionState.UNKNOWN
    val id = sessionId.toLong()
    if (FFmpegNative.nativeIsPaused(id)) return FFmpegSessionState.PAUSED
    return if (FFmpegNative.nativeRunningSession() == id) {
      FFmpegSessionState.RUNNING
    } else {
      FFmpegSessionState.QUEUED
    }
  }

  private companion object {
    private val threadCounter = AtomicInteger(0)

    /** Unbounded so a queued session never blocks anything but itself. */
    private val executor = Executors.newCachedThreadPool(
      ThreadFactory { runnable ->
        Thread(runnable, "munim-ffmpeg-${threadCounter.incrementAndGet()}").apply {
          isDaemon = true
        }
      },
    )
  }
}

/**
 * What the module remembers about each session id. Whether an unfinished
 * session is queued, running or paused is asked of the native core, which is
 * the only place that knows.
 */
private class SessionRegistry {
  enum class Kind { EXECUTE, PROBE }

  private val kinds = HashMap<Double, Kind>()
  private val finished = LinkedHashMap<Double, FFmpegSessionState>()

  @Synchronized
  fun register(sessionId: Double, kind: Kind) {
    kinds[sessionId] = kind
  }

  @Synchronized
  fun finish(sessionId: Double, returnCode: Int) {
    kinds.remove(sessionId)
    finished[sessionId] = when (returnCode) {
      FFmpegNative.CANCELLED -> FFmpegSessionState.CANCELLED
      0 -> FFmpegSessionState.COMPLETED
      else -> FFmpegSessionState.FAILED
    }
    // Finished sessions are forgotten, oldest first, beyond this many.
    while (finished.size > FINISHED_LIMIT) finished.remove(finished.keys.first())
  }

  /** null once finished or never issued. */
  @Synchronized
  fun activeKind(sessionId: Double): Kind? = kinds[sessionId]

  @Synchronized
  fun finishedState(sessionId: Double): FFmpegSessionState? = finished[sessionId]

  private companion object {
    const val FINISHED_LIMIT = 512
  }
}
