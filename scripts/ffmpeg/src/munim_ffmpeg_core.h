/*
 * Platform-neutral core for running FFmpeg 9's own command-line tools inside an
 * app process. The Android JNI bridge and the iOS Swift layer both sit on top
 * of this.
 */
#ifndef MUNIM_FFMPEG_CORE_H
#define MUNIM_FFMPEG_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*munim_log_callback)(void *context, const char *message);

typedef void (*munim_statistics_callback)(void *context, double time_ms,
                                          double size_bytes,
                                          double bitrate_kbits, double speed,
                                          double video_frame_number, double fps,
                                          double quality);

/** Version string of the linked FFmpeg, e.g. "9.0.1". */
const char *munim_ffmpeg_version(void);

/** Callbacks apply to whichever execution is currently running. */
void munim_ffmpeg_set_callbacks(munim_log_callback on_log,
                                munim_statistics_callback on_statistics,
                                void *context);

/**
 * Runs `ffmpeg` with the given arguments; `argv[0]` is supplied internally.
 *
 * `stdout_path` receives anything the tool prints rather than logs, such as the
 * `-encoders` and `-protocols` reports. Pass NULL to discard it.
 *
 * fftools keeps its parsed command in file-scope globals, so calls are
 * serialised: a second execution waits for the first to finish.
 */
int munim_ffmpeg_execute(int argc, const char *const *argv,
                         const char *stdout_path);

/** Runs `ffprobe`, writing its report to `output_path` via `-o`. */
int munim_ffmpeg_probe(int argc, const char *const *argv,
                       const char *output_path);

/**
 * Requests cancellation of the running execution, and of any execution already
 * queued behind it.
 */
void munim_ffmpeg_cancel(void);

/** Return code reported when a run was cancelled. */
#define MUNIM_FFMPEG_CANCELLED 255

#ifdef __cplusplus
}
#endif

#endif /* MUNIM_FFMPEG_CORE_H */
