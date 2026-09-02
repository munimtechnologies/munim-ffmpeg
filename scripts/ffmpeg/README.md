# Building FFmpeg for munim-ffmpeg

These scripts build FFmpeg 9 and its non-GPL dependencies for iOS and Android,
then compile FFmpeg's own `fftools` — the real `ffmpeg` and `ffprobe` — so they
can be called in-process instead of shelling out.

Nothing here is checked in as a binary. Builds land in `~/.munim-ffmpeg-build`
and are staged into `ios/MunimFFmpeg.xcframework` and
`android/src/main/jniLibs/`, both git-ignored, then bundled for release.

Each platform ships **one library**: `libmunimffmpeg.a` inside the xcframework
on iOS, and `libmunimffmpeg.so` per ABI on Android. FFmpeg, fftools, the core
and every external library are linked in statically; the only runtime
dependencies are the system libraries and, on Android, the `libc++_shared.so`
React Native already bundles.

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

Requires the Android NDK (r27+), Xcode, `cmake`, `meson`/`ninja`, `nasm`/`yasm`
and `gperf`. Override defaults with `ANDROID_NDK`, `FFMPEG_VERSION`,
`FFMPEG_WORKSPACE`, `MIN_IOS`. The Android scripts also run on Linux, which is
how CI builds them.

## Building in GitHub Actions

[`build-binaries.yml`](../../.github/workflows/build-binaries.yml) builds every
slice in parallel — Android on Linux runners, iOS on macOS — then runs
`package.sh` on the merged output, exactly as a local build would. It runs on
pull requests that touch this directory, and by hand from the Actions tab with
two inputs:

- `ffmpeg_version` — the release to build (default `9.0.1`).
- `release_tag` — if set, the bundle and `build-info.txt` are attached to that
  GitHub release with `--clobber`.

Every run uploads a `munim-ffmpeg-binaries` artifact containing the archive,
its checksum, `build-info.txt`, and the matching `scripts/binaries.json`. To
release from a CI build rather than a local one, download that artifact, place
the archive in `dist-binaries/`, commit its `scripts/binaries.json`, and run
`npm run release:local` — the checksum in the manifest has to be the checksum
of the archive that ends up on the release, so never mix the two.

`build-info.txt` records, per slice, the exact `configure` line and FFmpeg's
own summary of enabled libraries, encoders, decoders, muxers, demuxers,
filters and protocols.

## What ships

|                    | iOS                                                                              | Android                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Architectures      | arm64 device, arm64 + x86_64 simulator                                           | arm64-v8a, armeabi-v7a, x86_64                                                                               |
| Hardware codecs    | VideoToolbox, AudioToolbox                                                       | MediaCodec                                                                                                   |
| TLS                | SecureTransport                                                                  | mbedTLS                                                                                                      |
| External libraries | LAME, Opus, libvpx, dav1d, libaom, openh264, FreeType, FriBidi, HarfBuzz, libass | LAME, Opus, libvpx, dav1d, libaom, openh264, mbedTLS, FreeType, FriBidi, HarfBuzz, expat, fontconfig, libass |
| Ships as           | `MunimFFmpeg.xcframework` (one static library per platform slice)                | `libmunimffmpeg.so` per ABI                                                                                  |
| Subtitle fonts     | Core Text                                                                        | fontconfig over `/system/fonts` (fonts.conf written at runtime)                                              |

No x264, x265, xvid or vid.stab: the package stays LGPL. H.264 and HEVC come
from the platform's hardware encoder, with openh264 (BSD) as a software H.264
fallback for environments where hardware encoding is unavailable.

AV1 is split: dav1d decodes (faster than libaom's decoder) and libaom encodes,
which is what makes AVIF images writable. libaom is built encoder-only and
FFmpeg's `libaom_av1` decoder is disabled so nothing is linked twice.

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
  but not during `configure`, whose probe programs then fail. Its `sed -i`
  edit uses `-i.bak` because GNU and BSD sed disagree on the in-place syntax,
  and CI builds Android on Linux.
- **CocoaPods**: refuses an xcframework whose static libraries have differing
  binary names, so the simulator fat library is also `libmunimffmpeg.a`.
- **Android single library**: `ffprobe.c` defines `program_name`, `program_birth_year` and
  `show_help_default` just like `ffmpeg.c`, so its copies are renamed with `-D`
  and both tools share one `cmdutils`. The link line comes from
  `pkg-config --static` over FFmpeg's `.pc` files, and a version script
  exports only `JNI_OnLoad` and the `Java_*` entry points.
- **libaom on iOS**: ships toolchains for the device and the x86_64 simulator
  only, so `build-ios.sh` writes its own for all three slices; SVE is disabled
  because Apple's clang rejects the flags.
- **openh264** is C++, so FFmpeg needs `--extra-libs=-lc++_shared` on Android
  and `-lc++` on iOS, plus `--pkg-config-flags=--static` to pick up the
  dependency from its `.pc` file.

## Testing a build

The example app runs a 30+-check suite covering encoding, muxing, trimming,
filters, subtitles, AVIF, FFprobe, cancellation and protocols. Run it on a physical device for
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
