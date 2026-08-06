# munim-ffmpeg

Fast FFmpeg and FFprobe for Expo and React Native, powered by [Nitro Modules](https://nitro.margelo.com/).

## Features

- Execute FFmpeg and FFprobe with argument arrays—no shell-string escaping.
- Receive FFmpeg logs and encoding statistics in JavaScript.
- Inspect media as parsed FFprobe JSON.
- Cancel one session or all active sessions.
- Autolinks in Expo development builds and bare React Native apps.

## Installation

```sh
npx expo install munim-ffmpeg react-native-nitro-modules
```

This package contains native code, so it does not run in Expo Go. Create a development build after installing it:

```sh
npx expo prebuild
npx expo run:ios
# or
npx expo run:android
```

## Usage

```ts
import {
  cancel,
  execute,
  getFFmpegVersion,
  getMediaInformation,
  probe,
} from 'munim-ffmpeg'

const result = await execute(
  ['-i', inputUri, '-c:v', 'libx264', '-c:a', 'aac', outputUri],
  (message) => console.log(message),
  (timeMs, sizeBytes, bitrateKbits, speed) => {
    console.log({ timeMs, sizeBytes, bitrateKbits, speed })
  }
)

if (!result.success) {
  throw new Error(result.failStackTrace ?? result.output)
}

const information = await getMediaInformation(inputUri)
const probeResult = await probe(['-v', 'error', '-show_streams', inputUri])
const version = getFFmpegVersion()

// Cancel a specific session returned to native code, or omit the ID to cancel all.
cancel(result.sessionId)
```

Use native filesystem paths or `file://` URIs that the app can access. Android `content://` input may need to be copied into application storage first.

## API

- `execute(arguments, onLog?, onStatistics?)` returns `Promise<FFmpegSessionResult>`.
- `probe(arguments, onLog?)` returns `Promise<FFmpegSessionResult>`.
- `getMediaInformation(path)` returns parsed FFprobe JSON.
- `cancel(sessionId?)` cancels one session, or all sessions when no ID is supplied.
- `cancelAll()` cancels all sessions.
- `getFFmpegVersion()` returns the bundled FFmpeg version.

## Native dependencies and licensing

The JavaScript and native bridge code in this repository is Apache-2.0 licensed. The distributed native FFmpeg dependencies are separate works with their own licenses:

- Android: `io.github.jamaismagic.ffmpeg:ffmpeg-kit-main-16kb:6.1.4`
- iOS: `ffmpeg-kit-ios-https-alt` 6.0

Those packages are FFmpegKit-compatible builds. FFmpeg and optional linked libraries may impose LGPL, GPL, attribution, or source-offer obligations depending on the build and codecs you distribute. Review the dependency licenses for your application before shipping.

## Requirements

- Expo development build or bare React Native app with the New Architecture enabled
- React Native Nitro Modules
- iOS 15.1 or newer (as determined by the React Native minimum)
- Android API 24 or newer

## License

Apache-2.0
