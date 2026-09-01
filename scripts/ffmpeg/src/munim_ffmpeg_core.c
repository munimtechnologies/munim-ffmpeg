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

int munim_ffmpeg_execute_ctx(int argc, const char *const *argv,
                             const char *stdout_path, void *session)
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
        int saved = redirect_stdout(stdout_path);
        ret = ffmpeg_main(argc + 1, arguments);
        restore_stdout(saved);
        callback_context = default_context;
    }
    pthread_mutex_unlock(&execution_lock);

    free_arguments(arguments, argc + 1);
    return ret;
}

int munim_ffmpeg_execute(int argc, const char *const *argv,
                         const char *stdout_path)
{
    return munim_ffmpeg_execute_ctx(argc, argv, stdout_path, NULL);
}

int munim_ffmpeg_probe_ctx(int argc, const char *const *argv,
                           const char *output_path, void *session)
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
        ret = ffprobe_main(total, arguments);
        callback_context = default_context;
    }
    pthread_mutex_unlock(&execution_lock);

    free_arguments(arguments, total);
    return ret;
}

int munim_ffmpeg_probe(int argc, const char *const *argv,
                       const char *output_path)
{
    return munim_ffmpeg_probe_ctx(argc, argv, output_path, NULL);
}

void munim_ffmpeg_cancel(void)
{
    cancel_epoch++;
    munim_ffmpeg_hook_cancel();
}
