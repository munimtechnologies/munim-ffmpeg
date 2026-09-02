# munim-ffmpeg example

An Expo app (SDK 57, React Native 0.86) with two screens:

- **Playground** — pick a video from the device or generate one from
  JavaScript fixtures, inspect it with FFprobe, transcode it through whichever
  H.264 encoder the device has (`pickEncoder`), write an AVIF still with
  libaom, embed soft subtitles into an MKV, burn them in with libass, and
  cancel a running command. Every action is a plain FFmpeg argument array, so
  the source doubles as a set of recipes. See [`Playground.tsx`](./Playground.tsx).
- **Device suite** — the 30+ checks used to verify each release on real
  hardware. It runs automatically on launch, renders each result, writes
  `munim-ffmpeg-suite.json` to the app's document directory, and logs a
  `MUNIM_FFMPEG_SUITE_RESULT` line. See [`suite.ts`](./suite.ts).

## Running it

> **A development build is required.** Expo Go cannot load `munim-ffmpeg`
> because it does not contain this package's native libraries. The commands
> below create one with `expo prebuild` + `expo run:*`; an
> [EAS development build](https://docs.expo.dev/develop/development-builds/create-a-build/)
> works the same way.

From the repository root:

```bash
npm install                 # also downloads the prebuilt FFmpeg binaries
npm run example:ios         # or: npm run example:android
```

Pass `--device` to install on a physical device, which is the only place the
hardware encoders can be exercised (emulators report success and write no
frames; simulators are slow).

```bash
npm --workspace example run ios -- --device
npm --workspace example run android -- --device
```

The example depends on the package through `"munim-ffmpeg": "file:.."`, so
changes to `src/` are picked up by Metro without reinstalling; changes to the
native code need another `expo run:*`.

## What it demonstrates

| Topic                                                             | Where                                                                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Expo config plugin (`plugins: ["munim-ffmpeg"]`)                  | [`app.json`](./app.json)                                                                                          |
| `file://` URIs from `expo-file-system` and `expo-document-picker` | `normalizePath` is applied by every API call; `Playground.tsx` passes URIs straight through                       |
| Hardware-aware encoding                                           | `pickEncoder(['h264_videotoolbox', 'h264_mediacodec', 'libopenh264'])` and the NV12 vs planar pixel-format switch |
| Progress and cancellation                                         | the statistics callback drives the progress bar, `onSessionCreated` captures the ID the cancel button uses        |
| Soft subtitles                                                    | `-map 0 -map 1:0 -c copy -c:s srt` into MKV with language/title metadata                                          |
| Subtitle burn-in                                                  | `subtitles=<file>:force_style=…` with the path escaped for a filter graph                                         |
| AVIF                                                              | `-c:v libaom-av1 -still-picture 1 -f avif`, previewed with React Native's `<Image>`                               |
