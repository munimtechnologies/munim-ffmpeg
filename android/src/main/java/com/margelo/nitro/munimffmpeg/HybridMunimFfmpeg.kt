package com.margelo.nitro.munimffmpeg

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

@Keep
@DoNotStrip
class HybridMunimFfmpeg : HybridMunimFfmpegSpec() {
  override val ffmpegVersion: String
    get() = FFmpegNative.nativeVersion()

  private val sessions = AtomicLong(0)

  /**
   * Ids for internal runs (getMediaInformation) count down from -1, so they
   * can never collide with, or be cancelled as, a caller's session.
   */
  private val internalSessions = AtomicLong(0)
  private val registry = SessionRegistry()
  private val scheduler = SessionScheduler()

  init {
    // FFmpegNative's first use loads a large native library. Doing that here,
    // off the JS thread, keeps the first getFFmpegVersion() or cancel() call
    // from stalling the JS thread while it loads.
    Thread({ runCatching { FFmpegNative.nativeVersion() } }, "munim-ffmpeg-load").apply {
      isDaemon = true
      start()
    }
  }

  private fun nextSession() = sessions.incrementAndGet().toDouble()

  private fun result(
    sessionId: Double,
    returnCode: Int,
    output: String,
    startedAt: Long,
  ): FFmpegSessionResult {
    val cancelled = returnCode == FFmpegNative.CANCELLED
    return FFmpegSessionResult(
      sessionId = sessionId,
      returnCode = returnCode.toDouble(),
      success = returnCode == 0,
      cancelled = cancelled,
      state = "completed",
      durationMs = (System.currentTimeMillis() - startedAt).toDouble(),
      output = output,
      failStackTrace = null,
    )
  }

  /**
   * Queues one session. [run] executes on the FFmpeg thread once every session
   * ahead of it has finished and returns the session's result; [drop] settles
   * it if it is cancelled before it starts. Either way the promise settles once.
   */
  private fun <T> submit(
    id: Long,
    run: () -> T,
    drop: (Promise<T>) -> Unit,
  ): Promise<T> {
    val promise = Promise<T>()
    scheduler.submit(
      SessionScheduler.Job(
        id = id,
        run = {
          try {
            promise.resolve(run())
          } catch (error: Throwable) {
            promise.reject(error)
          }
        },
        drop = { drop(promise) },
      ),
    )
    return promise
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
    val startedAt = System.currentTimeMillis()
    registry.register(sessionId, SessionRegistry.Kind.EXECUTE)
    onSessionCreated?.invoke(sessionId)

    return submit(
      sessionId.toLong(),
      run = {
        var returnCode = -1
        try {
          ContentArguments.prepare(arguments_, probe = false).use { content ->
            // ffmpeg prints reports such as -encoders and -protocols to stdout
            // rather than through its logger, so it is captured to a file.
            val stdout = File.createTempFile("munim-ffmpeg", ".txt")
            val session = FFmpegSession(logSink = onLog, statisticsSink = onStatistics)
            returnCode = FFmpegNative.nativeExecute(
              content.arguments,
              stdout.absolutePath,
              session,
              sessionId.toLong(),
            )
            // A pause that raced the end of the run would otherwise stay listed.
            FFmpegNative.nativeResume(sessionId.toLong())
            session.flush()

            val printed = runCatching { stdout.readText() }.getOrDefault("")
            stdout.delete()

            if (returnCode == 0) {
              try {
                content.commit()
              } catch (error: Throwable) {
                returnCode = -1
                throw error
              }
            }
            result(sessionId, returnCode, session.output + printed, startedAt)
          }
        } finally {
          registry.finish(sessionId, returnCode)
        }
      },
      drop = { promise ->
        registry.finish(sessionId, FFmpegNative.CANCELLED)
        promise.resolve(result(sessionId, FFmpegNative.CANCELLED, "", startedAt))
      },
    )
  }

  override fun probe(
    arguments_: Array<String>,
    onLog: ((message: String) -> Unit)?,
    onSessionCreated: ((sessionId: Double) -> Unit)?,
  ): Promise<FFmpegSessionResult> {
    val sessionId = nextSession()
    val startedAt = System.currentTimeMillis()
    registry.register(sessionId, SessionRegistry.Kind.PROBE)
    onSessionCreated?.invoke(sessionId)

    return submit(
      sessionId.toLong(),
      run = {
        var returnCode = -1
        try {
          val (code, report) = runProbe(arguments_, onLog, sessionId.toLong())
          returnCode = code
          result(sessionId, returnCode, report, startedAt)
        } finally {
          registry.finish(sessionId, returnCode)
        }
      },
      drop = { promise ->
        registry.finish(sessionId, FFmpegNative.CANCELLED)
        promise.resolve(result(sessionId, FFmpegNative.CANCELLED, "", startedAt))
      },
    )
  }

  override fun getMediaInformation(path: String): Promise<String> {
    val id = internalSessions.decrementAndGet()
    return submit(
      id,
      run = {
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
          id,
        )

        if (returnCode != 0) {
          throw IllegalStateException(
            report.ifEmpty { "FFprobe failed with return code $returnCode" },
          )
        }

        report
      },
      drop = { promise ->
        promise.reject(IllegalStateException("FFprobe was cancelled before it started"))
      },
    )
  }

  /**
   * ffprobe writes its report to stdout, which is not reachable from an app, so
   * it is pointed at a temporary file with `-o` and read back.
   */
  private fun runProbe(
    arguments: Array<String>,
    onLog: ((message: String) -> Unit)?,
    sessionId: Long,
  ): Pair<Int, String> {
    val destination = File.createTempFile("munim-ffprobe", ".txt")
    return try {
      ContentArguments.prepare(arguments, probe = true).use { content ->
        val session = FFmpegSession(logSink = onLog, statisticsSink = null)
        val returnCode =
          FFmpegNative.nativeExecuteProbe(content.arguments, destination.absolutePath, session, sessionId)
        session.flush()

        val report = destination.readText()
        returnCode to report.ifEmpty { session.output }
      }
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
    if (sessionId == null) {
      scheduler.cancelAll()
      return
    }
    validate(sessionId)
    // A finished or unknown session has nothing left to cancel.
    if (registry.activeKind(sessionId) == null) return
    scheduler.cancel(sessionId.toLong())
  }

  override fun cancelAll() {
    scheduler.cancelAll()
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
    return if (scheduler.isRunning(id)) FFmpegSessionState.RUNNING else FFmpegSessionState.QUEUED
  }

  override fun setLogBatchInterval(intervalMs: Double) {
    require(intervalMs.isFinite() && intervalMs >= 0) {
      "Invalid log batch interval: $intervalMs. Expected a finite number of milliseconds >= 0."
    }
    LogBatching.intervalMs = intervalMs.coerceAtMost(5000.0).toLong()
  }
}

/**
 * Runs sessions one at a time, in order. fftools keeps its state in globals,
 * so the native core can only run one execution at a time anyway; queueing
 * here rather than inside the core means a queued session holds no thread,
 * and can be cancelled on its own without touching the one that is running.
 */
private class SessionScheduler {
  class Job(val id: Long, val run: () -> Unit, val drop: () -> Unit)

  private val lock = Any()
  private val queue = ArrayDeque<Job>()
  private var running: Job? = null

  /** Whether the running job has gone into the native core yet. */
  private var entered = false

  /** Set when the running job is cancelled before it reached the core. */
  private var cancelledBeforeStart = false

  fun submit(job: Job) = synchronized(lock) {
    if (running == null) start(job) else queue.addLast(job)
  }

  /** Callers hold [lock]. */
  private fun start(job: Job) {
    running = job
    entered = false
    cancelledBeforeStart = false
    executor.execute { execute(job) }
  }

  private fun execute(job: Job) {
    val cancelled = synchronized(lock) {
      entered = !cancelledBeforeStart
      cancelledBeforeStart
    }
    try {
      if (cancelled) job.drop() else job.run()
    } finally {
      synchronized(lock) {
        running = null
        queue.removeFirstOrNull()?.let { start(it) }
      }
    }
  }

  fun isRunning(id: Long): Boolean = synchronized(lock) { running?.id == id }

  /** Cancels one session: a queued one is dropped, the running one stopped. */
  fun cancel(id: Long) {
    val dropped = synchronized(lock) {
      val queued = queue.firstOrNull { it.id == id }
      if (queued != null) {
        queue.remove(queued)
      } else if (running?.id == id) {
        stopRunning()
      }
      queued
    } ?: return
    FFmpegNative.nativeResume(id)
    dropped.drop()
  }

  fun cancelAll() {
    val dropped = synchronized(lock) {
      val all = queue.toList()
      queue.clear()
      if (running != null) stopRunning()
      all
    }
    dropped.forEach { job ->
      FFmpegNative.nativeResume(job.id)
      job.drop()
    }
  }

  /** Callers hold [lock], so no queued job can start until this returns. */
  private fun stopRunning() {
    val job = running ?: return
    if (!entered) {
      cancelledBeforeStart = true
      return
    }
    cancelCore()
    // The job may be between entering the core and the core reading its
    // cancel counter, in which case it would start regardless. Once the core
    // reports it running, cancel again; if it already stopped, nothing to do.
    if (FFmpegNative.nativeRunningSession() != job.id) {
      verifier.execute { cancelOnceRunning(job.id) }
    }
  }

  /** Callers hold [lock]. Cancelling the core clears every pause; queued sessions keep theirs. */
  private fun cancelCore() {
    val paused = queue.filter { FFmpegNative.nativeIsPaused(it.id) }
    FFmpegNative.nativeCancel()
    paused.forEach { FFmpegNative.nativePause(it.id) }
  }

  private fun cancelOnceRunning(id: Long) {
    repeat(2000) {
      if (!isRunning(id)) return
      if (FFmpegNative.nativeRunningSession() == id) {
        synchronized(lock) { if (running?.id == id) cancelCore() }
        return
      }
      Thread.sleep(0, 500_000)
    }
  }

  private companion object {
    private fun daemon(name: String) = Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, name).apply { isDaemon = true }
    }

    /** One thread: the core runs one session at a time. */
    private val executor = daemon("munim-ffmpeg")
    private val verifier = daemon("munim-ffmpeg-cancel")
  }
}

/**
 * What the module remembers about each session id. Whether an unfinished
 * session is queued, running or paused is asked of the scheduler and the
 * native core, which are the only places that know.
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
