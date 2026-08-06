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

> **Licensing note:** The JavaScript and Nitro bridge are Apache-2.0. The bundled Android artifact is GPL-enabled and includes x264/x265; distributing it can trigger GPLv3 obligations. The native dependencies and FFmpeg retain their own licenses. Review [Native dependencies and licensing](#native-dependencies-and-licensing) before distributing an app.

## Table of contents

- [📚 Documentation](#-documentation)
- [🚀 Features](#-features)
- [Platform support matrix](#platform-support-matrix)
- [📦 Installation](#-installation)
- [Working with media paths](#working-with-media-paths)
- [⚡ Quick start](#-quick-start)
- [🔧 API reference](#-api-reference)
- [📖 Usage examples](#-usage-examples)
- [Native dependencies and licensing](#native-dependencies-and-licensing)
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
| Remote HTTP(S) inputs        | Build-dependent | Build-dependent | The bundled variants include HTTPS support, but remote server behavior and protocol support can vary. Prefer local files for predictable app workflows. |

Codec availability is determined by the native FFmpeg builds listed below. Do not assume every FFmpeg codec or external library is bundled.

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
- `file://` URIs and plain local paths are the most predictable inputs and outputs.
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
} from "munim-ffmpeg";

console.log("FFmpeg:", getFFmpegVersion());

let activeSessionId: number | undefined;

const execution = execute(
  ["-y", "-i", inputPath, "-c:v", "mpeg4", "-c:a", "aac", outputPath],
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
    });
  },
  (sessionId) => {
    activeSessionId = sessionId;
  },
);

// Call this from a cancel button while the command is running.
if (activeSessionId !== undefined) {
  cancel(activeSessionId);
}

const result = await execution;

if (!result.success && !result.cancelled) {
  throw new Error(result.failStackTrace ?? result.output);
}

const probeResult = await probe([
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  inputPath,
]);

const mediaInformation = await getMediaInformation(inputPath);
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
    quality: number,
  ) => void,
  onSessionCreated?: (sessionId: number) => void,
): Promise<FFmpegSessionResult>;
```

The `onSessionCreated` callback receives the ID before the command completes, allowing targeted cancellation while work is running.

### `probe(arguments, onLog?, onSessionCreated?)`

Starts an asynchronous FFprobe session.

```typescript
function probe(
  arguments_: string[],
  onLog?: (message: string) => void,
  onSessionCreated?: (sessionId: number) => void,
): Promise<FFmpegSessionResult>;
```

`onSessionCreated` can be used to correlate the native probe session with its eventual result. The bundled native dependency does not expose FFprobe cancellation.

### `getMediaInformation(path)`

Runs FFprobe for the format, streams, and chapters at a local media path, then parses its JSON response.

```typescript
function getMediaInformation(path: string): Promise<unknown>;
```

Applications should validate or narrow the returned JSON shape before using fields from it.

### `cancel(sessionId?)`

Cancels the given native FFmpeg execution session. Calling `cancel()` without an ID cancels all active FFmpeg sessions. FFprobe cancellation is not exposed by the bundled native dependency.

```typescript
function cancel(sessionId?: number): void;
```

Session IDs must be positive safe integers received from `onSessionCreated` or `FFmpegSessionResult`.

### `cancelAll()`

Cancels every active FFmpeg session.

```typescript
function cancelAll(): void;
```

### `getFFmpegVersion()`

Returns the version reported by the bundled native FFmpeg library.

```typescript
function getFFmpegVersion(): string;
```

### `FFmpegSessionResult`

```typescript
type FFmpegSessionResult = {
  sessionId: number;
  returnCode: number;
  success: boolean;
  cancelled: boolean;
  state: string;
  durationMs: number;
  output: string;
  failStackTrace?: string;
};
```

Always check `success` or `cancelled`; Promise resolution means the native session completed, not necessarily that FFmpeg returned a success code.

## 📖 Usage examples

### Inspect media metadata

```typescript
import { getMediaInformation } from "munim-ffmpeg";

const information = await getMediaInformation(inputPath);
console.log(JSON.stringify(information, null, 2));
```

### Extract an audio track

```typescript
import { execute } from "munim-ffmpeg";

const result = await execute([
  "-y",
  "-i",
  inputPath,
  "-vn",
  "-c:a",
  "aac",
  outputAudioPath,
]);

if (!result.success) {
  throw new Error(result.failStackTrace ?? result.output);
}
```

### Generate a thumbnail

```typescript
import { execute } from "munim-ffmpeg";

const result = await execute([
  "-y",
  "-ss",
  "00:00:01.000",
  "-i",
  inputPath,
  "-frames:v",
  "1",
  outputImagePath,
]);
```

### Cancel a long-running command

```typescript
import { cancel, execute } from "munim-ffmpeg";

let sessionId: number | undefined;

const execution = execute(
  ["-i", inputPath, "-c:v", "mpeg4", outputPath],
  undefined,
  undefined,
  (createdSessionId) => {
    sessionId = createdSessionId;
  },
);

const cancelCurrentCommand = () => {
  if (sessionId !== undefined) {
    cancel(sessionId);
  }
};

const result = await execution;
console.log(result.cancelled);
```

### Run a custom FFprobe query

```typescript
import { probe } from "munim-ffmpeg";

const result = await probe([
  "-v",
  "error",
  "-select_streams",
  "v:0",
  "-show_entries",
  "stream=codec_name,width,height,duration",
  "-of",
  "json",
  inputPath,
]);

if (result.success) {
  console.log(result.output);
}
```

## Native dependencies and licensing

The JavaScript, TypeScript, Swift, Kotlin, and generated Nitro bridge code in this repository are Apache-2.0 licensed. Native FFmpeg binaries are supplied by separate compatibility packages:

| Platform | Native dependency                                   | Version |
| -------- | --------------------------------------------------- | ------- |
| iOS      | `ffmpeg-kit-ios-https-alt`                          | 6.0     |
| Android  | `io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-16kb` | 6.1.4   |

The bundled Android 6.1.4 artifact is GPL-enabled and includes x264 and x265. Distributing an Android application with this dependency can trigger GPLv3 source, license, and redistribution obligations. Its published Maven metadata does not fully communicate that posture, so assess the binaries and their notices rather than relying only on the POM license field.

FFmpeg's effective license depends on the enabled libraries, codecs, and build configuration. Before distributing an application:

1. Review the license and notices shipped by each native dependency.
2. Identify the codecs and linked libraries used by your product.
3. Follow the applicable LGPL, GPL, attribution, relinking, and source-offer requirements.
4. Treat the current Android build as GPL-enabled, and reassess licensing again if you replace either native dependency.

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

Native FFmpeg variants do not bundle every codec, filter, or third-party library. Check `getFFmpegVersion()` and the session output, then choose a bundled codec or replace the native dependency with a build whose licensing and features fit your application.

### The Promise resolved but the command failed

Inspect `result.success`, `result.cancelled`, `result.returnCode`, `result.output`, and `result.failStackTrace`. A resolved Promise represents a completed native session; FFmpeg can still finish with a nonzero return code.

### iOS pod or build errors

Run `pod install` after installation and rebuild from a clean native development build. The package includes a narrowly scoped Xcode 26 compatibility patch for the FFmpegKit `Level` enum used by Nitro's Swift/C++ bridge.

### Android build errors

Use Android API 24 or newer, JDK 17, and the React Native New Architecture. Clear stale Gradle build output after changing native dependency versions.

## Development

```bash
npm install
npm run codegen
npm run typecheck
npm run typecheck:example
npm run build
npm run pack:dry-run
```

Run the Expo example with:

```bash
npm run example:ios
# or
npm run example:android
```

Releases are validated and published manually; this repository does not use GitHub Actions:

```bash
npm run check
cd packages/munim-ffmpeg
npm publish --access public
```

Nitrogen output under `packages/munim-ffmpeg/nitrogen/generated` is committed. Change the `.nitro.ts` specification and rerun codegen instead of editing generated files directly.

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
