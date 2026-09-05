<p align="center">
  <a href="https://github.com/munimtechnologies/munim-ffmpeg">
    <img alt="Munim Technologies" height="128" src="https://raw.githubusercontent.com/munimtechnologies/munim-ffmpeg/main/.github/resources/banner.png?v=1" />
    <h1 align="center">munim-ffmpeg</h1>
  </a>
</p>

<p align="center">
  <a aria-label="Package version" href="https://www.npmjs.com/package/munim-ffmpeg">
    <img alt="Package version" src="https://img.shields.io/npm/v/munim-ffmpeg.svg?style=flat-square&label=Version&labelColor=000000&color=0066CC" />
  </a>
  <a aria-label="Package is free to use" href="https://github.com/munimtechnologies/munim-ffmpeg/blob/main/LICENSE">
    <img alt="License: Apache-2.0" src="https://img.shields.io/badge/License-Apache%202.0-success.svg?style=flat-square&color=33CC12" />
  </a>
  <a aria-label="Monthly package downloads" href="https://www.npmtrends.com/munim-ffmpeg">
    <img alt="Monthly downloads" src="https://img.shields.io/npm/dm/munim-ffmpeg.svg?style=flat-square&labelColor=gray&color=33CC12&label=Downloads" />
  </a>
  <a aria-label="Total package downloads" href="https://www.npmjs.com/package/munim-ffmpeg">
    <img alt="Total downloads" src="https://img.shields.io/npm/dt/munim-ffmpeg.svg?style=flat-square&labelColor=gray&color=0066CC&label=Total%20Downloads" />
  </a>
  <a aria-label="Expo development builds" href="https://docs.expo.dev/develop/development-builds/introduction/">
    <img alt="Expo development builds" src="https://img.shields.io/badge/Expo-Development%20Build-000020?style=flat-square&logo=expo&logoColor=white" />
  </a>
  <a aria-label="iOS 15.1 or newer" href="https://developer.apple.com/ios/">
    <img alt="iOS 15.1+" src="https://img.shields.io/badge/iOS-15.1%2B-000000?style=flat-square&logo=apple&logoColor=white" />
  </a>
  <a aria-label="Android API 24 or newer" href="https://developer.android.com/">
    <img alt="Android API 24+" src="https://img.shields.io/badge/Android-API%2024%2B-3DDC84?style=flat-square&logo=android&logoColor=white" />
  </a>
  <a aria-label="Powered by Nitro Modules" href="https://nitro.margelo.com/">
    <img alt="Nitro Modules 0.36.5+" src="https://img.shields.io/badge/Nitro%20Modules-0.36.5%2B-7C3AED?style=flat-square" />
  </a>
</p>

<p align="center">
  <a aria-label="Works with Expo" href="https://docs.expo.dev/develop/development-builds/introduction/"><b>Works with Expo development builds</b></a>
  &ensp;•&ensp;
  <a aria-label="Documentation" href="https://www.munimtech.com/opensource/munim-ffmpeg">Read the Documentation</a>
  &ensp;•&ensp;
  <a aria-label="Report issues" href="https://github.com/munimtechnologies/munim-ffmpeg/issues">Report Issues</a>
</p>

<h6 align="center">Follow Munim Technologies</h6>
<p align="center">
  <a aria-label="Munim Technologies on GitHub" href="https://github.com/munimtechnologies">
    <img alt="Munim Technologies on GitHub" src="https://img.shields.io/badge/GitHub-222222?style=for-the-badge&logo=github&logoColor=white" />
  </a>&nbsp;
  <a aria-label="Munim Technologies on LinkedIn" href="https://linkedin.com/in/sheehanmunim">
    <img alt="Munim Technologies on LinkedIn" src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" />
  </a>&nbsp;
  <a aria-label="Munim Technologies website" href="https://www.munimtech.com">
    <img alt="Munim Technologies website" src="https://img.shields.io/badge/Website-0066CC?style=for-the-badge&logo=googlechrome&logoColor=white" />
  </a>
</p>

## Introduction

**munim-ffmpeg** provides fast, typed FFmpeg and FFprobe access for Expo and React Native. It executes argument arrays directly through native FFmpeg libraries, streams logs and encoding statistics to JavaScript, returns structured session results, inspects media with FFprobe, and cancels one running session or every active session.

**Built with React Native Nitro Modules.** One TypeScript specification generates the C++, Swift, and Kotlin bindings used by the package.

**Designed for Expo development builds and bare React Native.** This package contains native code and cannot run in Expo Go.

> **Licensing note:** The JavaScript, Swift, Kotlin, and Nitro bridge are Apache-2.0. The bundled FFmpeg is **LGPLv3** on both platforms — it deliberately excludes x264, x265, and xvid, so your app does not inherit GPL obligations. See [Licensing](#licensing).

## Table of contents

- [📚 Documentation](#-documentation)
- [🚀 Features](#-features)
- [Platform support matrix](#platform-support-matrix)
- [Where this is verified](#where-this-is-verified)
- [Bundled FFmpeg builds](#bundled-ffmpeg-builds)
- [📦 Installation](#-installation)
- [Working with media paths](#working-with-media-paths)
- [⚡ Quick start](#-quick-start)
- [🔧 API reference](#-api-reference)
- [📖 Usage examples](#-usage-examples)
- [Licensing](#licensing)
- [🔍 Troubleshooting](#-troubleshooting)
- [Development](#development)
- [👏 Contributing](#-contributing)
- [📄 License](#-license)

## 📚 Documentation

- [Munim Technologies package documentation](https://www.munimtech.com/opensource/munim-ffmpeg)
- [Installation](#-installation)
- [API reference](#-api-reference)
- [Usage examples](#-usage-examples)
- [Troubleshooting](#-troubleshooting)

## 🚀 Features

### FFmpeg execution

- 🎬 **Argument-array commands:** FFmpeg's own CLI code paths, without shell parsing or quoting
- 🆕 **FFmpeg 9.0.1:** The current upstream release, identical on both platforms
- ⚡ **Asynchronous sessions:** Keep the React Native thread responsive during native work
- 📝 **Live logs:** Receive FFmpeg output as it is produced
- 📈 **Encoding statistics:** Track time, size, bitrate, speed, frames, FPS, and quality
- 🎯 **Targeted cancellation:** Capture a native session ID immediately and cancel only that command
- 🛑 **Global cancellation:** Stop all active sessions during workflow or screen cleanup

### FFprobe and media inspection

- 🔎 **FFprobe execution:** Run custom probing commands with the same typed session result
- 🧾 **Parsed media information:** Inspect format, streams, chapters, codecs, duration, and metadata as JSON
- ✅ **Structured completion:** Read return code, state, duration, output, cancellation state, and failure details

### React Native integration

- 📱 **iOS and Android:** Native implementations in Swift and Kotlin
- 🧬 **Nitro Modules:** Generated high-performance native bindings
- 🚀 **Expo compatible:** Autolinking, config plugin, and an Expo development example
- 🧪 **Capability discovery:** Ask the bundled build which encoders, decoders, muxers, demuxers, filters, and protocols it actually has
- 💬 **Subtitle burn-in:** libass renders ASS/SSA and SRT subtitles — styling, positioning, outlines, shadows, and proper Arabic/Urdu shaping via HarfBuzz and FriBidi
- 📎 **Soft subtitle embedding:** Mux SRT/ASS tracks into MKV or MP4 so players can toggle them without re-encoding the video
- 🖼️ **AVIF and AV1:** libaom encodes AV1 video and AVIF stills, dav1d decodes them
- 📦 **One native library per platform:** a single `libmunimffmpeg.so` per Android ABI and one static library in the iOS xcframework, so nothing else has to be linked, loaded, or packaged
- 🎯 **TypeScript:** Complete public callback and result types
- 🗂️ **16 KB Android pages:** Built with the alignment Google Play requires

## Platform support matrix

| Capability                   | iOS          | Android    | Notes                                                                                                                                                                   |
| ---------------------------- | ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FFmpeg argument execution    | ✅           | ✅         | Commands run asynchronously through the native compatibility library.                                                                                                   |
| FFprobe argument execution   | ✅           | ✅         | Custom FFprobe arguments return `FFmpegSessionResult`.                                                                                                                  |
| Parsed media information     | ✅           | ✅         | `getMediaInformation()` returns typed, parsed FFprobe JSON.                                                                                                                    |
| Log callback                 | ✅           | ✅         | Logs are delivered while a session is active.                                                                                                                           |
| Encoding-statistics callback | ✅           | ✅         | Available for FFmpeg execution.                                                                                                                                         |
| Immediate session ID         | ✅           | ✅         | `onSessionCreated` fires after the native session is created.                                                                                                           |
| Cancel one FFmpeg session    | ✅           | ✅         | Pass the positive safe-integer ID received by `execute`'s `onSessionCreated`. The native dependency does not expose FFprobe cancellation.                               |
| Cancel all FFmpeg sessions   | ✅           | ✅         | Use `cancelAll()` or call `cancel()` without an ID.                                                                                                                     |
| Expo Go                      | ❌           | ❌         | A native development build is required.                                                                                                                                 |
| Capability discovery         | ✅           | ✅         | `listEncoders()`, `listDecoders()`, `listMuxers()`, `listDemuxers()`, `listFilters()`, `listProtocols()`, and `pickEncoder()` report what the bundled build supports.   |
| Subtitle burn-in             | ✅           | ✅         | libass with system fonts: Core Text on iOS, fontconfig over `/system/fonts` on Android.                                                                                 |
| H.264 encoding               | VideoToolbox | MediaCodec | Hardware on both, `libopenh264` as the software fallback; use `pickEncoder(['h264_videotoolbox', 'h264_mediacodec', 'libopenh264'])` instead of hard-coding an encoder. |
| Remote HTTP(S) inputs        | ✅           | ✅         | iOS links SecureTransport, Android links mbedTLS. Remote server behaviour still varies; prefer local files for predictable app workflows.                               |
| Soft subtitle embedding      | ✅           | ✅         | Mux SRT/ASS as toggleable tracks (MKV: `srt`/`ass`, MP4: `mov_text`).                                                                                                   |
| AVIF / AV1 encoding          | ✅           | ✅         | `libaom-av1` encodes (add `-still-picture 1 -f avif` for images); `libdav1d` decodes.                                                                                   |

Codec availability is determined by the native FFmpeg builds described in [Bundled FFmpeg builds](#bundled-ffmpeg-builds). Do not assume every FFmpeg codec or external library is present.

## Where this is verified

Every release runs the example's 25-check device suite. For 0.4.x:

| Target                     | Result                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| iPad Air (M3), iOS 26      | 25/25                                                            |
| iOS Simulator, arm64       | 25/25                                                            |
| Galaxy A14 5G, arm64-v8a   | 25/25                                                            |
| Android emulator, arm64    | Software encoding passes; hardware encoding does not — see below |
| Android emulator, `x86_64` | Same: `libopenh264` passes, MediaCodec does not                  |
| Android `armeabi-v7a`      | Built and statically checked, not executed                       |

`x86_64` was verified on an Intel Windows machine, since the Android emulator refuses non-native system images on Apple Silicon: FFmpeg 9.0.1, 185 encoders, and the software H.264 encode passes. `armeabi-v7a` has no hardware to hand, so it was checked statically instead — correct ELF architecture, the expected JNI exports, only system libraries unresolved, and the same FFmpeg and codec set as arm64.

### Android emulators cannot encode video

An Android emulator has no working MediaCodec **encoder**. `h264_mediacodec` and `hevc_mediacodec` report success and produce a file containing no frames, so anything downstream of an encode fails. Everything else — audio encoding, filters, FFprobe, muxing, cancellation, protocols — works normally there.

This is an emulator limitation, not a package one, but it is worth knowing before debugging: **test video encoding on a physical device**.

`pickEncoder` cannot detect it, because MediaCodec _is_ present in an emulator — it just does not work. When you need encoding to succeed regardless of environment, ask for the software encoder by name:

```typescript
// Deterministic anywhere: emulators, CI, older devices.
await execute([
  '-y',
  '-i',
  input,
  '-c:v',
  'libopenh264',
  '-pix_fmt',
  'yuv420p',
  output,
])
```

`libopenh264`, `mpeg4` and `libvpx-vp9` are all software encoders and work everywhere.

## Bundled FFmpeg builds

Both platforms run **FFmpeg 9.0.1**, built from [ffmpeg.org](https://www.ffmpeg.org/) by the scripts in [`scripts/ffmpeg/`](./scripts/ffmpeg). There is no FFmpegKit here: that project was retired in 2025 and pinned to FFmpeg 6.0.

|                 | iOS                                                     | Android                         |
| --------------- | ------------------------------------------------------- | ------------------------------- |
| FFmpeg          | 9.0.1                                                   | 9.0.1                           |
| Architectures   | arm64 device, arm64 + x86_64 simulator                  | arm64-v8a, armeabi-v7a, x86_64  |
| Hardware codecs | VideoToolbox, AudioToolbox                              | MediaCodec                      |
| TLS             | SecureTransport                                         | mbedTLS                         |
| Minimum         | iOS 15.1                                                | API 24, 16 KB pages             |
| Ships as        | `MunimFFmpeg.xcframework`, one static library per slice | one `libmunimffmpeg.so` per ABI |

Linked libraries, identical on both: **LAME** (MP3), **Opus**, **libvpx** (VP8/VP9), **dav1d** (AV1 decoding), **libaom** (AV1 and AVIF encoding), **openh264** (software H.264), **libass** with **FreeType**, **HarfBuzz**, and **FriBidi** (subtitle rendering and text shaping), plus everything FFmpeg builds natively. Android additionally links **fontconfig** and **expat** so libass can discover the system fonts; iOS uses Core Text for the same job.

FFmpeg's own `ffmpeg` and `ffprobe` tools are compiled to run inside your app process, so the argument arrays you pass are handled by the real command-line code paths rather than a reimplementation.

Everything above is linked statically into a single library per platform: FFmpeg, both tools, the core, and every external library. On Android that is one `libmunimffmpeg.so` per ABI whose only dependencies are the system libraries and the `libc++_shared.so` React Native already bundles; on iOS it is one static library per slice inside `MunimFFmpeg.xcframework`. Only the JNI entry points are exported on Android, so the bundled FFmpeg cannot collide with another copy an app might carry.

### Encoders

Verified by running the example's device suite: iOS reports 187 encoders, Android 185. Everything FFmpeg builds natively (`aac`, `alac`, `flac`, `mpeg4`, `mjpeg`, `png`, `gif`, `pcm_*`, …) is on both, as are `libmp3lame`, `libopus`, `libvpx`, and `libvpx-vp9`.

H.264 and HEVC come from the platform's hardware encoder, which is faster and uses less power than a software encoder. `libopenh264` is there as a software H.264 fallback for anywhere hardware encoding is unavailable — an emulator, for instance:

| Encoder                                                                  | iOS | Android |
| ------------------------------------------------------------------------ | --- | ------- |
| `h264_videotoolbox`, `hevc_videotoolbox`, `prores_videotoolbox`          | ✅  | ❌      |
| `h264_mediacodec`, `hevc_mediacodec`, `vp8_mediacodec`, `vp9_mediacodec` | ❌  | ✅      |
| `aac_at`, `alac_at` (AudioToolbox)                                       | ✅  | ❌      |
| `libopenh264` (H.264, software)                                          | ✅  | ✅      |
| `libaom-av1` (AV1, software; AVIF stills)                                | ✅  | ✅      |

Resolve the name at runtime instead of branching on `Platform.OS`:

```typescript
import { execute, pickEncoder } from 'munim-ffmpeg'

// Hardware first, software as the fallback.
const h264 = await pickEncoder([
  'h264_videotoolbox',
  'h264_mediacodec',
  'libopenh264',
])
if (!h264) throw new Error('No H.264 encoder in this build')

await execute(['-y', '-i', inputPath, '-c:v', h264, outputPath])
```

Two things to know about hardware encoders: they want NV12 input on Android (`-pix_fmt nv12`) and planar YUV on iOS, and they reject very small frames — 176×144 is the smallest size that works everywhere.

Decoding is uniform: H.264, HEVC, VP8/VP9, AV1 (via dav1d, including AVIF images), MPEG-4, MP3, AAC, Vorbis, Opus, FLAC and the usual containers, on both platforms. Both link TLS, so `https://` inputs work.

## 📦 Installation

### React Native CLI

```bash
npm install munim-ffmpeg react-native-nitro-modules
# or
yarn add munim-ffmpeg react-native-nitro-modules
```

Install iOS pods after adding the dependency:

```bash
cd ios
pod install
cd ..
```

FFmpeg and React Native both provide `libc++_shared.so`. Resolve that duplicate in the Android application module:

```groovy
android {
  packagingOptions {
    jniLibs {
      pickFirsts += ['**/libc++_shared.so']
    }
  }
}
```

### Expo

```bash
npx expo install munim-ffmpeg react-native-nitro-modules
```

The package includes an Expo config plugin. If your project manages its plugin list explicitly, add it to `app.json`:

```json
{
  "expo": {
    "plugins": ["munim-ffmpeg"]
  }
}
```

The plugin also configures Android to select one shared C++ runtime when React Native and FFmpeg contribute the same `libc++_shared.so` path.

Create a native development build after installation:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

You can also create an [EAS development build](https://docs.expo.dev/develop/development-builds/create-a-build/).

> **Important:** `munim-ffmpeg` cannot run in Expo Go because Expo Go does not include this package's native libraries.

### Native binaries

The FFmpeg libraries are well over 100 MB across all six architectures, which does not belong in an npm tarball, so they are downloaded from the matching GitHub release when the package installs and verified against the checksum in `scripts/binaries.json`.

If your environment blocks install scripts (`npm install --ignore-scripts`), fetch them explicitly:

```bash
npx munim-ffmpeg-fetch-binaries
```

Behind a proxy or an air-gapped mirror, point the fetcher somewhere else:

```bash
MUNIM_FFMPEG_BINARIES_URL=https://internal.example.com/munim-ffmpeg-binaries.tar.gz \
  npx munim-ffmpeg-fetch-binaries
```

Or build them yourself — see [`scripts/ffmpeg/README.md`](./scripts/ffmpeg/README.md).

### Requirements

- React Native with the New Architecture enabled
- `react-native-nitro-modules` 0.36.5 or newer
- iOS 15.1 or newer
- Android API 24 or newer
- An Expo development build or bare React Native app

No camera, microphone, photo-library, or storage permission is added automatically. Declare only the permissions required by the locations and capture APIs your application uses.

## Working with media paths

FFmpeg runs natively and needs a path or URI the native process can access.

- Prefer files inside your app's document, cache, or temporary directory.
- `file://` URIs and plain local paths both work. The package strips the `file://` scheme and percent-decoding for you, so a path containing spaces or non-ASCII characters is handled correctly; passing the raw URI straight to FFmpeg would write to a file literally named `my%20clip.mp4`.
- On Android, copy a `content://` document into application storage before processing when the native library cannot open it directly.
- Copy photo-library or document-picker assets when the provider gives temporary or security-scoped access.
- Ensure the output directory already exists.
- Use a unique output filename or pass `-y` when replacing an existing file is intentional.
- Do not include the `ffmpeg` or `ffprobe` executable name in the argument array.

## ⚡ Quick start

```typescript
import {
  cancel,
  execute,
  getFFmpegVersion,
  getMediaInformation,
  probe,
} from 'munim-ffmpeg'

console.log('FFmpeg:', getFFmpegVersion())

let activeSessionId: number | undefined

const execution = execute(
  ['-y', '-i', inputPath, '-c:v', 'mpeg4', '-c:a', 'aac', outputPath],
  (message) => console.log(message),
  (timeMs, sizeBytes, bitrateKbits, speed, frame, fps, quality) => {
    console.log({
      timeMs,
      sizeBytes,
      bitrateKbits,
      speed,
      frame,
      fps,
      quality,
    })
  },
  (sessionId) => {
    activeSessionId = sessionId
  }
)

// Call this from a cancel button while the command is running.
if (activeSessionId !== undefined) {
  cancel(activeSessionId)
}

const result = await execution

if (!result.success && !result.cancelled) {
  throw new Error(result.failStackTrace ?? result.output)
}

const probeResult = await probe([
  '-v',
  'error',
  '-show_format',
  '-show_streams',
  inputPath,
])

const mediaInformation = await getMediaInformation(inputPath)
```

## 🔧 API reference

### `execute(arguments, onLog?, onStatistics?, onSessionCreated?)`

Starts an asynchronous FFmpeg session.

```typescript
function execute(
  arguments_: string[],
  onLog?: (message: string) => void,
  onStatistics?: (
    timeMs: number,
    sizeBytes: number,
    bitrateKbits: number,
    speed: number,
    videoFrameNumber: number,
    fps: number,
    quality: number
  ) => void,
  onSessionCreated?: (sessionId: number) => void
): Promise<FFmpegSessionResult>
```

The `onSessionCreated` callback receives the ID before the command completes, allowing targeted cancellation while work is running.

### `probe(arguments, onLog?, onSessionCreated?)`

Starts an asynchronous FFprobe session.

```typescript
function probe(
  arguments_: string[],
  onLog?: (message: string) => void,
  onSessionCreated?: (sessionId: number) => void
): Promise<FFmpegSessionResult>
```

`onSessionCreated` can be used to correlate the native probe session with its eventual result. The bundled native dependency does not expose FFprobe cancellation.

### `getMediaInformation(path)`

Runs FFprobe for the format, streams, and chapters at a local media path, then parses its JSON response.

```typescript
function getMediaInformation(path: string): Promise<MediaInformation>
```

`MediaInformation` types the `format`, `streams`, and `chapters` sections of FFprobe's report. Every field is optional because FFprobe only prints what the container exposes, and numeric values such as `duration` and `bit_rate` arrive as strings, exactly as FFprobe prints them. Unknown keys are preserved under an index signature.

```typescript
const info = await getMediaInformation(inputPath)
const video = info.streams?.find((stream) => stream.codec_type === 'video')
console.log(video?.width, video?.height, info.format?.duration)
```

### `getMediaDuration(information)`

Reads the duration in seconds from a `MediaInformation` report, falling back to the first stream that reports one. Returns `undefined` when FFprobe did not report a duration (live inputs, some raw streams).

```typescript
function getMediaDuration(information: MediaInformation): number | undefined
```

### `cancel(sessionId?)`

Cancels the given native FFmpeg execution session. Calling `cancel()` without an ID cancels all active FFmpeg sessions. FFprobe cancellation is not exposed by the bundled native dependency.

```typescript
function cancel(sessionId?: number): void
```

Session IDs must be positive safe integers received from `onSessionCreated` or `FFmpegSessionResult`.

### `cancelAll()`

Cancels every active FFmpeg session.

```typescript
function cancelAll(): void
```

### `getFFmpegVersion()`

Returns the version reported by the bundled native FFmpeg library.

```typescript
function getFFmpegVersion(): string
```

### `listEncoders()`

Returns the encoder names the bundled FFmpeg build can write. The result is cached after the first call.

```typescript
function listEncoders(): Promise<string[]>
```

### `listDecoders()`

Returns the decoder names the bundled FFmpeg build can read.

```typescript
function listDecoders(): Promise<string[]>
```

### `listMuxers()` / `listDemuxers()`

Return the container formats the bundled FFmpeg build can write and read, e.g. `mp4`, `matroska`, `webm`. Cached after the first call.

```typescript
function listMuxers(): Promise<string[]>
function listDemuxers(): Promise<string[]>
```

### `listFilters()`

Returns the filter names the bundled FFmpeg build provides, e.g. `subtitles`, `ass`, `drawtext`, `scale`.

```typescript
function listFilters(): Promise<string[]>
```

### `listProtocols()`

Returns the protocol names the bundled FFmpeg build provides, e.g. `file`, `https`, `concat`.

```typescript
function listProtocols(): Promise<string[]>
```

### `pickEncoder(candidates)`

Returns the first name in `candidates` that the build provides, or `undefined` when none are available. Use it to write one command that runs on both platforms.

```typescript
function pickEncoder(candidates: string[]): Promise<string | undefined>
```

```typescript
const hevc = await pickEncoder(['libx265', 'hevc_videotoolbox'])
```

### `normalizePath(value)`

Converts a `file://` URI into the plain path FFmpeg expects, and returns anything else untouched.

```typescript
function normalizePath(value: string): string
```

`execute()`, `probe()`, and `getMediaInformation()` already apply this to every argument, so you rarely need to call it directly. It is exported for cases where you build a path yourself — a concat list file, for example, whose entries FFmpeg reads verbatim.

### `FFmpegSessionResult`

```typescript
type FFmpegSessionResult = {
  sessionId: number
  returnCode: number
  success: boolean
  cancelled: boolean
  state: string
  durationMs: number
  output: string
  failStackTrace?: string
}
```

`state` is one of `created`, `running`, `failed`, or `completed`, and reports the same values on both platforms.

Always check `success` or `cancelled`; Promise resolution means the native session completed, not necessarily that FFmpeg returned a success code.

## 📖 Usage examples

### Inspect media metadata

```typescript
import { getMediaInformation } from 'munim-ffmpeg'

const information = await getMediaInformation(inputPath)
console.log(JSON.stringify(information, null, 2))
```

### Extract an audio track

```typescript
import { execute } from 'munim-ffmpeg'

const result = await execute([
  '-y',
  '-i',
  inputPath,
  '-vn',
  '-c:a',
  'aac',
  outputAudioPath,
])

if (!result.success) {
  throw new Error(result.failStackTrace ?? result.output)
}
```

### Transcode to H.264 on both platforms

```typescript
import { execute, pickEncoder } from 'munim-ffmpeg'

const encoder = await pickEncoder([
  'h264_videotoolbox',
  'h264_mediacodec',
  'libopenh264',
])
if (!encoder) throw new Error('No H.264 encoder available in this build')

// MediaCodec wants NV12 input; the others take planar YUV.
const pixelFormat = encoder === 'h264_mediacodec' ? 'nv12' : 'yuv420p'
const quality = ['-b:v', '2M', '-pix_fmt', pixelFormat]

const result = await execute([
  '-y',
  '-i',
  inputPath,
  '-c:v',
  encoder,
  ...quality,
  '-c:a',
  'aac',
  '-pix_fmt',
  'yuv420p',
  outputPath,
])

if (!result.success) throw new Error(result.failStackTrace ?? result.output)
```

### Generate a thumbnail

```typescript
import { execute } from 'munim-ffmpeg'

const result = await execute([
  '-y',
  '-ss',
  '00:00:01.000',
  '-i',
  inputPath,
  '-frames:v',
  '1',
  outputImagePath,
])
```

### Write an AVIF still

AVIF is AV1 in an image container. `libaom-av1` encodes it; `-still-picture 1` switches the encoder into single-image mode and `-f avif` picks the container. Decoding an AVIF back — or any AV1 video — goes through dav1d automatically.

```typescript
await execute([
  '-y',
  '-ss',
  '1.5',
  '-i',
  inputPath,
  '-frames:v',
  '1',
  '-vf',
  'scale=-2:720',
  '-c:v',
  'libaom-av1',
  '-still-picture',
  '1',
  '-cpu-used',
  '6', // 0 (slowest, best) … 8 (fastest)
  '-crf',
  '28', // quality; lower is larger
  '-pix_fmt',
  'yuv420p',
  '-f',
  'avif',
  outputPath, // ends in .avif
])
```

React Native's `<Image>` displays AVIF natively on iOS 16+ and Android 12+.

### Burn subtitles into a video

The bundled builds include libass with FreeType, HarfBuzz, and FriBidi, so ASS/SSA styling and complex scripts (Arabic, Urdu, and other RTL or shaped text) render correctly. System fonts are found automatically — through Core Text on iOS and through fontconfig scanning `/system/fonts` on Android.

```typescript
import { execute, normalizePath } from 'munim-ffmpeg'

// ASS/SSA keeps its embedded styling: fonts, colours, outlines,
// shadows, positioning, karaoke — everything the format supports.
await execute([
  '-y',
  '-i',
  inputPath,
  '-vf',
  `ass=filename=${normalizePath(subtitlePath)}`,
  '-c:a',
  'copy',
  outputPath,
])

// SRT can be styled at burn time with force_style.
await execute([
  '-y',
  '-i',
  inputPath,
  '-vf',
  `subtitles=filename=${normalizePath(srtPath)}:force_style='Fontsize=28,PrimaryColour=&H00FFFF00,Outline=2'`,
  '-c:a',
  'copy',
  outputPath,
])
```

To ship your own fonts instead of relying on the device's, put them in a directory and add `:fontsdir=/path/to/fonts` to the filter. Note that filter arguments are colon-separated, so a path containing `:` must be escaped — app sandbox paths on both platforms are safe as-is.

### Work with MKV and multiple tracks

Matroska muxing and demuxing is compiled in, along with FFmpeg's standard `-map` stream selection and `-c copy` remuxing:

```typescript
import { execute } from 'munim-ffmpeg'

// Bundle one video, two audio languages, and a subtitle track into MKV.
await execute([
  '-y',
  '-i',
  videoPath,
  '-i',
  urduAudioPath,
  '-i',
  subtitlePath,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0',
  '-map',
  '1:a:0',
  '-map',
  '2:s:0',
  '-c:v',
  'copy',
  '-c:a',
  'aac',
  '-c:s',
  'srt',
  '-metadata:s:a:1',
  'language=urd',
  outputMkvPath,
])

// Extract the second audio track without re-encoding.
await execute([
  '-y',
  '-i',
  outputMkvPath,
  '-map',
  '0:a:1',
  '-c',
  'copy',
  trackPath,
])
```

### Embed soft subtitles

The other subtitle workflow: instead of burning text into the frames, mux the subtitle file in as its own stream, so players can toggle it and the video is never re-encoded. Each container wants its own subtitle codec — MKV takes `srt` and `ass` (ASS keeps its styling), MP4 takes `mov_text`, WebM takes `webvtt`.

```typescript
import { execute } from 'munim-ffmpeg'

// MKV with English SRT and styled Urdu ASS tracks, video and audio untouched.
await execute([
  '-y',
  '-i',
  videoPath,
  '-i',
  englishSrtPath,
  '-i',
  urduAssPath,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0',
  '-map',
  '1:0',
  '-map',
  '2:0',
  '-c:v',
  'copy',
  '-c:a',
  'copy',
  '-c:s:0',
  'srt',
  '-c:s:1',
  'ass',
  '-metadata:s:s:0',
  'language=eng',
  '-metadata:s:s:0',
  'title=English',
  '-metadata:s:s:1',
  'language=urd',
  '-metadata:s:s:1',
  'title=Urdu',
  outputMkvPath,
])

// MP4 needs mov_text instead.
await execute([
  '-y',
  '-i',
  videoPath,
  '-i',
  subtitlePath,
  '-map',
  '0:v:0',
  '-map',
  '0:a:0',
  '-map',
  '1:0',
  '-c:v',
  'copy',
  '-c:a',
  'copy',
  '-c:s',
  'mov_text',
  '-metadata:s:s:0',
  'language=eng',
  outputMp4Path,
])
```

Existing subtitle streams survive remuxing with `-map 0 -c copy`, and a soft track can later be burned in with `-vf subtitles=filename=input.mkv:si=0` (the `si` option picks the subtitle stream index).

### Cancel a long-running command

```typescript
import { cancel, execute } from 'munim-ffmpeg'

let sessionId: number | undefined

const execution = execute(
  ['-i', inputPath, '-c:v', 'mpeg4', outputPath],
  undefined,
  undefined,
  (createdSessionId) => {
    sessionId = createdSessionId
  }
)

const cancelCurrentCommand = () => {
  if (sessionId !== undefined) {
    cancel(sessionId)
  }
}

const result = await execution
console.log(result.cancelled)
```

### Run a custom FFprobe query

```typescript
import { probe } from 'munim-ffmpeg'

const result = await probe([
  '-v',
  'error',
  '-select_streams',
  'v:0',
  '-show_entries',
  'stream=codec_name,width,height,duration',
  '-of',
  'json',
  inputPath,
])

if (result.success) {
  console.log(result.output)
}
```

## Licensing

The JavaScript, TypeScript, Swift, Kotlin, C core, and generated Nitro bridge in this repository are Apache-2.0.

The bundled FFmpeg 9.0.1 is **LGPLv3**, on both platforms. It is configured without `--enable-gpl`, so no x264, x265, xvid, or vid.stab. The external libraries it links are LAME (LGPL), Opus (BSD), libvpx (BSD), dav1d (BSD), libaom (BSD 2-clause with the Alliance for Open Media patent licence), openh264 (BSD 2-clause), libass (ISC), FreeType (FTL, BSD-style with credit), HarfBuzz (MIT-style), FriBidi (LGPL), and, on Android only, mbedTLS (Apache-2.0), fontconfig (MIT-style), and expat (MIT). None of them change the LGPL story.

> **A note on H.264 patents.** Hardware encoders are covered by the licences device manufacturers already pay for. Software H.264 encoding through `libopenh264` is not: Cisco's royalty coverage applies to _their_ prebuilt binary, and this package builds openh264 from source. If you ship software H.264 encoding at scale, check where you stand with AVC licensing. Hardware encoders avoid the question entirely, which is why `pickEncoder` should list them first.

In practice that means your application does **not** inherit GPL obligations. LGPL still applies: the FFmpeg libraries are linked and their license and notices must be conveyed with your app, and users must be able to relink against a modified FFmpeg. The exact configuration used is recorded in [`scripts/ffmpeg/build-ios.sh`](./scripts/ffmpeg/build-ios.sh) and [`build-android.sh`](./scripts/ffmpeg/build-android.sh), and the binaries can be reproduced from them.

If you need x264 or x265, add `--enable-gpl --enable-libx264 --enable-libx265` to those scripts and rebuild — but then your application does inherit GPLv3.

See [FFmpeg legal guidance](https://ffmpeg.org/legal.html). This section is an engineering summary, not legal advice.

## 🔍 Troubleshooting

### `munim-ffmpeg` is unavailable in Expo Go

This is expected. Install the package and create an Expo development build with `npx expo run:ios`, `npx expo run:android`, or EAS Build.

### Nitro reports that `MunimFfmpeg` cannot be found

Rebuild the native app after installing both `munim-ffmpeg` and `react-native-nitro-modules`. Restarting Metro alone cannot add a native module to an existing binary.

### FFmpeg cannot open an input or output

- Confirm the file exists and the app can read it.
- Confirm the output directory already exists and is writable.
- Copy Android `content://` inputs into app storage.
- Copy temporary picker or photo-library assets when necessary.
- Log the exact argument array and native output while removing private path data from bug reports.

### A codec or filter is missing

Native FFmpeg variants do not bundle every codec, filter, or third-party library, and the iOS and Android builds are not identical. Call `listEncoders()`, `listDecoders()`, `listMuxers()`, `listDemuxers()`, `listFilters()`, or `listProtocols()` to see what the running build actually has, and prefer `pickEncoder()` over a hard-coded name. There is no `libx264` in these LGPL builds — H.264 comes from the platform's hardware encoder or `libopenh264` — see [Bundled FFmpeg builds](#bundled-ffmpeg-builds).

### The Promise resolved but the command failed

Inspect `result.success`, `result.cancelled`, `result.returnCode`, `result.output`, and `result.failStackTrace`. A resolved Promise represents a completed native session; FFmpeg can still finish with a nonzero return code.

### iOS pod or build errors

Run `pod install` after installation and rebuild from a clean native development build. If the linker cannot find `MunimFFmpeg.xcframework`, the native binaries were not downloaded — run `npx munim-ffmpeg-fetch-binaries`.

### Android build errors

Use Android API 24 or newer, JDK 17, and the React Native New Architecture. Clear stale Gradle build output after changing native dependency versions.

If the build fails on duplicate `libc++_shared.so`, make sure the config plugin ran (Expo) or add `android.packagingOptions.pickFirsts=**/libc++_shared.so` to `gradle.properties` (bare React Native).

If `System.loadLibrary` cannot find `munimffmpeg9`, the native binaries were not downloaded — run `npx munim-ffmpeg-fetch-binaries`.

## Development

```bash
npm install
npm run check   # codegen, typecheck, example typecheck, build, pack dry-run
```

Individual steps are available as `npm run codegen`, `typecheck`, `typecheck:example`, and `build`.

Nitrogen output under `nitrogen/generated` is committed. Change the `.nitro.ts` specification and rerun `npm run codegen` instead of editing generated files directly.

### Example app

`example/` is an Expo SDK 57 app — a development build, since Expo Go cannot load native modules — with two screens:

- **Playground** picks a video with `expo-document-picker` (or generates one from JavaScript fixtures), inspects it, transcodes it through the device's hardware H.264 encoder via `pickEncoder`, writes an AVIF still, embeds soft subtitles into an MKV, burns them in with libass, and shows progress from the statistics callback with a cancel button wired to `onSessionCreated`. Each action is a plain argument array, so [`example/Playground.tsx`](./example/Playground.tsx) doubles as a recipe book.
- **Device suite** runs the 30+ checks used to verify every release: H.264 and HEVC encoding, VP9/Opus in WebM, MP3, AAC, AVIF, scaling and multi-step filter graphs, software H.264 via openh264, subtitle burn-in and embedding, muxing, demuxing, trimming, concatenation, thumbnails, audio resampling, awkward file paths, concurrent sessions, single and global cancellation, protocol support, and both failure paths. It runs on launch, renders each result, writes `munim-ffmpeg-suite.json` to the app's document directory, and logs it as `MUNIM_FFMPEG_SUITE_RESULT`.

```bash
npm run example:ios
# or
npm run example:android
```

FFmpeg encoding is slow in a simulator or emulator, and emulators have no working hardware encoder; run it on a physical device. [`example/README.md`](./example/README.md) has the details.

### Rebuilding FFmpeg

```bash
npm run binaries:build     # every architecture, ~40 minutes
npm run binaries:package   # bundles them and records the checksum
```

See [`scripts/ffmpeg/README.md`](./scripts/ffmpeg/README.md) for what the build does and the platform quirks it works around.

### Releasing

Releases run locally from a clean `main`:

```bash
npm run check
npm run release:local
```

`release:local` runs semantic-release with the npm token from the macOS Keychain and the GitHub CLI token, so commit messages must follow Conventional Commits. It also uploads `dist-binaries/munim-ffmpeg-binaries.tar.gz` and `build-info.txt` to the GitHub release, which is where `postinstall` fetches the binaries from — so run `npm run binaries:package` first.

Two GitHub Actions workflows back this up: `CI` checks the JavaScript surface on every push and pull request, and `Build binaries` compiles every iOS and Android slice in parallel, on demand or when a pull request touches `scripts/ffmpeg/`, and can attach the result to a release. See [`scripts/ffmpeg/README.md`](./scripts/ffmpeg/README.md#building-in-github-actions).

## 👏 Contributing

Issues and pull requests are welcome. Include the following when reporting a problem:

- iOS or Android version and device architecture
- Expo SDK and React Native versions
- `react-native-nitro-modules` version
- Command arguments with private paths and URLs removed
- `FFmpegSessionResult` and relevant native logs

Please keep licensing implications explicit when proposing a new FFmpeg binary variant, codec, or linked library.

## 📄 License

The `munim-ffmpeg` source is available under the [Apache License 2.0](./LICENSE). Native FFmpeg dependencies are licensed separately as described above.
