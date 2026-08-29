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

> **Licensing note:** The JavaScript and Nitro bridge are Apache-2.0. The bundled native FFmpeg builds are not: the Android artifact is **GPLv3** (it links x264, x265, and xvid) and the iOS artifact is **LGPLv3**. Distributing either carries obligations. Read [Bundled FFmpeg builds](#bundled-ffmpeg-builds) before shipping.

## Table of contents

- [📚 Documentation](#-documentation)
- [🚀 Features](#-features)
- [Platform support matrix](#platform-support-matrix)
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

- 🎬 **Argument-array commands:** Avoid platform-specific shell parsing and quoting
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
- 🧪 **Capability discovery:** Ask the bundled build which encoders and decoders it actually has
- 🎯 **TypeScript:** Complete public callback and result types
- 🗂️ **16 KB Android support:** Uses a maintained FFmpegKit-compatible Android artifact with 16 KB page-size support

## Platform support matrix

| Capability                   | iOS             | Android         | Notes                                                                                                                                                   |
| ---------------------------- | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FFmpeg argument execution    | ✅              | ✅              | Commands run asynchronously through the native compatibility library.                                                                                   |
| FFprobe argument execution   | ✅              | ✅              | Custom FFprobe arguments return `FFmpegSessionResult`.                                                                                                  |
| Parsed media information     | ✅              | ✅              | `getMediaInformation()` returns parsed FFprobe JSON.                                                                                                    |
| Log callback                 | ✅              | ✅              | Logs are delivered while a session is active.                                                                                                           |
| Encoding-statistics callback | ✅              | ✅              | Available for FFmpeg execution.                                                                                                                         |
| Immediate session ID         | ✅              | ✅              | `onSessionCreated` fires after the native session is created.                                                                                           |
| Cancel one FFmpeg session    | ✅              | ✅              | Pass the positive safe-integer ID received by `execute`'s `onSessionCreated`. The native dependency does not expose FFprobe cancellation.               |
| Cancel all FFmpeg sessions   | ✅              | ✅              | Use `cancelAll()` or call `cancel()` without an ID.                                                                                                     |
| Expo Go                      | ❌              | ❌              | A native development build is required.                                                                                                                 |
| Capability discovery         | ✅              | ✅              | `listEncoders()`, `listDecoders()`, and `pickEncoder()` report what the bundled build supports.                                                          |
| H.264 encoding               | VideoToolbox    | libx264         | The builds differ; use `pickEncoder(['libx264', 'h264_videotoolbox'])` instead of hard-coding an encoder.                                                |
| Remote HTTP(S) inputs        | ✅              | ✅              | Both builds link GnuTLS. Remote server behaviour still varies; prefer local files for predictable app workflows.                                         |

Codec availability is determined by the native FFmpeg builds described in [Bundled FFmpeg builds](#bundled-ffmpeg-builds). Do not assume every FFmpeg codec or external library is present.

## Bundled FFmpeg builds

FFmpegKit was retired upstream in 2025 and its official binaries were withdrawn, so this package depends on maintained community rebuilds. The two platforms are **not** the same build:

| | iOS | Android |
| --- | --- | --- |
| Artifact | `ffmpeg-kit-ios-full-gpl-alt` 6.0 | `io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-16kb` 6.1.7 |
| FFmpeg | n6.0 | n6.1.4 |
| Effective license | LGPLv3 | **GPLv3** |
| Hardware codecs | VideoToolbox, AudioToolbox | MediaCodec |
| 16 KB page size | n/a | ✅ (required by Google Play) |

Despite its name, the iOS pod ships FFmpeg's non-GPL configuration: it has no `libx264`, `libx265`, or `libxvid`. No public GPL build of FFmpegKit for iOS exists since the upstream retirement.

### Encoders

Verified by running the example's device suite on both platforms: iOS reports 201 encoders, Android 196, with 181 in common. Everything FFmpeg builds natively (`aac`, `alac`, `flac`, `mpeg4`, `mjpeg`, `png`, `gif`, `pcm_*`, …) is available on both, as are `libmp3lame`, `libopus`, `libvpx` (VP8), and `libvpx-vp9`.

The differences that matter:

| Encoder | iOS | Android |
| --- | --- | --- |
| `libx264` / `libx264rgb` (H.264, software) | ❌ | ✅ |
| `libx265` (HEVC, software) | ❌ | ✅ |
| `h264_videotoolbox`, `hevc_videotoolbox`, `prores_videotoolbox` | ✅ | ❌ |
| `h264_mediacodec`, `hevc_mediacodec`, `vp8_mediacodec`, `vp9_mediacodec`, `av1_mediacodec` | ❌ | ✅ |
| `libkvazaar` (HEVC, software) | ✅ | ❌ |
| `libtheora`, `libvorbis`, `libwebp` | ✅ | ❌ |
| `libspeex`, `libshine`, `libtwolame`, `libilbc`, `libopencore_amrnb`, `libvo_amrwbenc` | ✅ | ❌ |
| `aac_at`, `alac_at`, `ilbc_at` (AudioToolbox) | ✅ | ❌ |

iOS additionally links libass, so subtitle burn-in filters work there but not on Android.

Both platforms can encode H.264 and HEVC — just not with the same encoder name. Resolve it at runtime instead of branching on `Platform.OS`:

```typescript
import { execute, pickEncoder } from 'munim-ffmpeg'

const h264 = await pickEncoder(['libx264', 'h264_videotoolbox'])
if (!h264) throw new Error('No H.264 encoder in this build')

await execute(['-y', '-i', inputPath, '-c:v', h264, outputPath])
```

Decoding is far more uniform: both builds decode H.264, HEVC, VP8/VP9, AV1 (`libdav1d`), MPEG-4, MP3, AAC, Vorbis, Opus, FLAC, and the usual container formats. Both link GnuTLS, so `https://` inputs work.

The Android build is compiled with `--disable-indev=lavfi`, so `-f lavfi -i testsrc=...` and other virtual inputs are iOS-only. Feed real files or raw frames instead.

> **Avoid the `-full` and `-full-gpl` Android artifacts.** Their `libavdevice.so` references hidapi symbols that nothing in the package provides, so FFmpegKit fails to initialise at runtime with `UnsatisfiedLinkError: cannot locate symbol "PLATFORM_hid_write"`.

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

FFmpegKit and React Native both provide `libc++_shared.so`. Resolve that duplicate in the Android application module:

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

The plugin also configures Android to select one shared C++ runtime when React Native and FFmpegKit contribute the same `libc++_shared.so` path.

Create a native development build after installation:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

You can also create an [EAS development build](https://docs.expo.dev/develop/development-builds/create-a-build/).

> **Important:** `munim-ffmpeg` cannot run in Expo Go because Expo Go does not include this package's native libraries.

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
function getMediaInformation(path: string): Promise<unknown>
```

Applications should validate or narrow the returned JSON shape before using fields from it.

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

const encoder = await pickEncoder(['libx264', 'h264_videotoolbox'])
if (!encoder) throw new Error('No H.264 encoder available in this build')

// -preset is an x264 option; VideoToolbox rejects it.
const quality = encoder === 'libx264' ? ['-preset', 'veryfast', '-crf', '23'] : ['-b:v', '2M']

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

The JavaScript, TypeScript, Swift, Kotlin, and generated Nitro bridge code in this repository are Apache-2.0. The native FFmpeg binaries are not, and the two platforms differ:

| Platform | Native dependency | Version | Effective license |
| -------- | ----------------- | ------- | ----------------- |
| iOS      | `ffmpeg-kit-ios-full-gpl-alt` | 6.0 | LGPLv3 (`--enable-version3`, no GPL libraries linked) |
| Android  | `io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-16kb` | 6.1.7 | **GPLv3** (`--enable-gpl` with x264 and x265) |

The Android artifact's published Maven metadata claims LGPL-3.0. That metadata is wrong: the shipped `libavcodec.so` is configured with `--enable-gpl` and the AAR bundles the x264 and x265 license notices. Treat the Android build as GPLv3.

Distributing an Android application built against it can trigger GPLv3 source, license, and redistribution obligations for your application. If that does not suit your product, replace the Android dependency in `android/build.gradle` with a non-GPL FFmpegKit artifact; H.264 encoding then relies on `h264_mediacodec`.

Before distributing an application:

1. Review the license and notices shipped by each native dependency.
2. Identify the codecs and linked libraries your product actually uses.
3. Follow the applicable LGPL, GPL, attribution, relinking, and source-offer requirements.
4. Reassess licensing whenever you replace a native dependency.

See [FFmpeg legal guidance](https://ffmpeg.org/legal.html). This section is an engineering reminder, not legal advice.

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

Native FFmpeg variants do not bundle every codec, filter, or third-party library, and the iOS and Android builds are not identical. Call `listEncoders()` or `listDecoders()` to see what the running build actually has, and prefer `pickEncoder()` over a hard-coded name. `libx264` in particular exists only on Android — see [Bundled FFmpeg builds](#bundled-ffmpeg-builds).

### The Promise resolved but the command failed

Inspect `result.success`, `result.cancelled`, `result.returnCode`, `result.output`, and `result.failStackTrace`. A resolved Promise represents a completed native session; FFmpeg can still finish with a nonzero return code.

### iOS pod or build errors

Run `pod install` after installation and rebuild from a clean native development build. The package includes a narrowly scoped Xcode 26 compatibility patch for the FFmpegKit `Level` enum, which Nitro's Swift/C++ bridge otherwise rejects. The patch locates the header by globbing, so it keeps working if you swap the FFmpegKit pod.

### `building for iOS Simulator, but linking ... built for iOS`

The FFmpegKit pod tells consuming apps to exclude `arm64` from Simulator builds, which breaks Apple Silicon Macs even though its xcframework contains an `arm64` Simulator slice. The Expo config plugin removes that exclusion automatically. In a bare React Native app, add the same fix to your `Podfile`:

```ruby
post_install do |installer|
  installer.pods_project.build_configurations.each do |config|
    config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
  end
  installer.aggregate_targets.each do |aggregate_target|
    aggregate_target.xcconfigs.each do |config_name, xcconfig|
      xcconfig.attributes.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
      xcconfig.save_as(Pathname.new(aggregate_target.xcconfig_path(config_name)))
    end
  end
end
```

### Android build errors

Use Android API 24 or newer, JDK 17, and the React Native New Architecture. Clear stale Gradle build output after changing native dependency versions.

If the build fails on duplicate `libc++_shared.so`, make sure the config plugin ran (Expo) or add `android.packagingOptions.pickFirsts=**/libc++_shared.so` to `gradle.properties` (bare React Native). FFmpegKit and React Native both ship that library.

## Development

```bash
npm install
npm run check   # codegen, typecheck, example typecheck, build, pack dry-run
```

Individual steps are available as `npm run codegen`, `typecheck`, `typecheck:example`, and `build`.

Nitrogen output under `nitrogen/generated` is committed. Change the `.nitro.ts` specification and rerun `npm run codegen` instead of editing generated files directly.

### Example app

`example/` is an Expo app that runs a 24-check device suite: H.264 and HEVC encoding, VP9/Opus in WebM, MP3, AAC, scaling and multi-step filter graphs, muxing, demuxing, trimming, concatenation, thumbnails, audio resampling, awkward file paths, concurrent sessions, single and global cancellation, protocol support, and both failure paths. Fixtures are generated in JavaScript, so the suite needs no network or bundled media. Results are rendered on screen, written to `munim-ffmpeg-suite.json` in the app's document directory, and logged as `MUNIM_FFMPEG_SUITE_RESULT`.

```bash
npm run example:ios
# or
npm run example:android
```

FFmpeg encoding is slow in a simulator or emulator; run the suite on a physical device.

### Releasing

Releases run locally from a clean `main`; this repository does not use GitHub Actions.

```bash
npm run check
npm run release:local
```

`release:local` runs semantic-release with the npm token from the macOS Keychain and the GitHub CLI token, so commit messages must follow Conventional Commits.

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
