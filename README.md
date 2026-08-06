# munim-ffmpeg

[![npm version](https://img.shields.io/npm/v/munim-ffmpeg.svg?style=flat-square)](https://www.npmjs.com/package/munim-ffmpeg)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square)](./LICENSE)
[![Expo](https://img.shields.io/badge/Expo-development%20build-000020.svg?style=flat-square&logo=expo)](https://docs.expo.dev/develop/development-builds/introduction/)

Fast, typed FFmpeg and FFprobe access for Expo and React Native, powered by [Nitro Modules](https://nitro.margelo.com/).

`munim-ffmpeg` executes argument arrays directly through native FFmpeg libraries. It supports asynchronous execution, per-session logs and statistics, FFprobe, media information, and cancellation on iOS and Android.

## Features

- FFmpeg and FFprobe execution without shell-string parsing
- Promise-based sessions with return codes, output, duration, and failure details
- Live log and encoding-statistics callbacks
- JSON media information
- Per-session and global cancellation
- Typed TypeScript API backed by Swift and Kotlin Nitro HybridObjects
- Expo config-plugin integration and React Native autolinking

## Requirements

- iOS 15.1 or newer
- Android API 24 or newer
- React Native with the New Architecture enabled
- `react-native-nitro-modules`
- An Expo development build or a bare React Native app

This package contains native code and does not run in Expo Go.

## Installation

### Expo

```bash
npx expo install munim-ffmpeg react-native-nitro-modules
```

Add the package to the Expo plugins array if your project does not add it automatically:

```json
{
  "expo": {
    "plugins": ["munim-ffmpeg"]
  }
}
```

Create a native development build after installation:

```bash
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

For cloud builds, use an [EAS development build](https://docs.expo.dev/develop/development-builds/create-a-build/).

### React Native CLI

```bash
npm install munim-ffmpeg react-native-nitro-modules
cd ios && pod install && cd ..
```

## Quick start

Commands are passed as argument arrays. Do not include the `ffmpeg` or `ffprobe` executable name.

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
  ["-i", inputUri, "-c:v", "mpeg4", "-c:a", "aac", outputUri],
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

// From a cancel button while the command is running:
if (activeSessionId !== undefined) cancel(activeSessionId);

const result = await execution;

if (!result.success) {
  throw new Error(result.failStackTrace ?? result.output);
}

const probeResult = await probe([
  "-v",
  "error",
  "-show_format",
  "-show_streams",
  inputUri,
]);

const mediaInfo = await getMediaInformation(inputUri);
```

Use local filesystem paths understood by the native FFmpeg build. If an Expo API returns a URI, verify whether it needs to be copied into app storage before passing it to FFmpeg.

## API

### `execute(arguments, onLog?, onStatistics?, onSessionCreated?)`

Runs an FFmpeg session and resolves to an `FFmpegSessionResult`. `onSessionCreated` receives the native session ID immediately so a running command can be cancelled individually.

### `probe(arguments, onLog?, onSessionCreated?)`

Runs an FFprobe session and resolves to an `FFmpegSessionResult`.

### `getMediaInformation(path)`

Reads and parses FFprobe media information. The return type is `Promise<unknown>` so applications can validate the JSON shape they consume.

### `cancel(sessionId?)`

Cancels a specific native session. Capture its ID with `onSessionCreated` while the command is running. Omitting `sessionId` cancels all sessions.

### `cancelAll()`

Cancels all running sessions.

### `getFFmpegVersion()`

Returns the bundled native FFmpeg version.

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

## Platform dependencies

The JavaScript and Nitro bridge in this repository are Apache-2.0 licensed. Native FFmpeg binaries are supplied by separate compatibility packages and retain their own licenses:

| Platform | Native dependency                                   | Version |
| -------- | --------------------------------------------------- | ------- |
| iOS      | `ffmpeg-kit-ios-https-alt`                          | 6.0     |
| Android  | `io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-16kb` | 6.1.4   |

FFmpeg's effective license depends on the enabled libraries and codecs. Review the native dependency notices and [FFmpeg legal guidance](https://ffmpeg.org/legal.html) before distributing an app, especially when adding GPL codecs or other optional builds.

## Development

```bash
npm install
npm run codegen
npm run typecheck
npm run build
npm run pack:dry-run
```

Run the Expo example with:

```bash
npm run example:ios
# or
npm run example:android
```

Nitrogen output under `packages/munim-ffmpeg/nitrogen/generated` is committed. Change the `.nitro.ts` specification and rerun codegen instead of editing generated files directly.

## Contributing

Issues and pull requests are welcome. Please include the platform, Expo/React Native version, command arguments with private paths removed, and the complete session result when reporting a failure.

## License

The `munim-ffmpeg` source is available under the [Apache License 2.0](./LICENSE). Native FFmpeg dependencies are licensed separately as described above.
