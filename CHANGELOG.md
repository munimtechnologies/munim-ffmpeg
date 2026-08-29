# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Metro config for the example so the workspace symlink back to the repository root no longer breaks bundling.
- `normalizePath()`, applied automatically to every path passed to `execute()`, `probe()`, and `getMediaInformation()`.
- `listEncoders()`, `listDecoders()`, and `pickEncoder()` so a command can resolve an available encoder at runtime instead of hard-coding a per-platform name.
- Expo config plugin now removes the FFmpegKit pod's `EXCLUDED_ARCHS[sdk=iphonesimulator*]` setting, so iOS Simulator builds work on Apple Silicon.
- `npm run release:local` (semantic-release, matching the other Munim packages) and `npm run check` for full local validation.
- Example app runs a 24-check device suite (encoding, muxing, trimming, concatenation, filter graphs, thumbnails, resampling, awkward paths, concurrency, cancellation, protocols, failure paths) and writes the result to `munim-ffmpeg-suite.json`. 24/24 on an iPad Air (M3) and a Galaxy A14 5G.

### Fixed

- Paths from `expo-file-system` and similar libraries are percent-encoded `file://` URIs, which FFmpeg's file protocol takes literally: any path with a space or non-ASCII character silently wrote to a mangled filename. Those URIs are now decoded before they reach FFmpeg.
- iOS reported `FFmpegSessionResult.state` as `sessionstate(rawvalue: 3)`; it now returns `created`/`running`/`failed`/`completed` like Android.

### Changed

- Repository flattened from a workspace monorepo to the standard package layout used by the other Munim packages; the package now lives at the repository root.
- iOS depends on `ffmpeg-kit-ios-full-gpl-alt` 6.0 instead of `ffmpeg-kit-ios-https-alt`, adding VP8/VP9, Opus, Vorbis, Theora, WebP, MP3, kvazaar, AV1 decoding, and subtitle rendering.
- Android FFmpegKit moved from 6.1.4 to 6.1.7, which adds `libopus`. The `-full`/`-full-gpl` artifacts were evaluated and rejected: their `libavdevice.so` references hidapi symbols that nothing provides, so FFmpegKit fails to initialise on device.
- The Xcode 26 `Level.h` patch locates the header by globbing, so it survives a change of FFmpegKit pod.

### Documentation

- Documented the actual per-platform FFmpeg builds, including the encoders each one provides and the fact that `libx264` exists only on Android.
- Corrected the licensing section: Android is GPLv3, iOS is LGPLv3, and the iOS pod's `full-gpl` name does not reflect a GPL build.
- Added troubleshooting entries for the Apple Silicon Simulator exclusion and duplicate `libc++_shared.so`.

## [0.1.1] - 2026-08-06

### Fixed

- Convert Android FFmpegKit FPS and quality statistics to the `Double` values required by the Nitro callback contract.
- Configure Expo Android builds to select a single shared C++ runtime contributed by React Native and FFmpegKit.

### Documentation

- Expanded the README to match the munim-bluetooth documentation experience.
- Added package badges, navigation, feature categories, and a platform support matrix.
- Added detailed Expo and React Native installation guidance, media-path handling, API signatures, usage recipes, troubleshooting, and native licensing guidance.
- Added the Munim Technologies banner, platform badges, and expanded npm/GitHub discovery tags.
- Documented the bundled Android artifact's GPL-enabled x264/x265 build explicitly.
- Removed GitHub Actions automation in favor of local validation and manual publishing.

## [0.1.0] - 2026-08-06

### Added

- Initial Expo and React Native package scaffold.
- Nitro Module HybridObject implemented in Swift and Kotlin.
- Asynchronous FFmpeg and FFprobe argument execution.
- Log and encoding-statistics callbacks.
- Immediate session-created callbacks for targeted cancellation while work is running.
- Media-information JSON parsing.
- Session cancellation and bundled FFmpeg version reporting.
- Expo config plugin, development example, and native autolinking configuration.

[Unreleased]: https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/munimtechnologies/munim-ffmpeg/releases/tag/v0.1.0
