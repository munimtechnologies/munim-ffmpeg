# Building FFmpeg for munim-ffmpeg

These scripts build FFmpeg 9 and its non-GPL dependencies for iOS and Android,
then compile FFmpeg's own `fftools` (the real `ffmpeg` and `ffprobe` command-line
tools) so they can be called in-process instead of shelling out.

Nothing here is checked in as a binary: the outputs land in `ios/vendor/` and
`android/src/main/jniLibs/`, both git-ignored.

## Running a build

```bash
cd scripts/ffmpeg
curl -sLO https://ffmpeg.org/releases/ffmpeg-9.0.1.tar.xz && tar xf ffmpeg-9.0.1.tar.xz

./build-ios-libs.sh && ./build-ios-arm64.sh && ./build-ios-fftools.sh
./build-android-libs.sh && ./build-android-arm64.sh && ./build-fftools.sh
```

Requires the Android NDK (r27+), Xcode, and `meson`/`ninja` for dav1d.

## Why fftools rather than a wrapper library

FFmpegKit was retired in 2025 and pinned to FFmpeg 6.0. Rather than fork it,
these scripts compile upstream's own tools with a patch that is 41 lines long
(`fftools-hooks.sh`). FFmpeg 7 removed `exit_program()`, so the CLI now returns
error codes instead of terminating the process — which is what makes running it
inside an app viable.

## The patch, and why each piece exists

- **Cancellation and reset hooks** — `received_sigterm` and the per-run state are
  file-static, so they can only be reached from inside `ffmpeg.c`.
- **Counter reset** — `ffmpeg_cleanup()` frees `input_files`/`output_files` but
  leaves `nb_input_files` and friends set, so a second run walks freed memory.
- **`graphprint` stub** — `-print_graphs` pulls in an embedded HTML/CSS resource
  manager that is only generated when building the CLI binaries.
- **`ffprobe` reset** — it refuses a second `-o` and remembers the previous input.

## Platform notes worth keeping

- **Android**: `android_binder_threadpool_init_if_required()` aborts if the
  process already has a binder thread pool, which is always true inside an app,
  so it is stubbed out.
- **Android**: never pass libvpx `--disable-runtime-cpu-detect`; it bakes in
  instructions many devices lack and the VP9 encoder dies with `SIGILL`.
- **Both**: `-encoders`, `-protocols` and similar reports are printed to stdout
  rather than logged, so the core redirects stdout to a file for each run.
- **Both**: `-Dstrtod=avpriv_strtod` belongs to FFmpeg's own sources only.
- **iOS**: LAME 3.100 predates C99 and needs force-included headers at compile
  time — but not during `configure`, whose probes then fail.
