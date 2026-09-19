#include "munim_ffmpeg_core.h"

#include <fcntl.h>
#include <pthread.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "libavutil/avutil.h"
#include "libavutil/log.h"
#include "libavutil/time.h"

/* Provided by FFmpeg's fftools, compiled with -Dmain=ffmpeg_main / ffprobe_main
 * plus the small hooks appended by the build script. */
extern int ffmpeg_main(int argc, char **argv);
extern int ffprobe_main(int argc, char **argv);
extern void munim_ffmpeg_hook_cancel(void);
extern void munim_ffmpeg_hook_reset(void);
extern void munim_ffprobe_hook_reset(void);

static pthread_mutex_t execution_lock = PTHREAD_MUTEX_INITIALIZER;

/* Bumped by every cancel so a run still queued behind the lock is cancelled
 * too, rather than starting after the user asked to stop. */
static volatile unsigned long cancel_epoch;

/*
 * Pause state, keyed by session id. `paused_sessions` holds every session the
 * caller paused, running or queued; `running_session` (0 = none) and
 * `running_epoch` identify the execution the fftools pause hook belongs to.
 */
#define MAX_PAUSED_SESSIONS 64
static pthread_mutex_t pause_lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t pause_changed = PTHREAD_COND_INITIALIZER;
static long long paused_sessions[MAX_PAUSED_SESSIONS];
static int nb_paused_sessions;
static long long running_session;
static unsigned long running_epoch;

static munim_log_callback log_callback_fn;
static munim_statistics_callback statistics_callback_fn;
static void *callback_context;

const char *munim_ffmpeg_version(void)
{
    return av_version_info();
}

void munim_ffmpeg_set_callbacks(munim_log_callback on_log,
                                munim_statistics_callback on_statistics,
                                void *context)
{
    log_callback_fn = on_log;
    statistics_callback_fn = on_statistics;
    callback_context = context;
}

static double field(const char *line, const char *key)
{
    const char *found = strstr(line, key);
    if (!found) return -1;
    found += strlen(key);
    while (*found == ' ' || *found == '=') found++;
    if (!strncmp(found, "N/A", 3)) return -1;
    return strtod(found, NULL);
}

/* Muxers report either "size=" or "Lsize=", with a unit suffix. */
static double size_bytes(const char *line)
{
    const char *found = strstr(line, "Lsize=");
    if (!found) found = strstr(line, "size=");
    if (!found) return -1;
    found = strchr(found, '=') + 1;
    while (*found == ' ') found++;
    if (!strncmp(found, "N/A", 3)) return -1;

    double value = strtod(found, NULL);
    if (strstr(found, "KiB")) return value * 1024;
    if (strstr(found, "MiB")) return value * 1024 * 1024;
    if (strstr(found, "GiB")) return value * 1024 * 1024 * 1024;
    return value;
}

static double time_ms(const char *line)
{
    const char *found = strstr(line, "time=");
    if (!found) return -1;
    found += 5;
    while (*found == ' ') found++;

    int hours = 0, minutes = 0;
    double seconds = 0;
    if (sscanf(found, "%d:%d:%lf", &hours, &minutes, &seconds) != 3) return -1;
    return ((hours * 3600) + (minutes * 60) + seconds) * 1000.0;
}

static void on_av_log(void *avcl, int level, const char *fmt, va_list args)
{
    char line[2048];

    if (level > av_log_get_level()) return;
    if (vsnprintf(line, sizeof(line), fmt, args) <= 0) return;

    /* ffmpeg reports progress by rewriting one line; parse it into statistics
     * rather than requiring callers to scrape logs. */
    if (statistics_callback_fn &&
        (strstr(line, "frame=") || (strstr(line, "size=") && strstr(line, "time=")))) {
        double ms = time_ms(line);
        if (ms >= 0) {
            statistics_callback_fn(callback_context, ms, size_bytes(line),
                                   field(line, "bitrate"), field(line, "speed"),
                                   field(line, "frame"), field(line, "fps"),
                                   field(line, "q"));
        }
    }

    if (log_callback_fn) log_callback_fn(callback_context, line);
}

static void install_log_handler(void)
{
    static int installed;
    if (installed) return;
    av_log_set_callback(on_av_log);
    installed = 1;
}

/*
 * fftools' -v/-loglevel writes the global libav log level and never restores
 * it, so one `-v error` probe would silence every later run's logs and
 * statistics. Each execution therefore starts from the default again.
 */
static void reset_log_level(void)
{
    av_log_set_level(AV_LOG_INFO);
}

/*
 * `-encoders`, `-protocols` and similar reports are printed rather than logged,
 * and stdout goes nowhere inside an app, so it is pointed at a file.
 */
static int redirect_stdout(const char *path)
{
    if (!path) return -1;

    int saved = dup(STDOUT_FILENO);
    int target = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (target < 0) return saved;

    dup2(target, STDOUT_FILENO);
    close(target);
    return saved;
}

static void restore_stdout(int saved)
{
    if (saved < 0) return;
    fflush(stdout);
    dup2(saved, STDOUT_FILENO);
    close(saved);
}

static char **copy_arguments(const char *program, int argc,
                             const char *const *argv, int extra)
{
    char **copy = calloc(argc + extra + 2, sizeof(char *));
    if (!copy) return NULL;

    copy[0] = strdup(program);
    for (int i = 0; i < argc; i++) copy[i + 1] = strdup(argv[i]);
    return copy;
}

static void free_arguments(char **argv, int count)
{
    for (int i = 0; i < count; i++) free(argv[i]);
    free(argv);
}

/* Callers hold pause_lock. */
static int paused_index(long long session)
{
    for (int i = 0; i < nb_paused_sessions; i++)
        if (paused_sessions[i] == session) return i;
    return -1;
}

static void forget_paused(long long session)
{
    int index = paused_index(session);
    if (index < 0) return;
    paused_sessions[index] = paused_sessions[--nb_paused_sessions];
}

int munim_ffmpeg_pause(long long session)
{
    if (session <= 0) return 0;
    pthread_mutex_lock(&pause_lock);
    if (paused_index(session) < 0 && nb_paused_sessions < MAX_PAUSED_SESSIONS)
        paused_sessions[nb_paused_sessions++] = session;
    int running = running_session == session;
    pthread_mutex_unlock(&pause_lock);
    return running;
}

int munim_ffmpeg_resume(long long session)
{
    if (session <= 0) return 0;
    pthread_mutex_lock(&pause_lock);
    int was_paused = paused_index(session) >= 0;
    forget_paused(session);
    pthread_cond_broadcast(&pause_changed);
    pthread_mutex_unlock(&pause_lock);
    return was_paused;
}

int munim_ffmpeg_is_paused(long long session)
{
    if (session <= 0) return 0;
    pthread_mutex_lock(&pause_lock);
    int paused = paused_index(session) >= 0;
    pthread_mutex_unlock(&pause_lock);
    return paused;
}

long long munim_ffmpeg_running_session(void)
{
    pthread_mutex_lock(&pause_lock);
    long long session = running_session;
    pthread_mutex_unlock(&pause_lock);
    return session;
}

/* Called by the patched fftools input and source-filter threads. */
int64_t munim_ffmpeg_hook_wait_while_paused(void)
{
    int64_t waited = 0;
    pthread_mutex_lock(&pause_lock);
    if (running_session && paused_index(running_session) >= 0 &&
        running_epoch == cancel_epoch) {
        int64_t started = av_gettime_relative();
        while (running_session && paused_index(running_session) >= 0 &&
               running_epoch == cancel_epoch)
            pthread_cond_wait(&pause_changed, &pause_lock);
        waited = av_gettime_relative() - started;
    }
    pthread_mutex_unlock(&pause_lock);
    return waited;
}

static void begin_running(long long session, unsigned long epoch)
{
    pthread_mutex_lock(&pause_lock);
    running_session = session;
    running_epoch = epoch;
    pthread_mutex_unlock(&pause_lock);
}

static void end_running(long long session)
{
    pthread_mutex_lock(&pause_lock);
    running_session = 0;
    forget_paused(session);
    pthread_cond_broadcast(&pause_changed);
    pthread_mutex_unlock(&pause_lock);
}

int munim_ffmpeg_execute_session(int argc, const char *const *argv,
                                 const char *stdout_path, void *session,
                                 long long session_id)
{
    unsigned long epoch = cancel_epoch;
    char **arguments = copy_arguments("ffmpeg", argc, argv, 0);
    if (!arguments) return -1;

    install_log_handler();

    pthread_mutex_lock(&execution_lock);
    int ret;
    if (cancel_epoch != epoch) {
        ret = MUNIM_FFMPEG_CANCELLED;
    } else {
        /* The context switches inside the lock, so callbacks always belong to
         * the execution that is actually running, never to one still queued. */
        void *default_context = callback_context;
        if (session) callback_context = session;
        munim_ffmpeg_hook_reset();
        reset_log_level();
        begin_running(session_id, epoch);
        int saved = redirect_stdout(stdout_path);
        ret = ffmpeg_main(argc + 1, arguments);
        restore_stdout(saved);
        end_running(session_id);
        callback_context = default_context;
    }
    pthread_mutex_unlock(&execution_lock);

    free_arguments(arguments, argc + 1);
    return ret;
}

int munim_ffmpeg_execute_ctx(int argc, const char *const *argv,
                             const char *stdout_path, void *session)
{
    return munim_ffmpeg_execute_session(argc, argv, stdout_path, session, 0);
}

int munim_ffmpeg_execute(int argc, const char *const *argv,
                         const char *stdout_path)
{
    return munim_ffmpeg_execute_ctx(argc, argv, stdout_path, NULL);
}

int munim_ffmpeg_probe_session(int argc, const char *const *argv,
                               const char *output_path, void *session,
                               long long session_id)
{
    unsigned long epoch = cancel_epoch;
    char **arguments = copy_arguments("ffprobe", argc, argv, 2);
    if (!arguments) return -1;

    int total = argc + 1;
    if (output_path) {
        arguments[total++] = strdup("-o");
        arguments[total++] = strdup(output_path);
    }

    install_log_handler();

    pthread_mutex_lock(&execution_lock);
    int ret;
    if (cancel_epoch != epoch) {
        ret = MUNIM_FFMPEG_CANCELLED;
    } else {
        void *default_context = callback_context;
        if (session) callback_context = session;
        munim_ffprobe_hook_reset();
        reset_log_level();
        begin_running(session_id, epoch);
        ret = ffprobe_main(total, arguments);
        end_running(session_id);
        callback_context = default_context;
    }
    pthread_mutex_unlock(&execution_lock);

    free_arguments(arguments, total);
    return ret;
}

int munim_ffmpeg_probe_ctx(int argc, const char *const *argv,
                           const char *output_path, void *session)
{
    return munim_ffmpeg_probe_session(argc, argv, output_path, session, 0);
}

int munim_ffmpeg_probe(int argc, const char *const *argv,
                       const char *output_path)
{
    return munim_ffmpeg_probe_ctx(argc, argv, output_path, NULL);
}

void munim_ffmpeg_cancel(void)
{
    pthread_mutex_lock(&pause_lock);
    cancel_epoch++;
    /* Cancelling also clears every pause, so a queued session that was paused
     * does not linger in the list. */
    nb_paused_sessions = 0;
    pthread_cond_broadcast(&pause_changed);
    pthread_mutex_unlock(&pause_lock);
    munim_ffmpeg_hook_cancel();
}
