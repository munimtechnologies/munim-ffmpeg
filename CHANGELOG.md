## [0.5.1](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.5.0...v0.5.1) (2026-09-01)

### 🐛 Bug Fixes

* keep concurrent sessions' callbacks and logs apart ([b0987d5](https://github.com/munimtechnologies/munim-ffmpeg/commit/b0987d53ad8b6b3707abf75a92d73a3fe605f5d8))

### 📚 Documentation

* correct encoder and TLS notes left over from pre-LGPL builds ([40f0ba6](https://github.com/munimtechnologies/munim-ffmpeg/commit/40f0ba6bb21d7c6adcb4f2c12cc47df152bc2245))

### 🛠️ Other changes

* sync package-lock with the release ([92a4070](https://github.com/munimtechnologies/munim-ffmpeg/commit/92a4070c9f1375c9f21d7351232af53a0d2f0997))

## [0.5.0](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.4.2...v0.5.0) (2026-09-01)

### ✨ Features

* render subtitles with libass and list muxers, demuxers, filters, and protocols ([b615d90](https://github.com/munimtechnologies/munim-ffmpeg/commit/b615d901a5d2d674fc840004ddd7baa09cb38c63))

### 🐛 Bug Fixes

* reset the global log level before every run ([0d1724a](https://github.com/munimtechnologies/munim-ffmpeg/commit/0d1724a42d1a4c667f377c240cb12d711ad430e5))

### 🛠️ Other changes

* **deps:** force transitive uuid past GHSA-w5hq-g745-h8pq ([697c535](https://github.com/munimtechnologies/munim-ffmpeg/commit/697c5353a740c84fe61ba6862271d7b5c118e20e))
* sync package-lock with the release ([e87d87b](https://github.com/munimtechnologies/munim-ffmpeg/commit/e87d87b831355490f58495ed2b25ff4dd46eef75))

## [0.4.2](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.4.1...v0.4.2) (2026-08-29)

### 📚 Documentation

* verify x86_64 on real hardware, and correct the Gradle note ([b9e4155](https://github.com/munimtechnologies/munim-ffmpeg/commit/b9e41558a3204f0cc05d40858aee8223410104a8))

### 🛠️ Other changes

* sync package-lock with the 0.4.1 release ([8ab433d](https://github.com/munimtechnologies/munim-ffmpeg/commit/8ab433d324eada4906d859847a6d33208385ccbe))

## [0.4.1](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.4.0...v0.4.1) (2026-08-29)

### 🐛 Bug Fixes

* **android:** stop bundling React Native's TurboModule specs ([26de4d5](https://github.com/munimtechnologies/munim-ffmpeg/commit/26de4d5c107932839335a795e066f9ed6bb8dde4))

### 🛠️ Other changes

* sync package-lock with the 0.4.0 release ([80385c6](https://github.com/munimtechnologies/munim-ffmpeg/commit/80385c63b8719fba0fca0c69cd14cd52b31e673f))

## [0.4.0](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.3.1...v0.4.0) (2026-08-29)

### ✨ Features

* add libopenh264 so H.264 encoding works without hardware ([2b3d73f](https://github.com/munimtechnologies/munim-ffmpeg/commit/2b3d73fa2bb1443d072d58bf925b5a841e68220f))

### 🛠️ Other changes

* sync package-lock with the 0.3.1 release ([a7ff3ad](https://github.com/munimtechnologies/munim-ffmpeg/commit/a7ff3adcb6a27964559a8269ed62d6aed2b34622))

## [0.3.1](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.3.0...v0.3.1) (2026-08-29)

### 📚 Documentation

* record where 0.3.x is verified, and the emulator encoding limit ([5f1d6a9](https://github.com/munimtechnologies/munim-ffmpeg/commit/5f1d6a9c259f11396f4935761f0da5d66a6f98b4))

### 🛠️ Other changes

* drop the stale ios/vendor ignore rule ([d97293a](https://github.com/munimtechnologies/munim-ffmpeg/commit/d97293ad48c27a9d965d0571c468e276cc21652d))
* sync package-lock with the 0.3.0 release ([90cc964](https://github.com/munimtechnologies/munim-ffmpeg/commit/90cc9646f51995cd75c285c6269e1568d25ee1d2))

## [0.3.0](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.2.0...v0.3.0) (2026-08-29)

### ✨ Features

* build on FFmpeg 9.0.1 with in-process fftools on both platforms ([1714fcd](https://github.com/munimtechnologies/munim-ffmpeg/commit/1714fcdbf3edb5ab8acf7658ae8117697993772b))
* ship every architecture and download binaries on install ([b837ac3](https://github.com/munimtechnologies/munim-ffmpeg/commit/b837ac3c553960b7424a3b771c17744e9752298f))

### 🛠️ Other changes

* keep the FFmpeg binaries out of the npm tarball ([ecb2cbf](https://github.com/munimtechnologies/munim-ffmpeg/commit/ecb2cbfdb958eddb5f56b90f990517cc053551a2))
* sync package-lock with the 0.2.0 release ([17f9487](https://github.com/munimtechnologies/munim-ffmpeg/commit/17f94876920431df316f3747506c175487aad56c))

## [0.2.0](https://github.com/munimtechnologies/munim-ffmpeg/compare/v0.1.1...v0.2.0) (2026-08-29)

### ✨ Features

* flatten the repository and verify FFmpeg on real devices ([78ebecd](https://github.com/munimtechnologies/munim-ffmpeg/commit/78ebecd97cb6c1d163f7e6f37099d9c73f2501a9))

### 🐛 Bug Fixes

* decode file:// URIs and broaden the device suite to 24 checks ([12f5d02](https://github.com/munimtechnologies/munim-ffmpeg/commit/12f5d023407f412d0a71ac5b8460d5ed1e1f3b2c))

### 📚 Documentation

* hand the changelog over to semantic-release ([a686179](https://github.com/munimtechnologies/munim-ffmpeg/commit/a686179f5435f41c094b4491d29c060a2d1f4abe))

# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries from 0.2.0 onwards are generated by semantic-release from Conventional Commit messages; earlier entries were written by hand.

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
