# Building FFmpeg for munim-ffmpeg

These scripts build FFmpeg 9 and its non-GPL dependencies for iOS and Android,
then compile FFmpeg's own `fftools` — the real `ffmpeg` and `ffprobe` — so they
can be called in-process instead of shelling out.

Nothing here is checked in as a binary. Builds land in `~/.munim-ffmpeg-build`
and are staged into `ios/MunimFFmpeg.xcframework` and
`android/src/main/jniLibs/`, both git-ignored, then bundled for release.

## Building everything

```bash
npm run binaries:build      # every architecture, ~40 minutes
npm run binaries:package    # bundles them and records the checksum
```

Or one target at a time:

```bash
./fetch-source.sh                        # downloads the FFmpeg release
./build-android.sh arm64-v8a             # or armeabi-v7a, x86_64
./build-ios.sh iphoneos arm64            # or iphonesimulator arm64|x86_64
./package.sh                             # xcframework + tarball + checksum
```

Requires the Android NDK (r27+), Xcode, and `meson`/`ninja` for dav1d. Override
defaults with `ANDROID_NDK`, `FFMPEG_VERSION`, `FFMPEG_WORKSPACE`, `MIN_IOS`.

## What ships

| | iOS | Android |
| --- | --- | --- |
| Architectures | arm64 device, arm64 + x86_64 simulator | arm64-v8a, armeabi-v7a, x86_64 |
| Hardware codecs | VideoToolbox, AudioToolbox | MediaCodec |
| TLS | SecureTransport | mbedTLS |
| External libraries | LAME, Opus, libvpx, dav1d, openh264, FreeType, FriBidi, HarfBuzz, libass | LAME, Opus, libvpx, dav1d, openh264, mbedTLS, FreeType, FriBidi, HarfBuzz, expat, fontconfig, libass |
| Subtitle fonts | Core Text | fontconfig over `/system/fonts` (fonts.conf written at runtime) |

No x264, x265, xvid or vid.stab: the package stays LGPL. H.264 and HEVC come
from the platform's hardware encoder, with openh264 (BSD) as a software H.264
fallback for environments where hardware encoding is unavailable.

## Why fftools rather than a wrapper library

FFmpegKit was retired in 2025 and pinned to FFmpeg 6.0. Rather than fork it,
these scripts compile upstream's own tools with a patch that is 41 lines long
(`fftools-hooks.sh`). FFmpeg 7 removed `exit_program()`, so the CLI returns
error codes instead of terminating the process — which is what makes running it
inside an app viable at all.

### The patch, and why each piece exists

- **Cancellation and reset hooks** — `received_sigterm` and the per-run state are
  file-static, so they can only be reached from inside `ffmpeg.c`.
- **Counter reset** — `ffmpeg_cleanup()` frees `input_files`/`output_files` but
  leaves `nb_input_files` and friends set, so a second run walks freed memory.
- **`graphprint` stub** — `-print_graphs` pulls in an embedded HTML/CSS resource
  manager that is only generated when building the CLI binaries.
- **`ffprobe` reset** — it refuses a second `-o` and remembers the previous input.

## Platform quirks these scripts work around

Each of these cost a debugging session; they are encoded in the scripts so they
do not have to be rediscovered.

- **Android**: `android_binder_threadpool_init_if_required()` aborts when the
  process already has a binder thread pool, which is always true inside an app,
  so it is stubbed out.
- **Android**: never pass libvpx `--disable-runtime-cpu-detect`; it bakes in
  instructions many devices lack and the VP9 encoder dies with `SIGILL`.
- **Android armeabi-v7a**: libvpx's `armv7-android-gcc` target passes
  `-march=armv7-a`, which NDK 27's clang rejects, so that ABI uses
  `generic-gnu`.
- **iOS simulator arm64**: libvpx has no simulator target and its `arm64-darwin`
  one builds against the macOS SDK, so that slice also uses `generic-gnu`.
- **Both**: FFmpeg's `configure` only finds the external libraries when
  `PKG_CONFIG_PATH` points at the staged prefix.
- **Both**: `-encoders`, `-protocols` and similar reports print to stdout rather
  than through the logger, so the core redirects stdout to a file for each run.
- **Both**: `-Dstrtod=avpriv_strtod` belongs to FFmpeg's own sources only —
  applying it to the core makes it reference a symbol it cannot link.
- **LAME 3.100**: predates C99 and needs force-included headers at compile time,
  but not during `configure`, whose probe programs then fail.
- **CocoaPods**: refuses an xcframework whose static libraries have differing
  binary names, so the simulator fat library is also `libmunimffmpeg.a`.
- **openh264** is C++, so FFmpeg needs `--extra-libs=-lc++_shared` on Android
  and `-lc++` on iOS, plus `--pkg-config-flags=--static` to pick up the
  dependency from its `.pc` file.

## Testing a build

The example app runs a 25-check suite covering encoding, muxing, trimming,
filters, FFprobe, cancellation and protocols. Run it on a physical device for
each platform; `npm run example:ios` and `npm run example:android` install it.

Two environments cannot validate everything:

- **Android emulators** have no working MediaCodec encoder: it reports success
  and writes no frames. The software H.264 check (`libopenh264`) passes there,
  the hardware ones do not.
- **x86_64 Android** cannot run on an Apple Silicon host at all — the emulator
  refuses non-native system images. Validate that ABI on an Intel or Linux
  machine, or statically: correct ELF architecture, four `Java_..._FFmpegNative`
  exports, only system libraries unresolved, and the same codec set as arm64.
- **Release APKs are not debuggable**, so `run-as` cannot read the suite's JSON
  result. On a `google_apis` emulator image, `adb root` then read
  `/data/data/<pkg>/files/` instead.

## Upgrading FFmpeg

```bash
FFMPEG_VERSION=9.1 npm run binaries:build
FFMPEG_VERSION=9.1 npm run binaries:package
```

Then re-check `fftools-hooks.sh`: the four hooks above are the only places
upstream changes can break the build. Update the version in `package.sh` and the
README tables, and run the example's device suite on both platforms.
