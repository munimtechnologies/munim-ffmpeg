#!/usr/bin/env bash
# Assembles the built slices into the binary bundle that ships with a release.
#
# Produces dist-binaries/munim-ffmpeg-binaries-<version>.tar.gz and its
# checksum. scripts/fetch-binaries.mjs downloads and verifies exactly that file.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
VERSION="$(node -p "require('$ROOT/package.json').version")"

STAGE="$WORKSPACE/stage"
OUTPUT="$ROOT/dist-binaries"

rm -rf "$STAGE" "$OUTPUT"
mkdir -p "$STAGE/android/src/main/jniLibs" "$STAGE/ios" "$OUTPUT"

echo "==> Android"
for abi in arm64-v8a armeabi-v7a x86_64; do
  source="$WORKSPACE/out/android-$abi/lib"
  if [ ! -f "$source/libmunimffmpeg.so" ]; then
    echo "  missing $abi — run build-android.sh $abi" >&2
    exit 1
  fi
  # One library per ABI: FFmpeg and every dependency are linked in statically.
  mkdir -p "$STAGE/android/src/main/jniLibs/$abi"
  cp "$source/libmunimffmpeg.so" "$STAGE/android/src/main/jniLibs/$abi/"
  echo "  $abi: $(du -sh "$STAGE/android/src/main/jniLibs/$abi" | cut -f1)"
done

echo "==> iOS"
DEVICE="$WORKSPACE/out/ios-iphoneos-arm64/lib/libmunimffmpeg.a"
SIM_ARM="$WORKSPACE/out/ios-iphonesimulator-arm64/lib/libmunimffmpeg.a"
SIM_X86="$WORKSPACE/out/ios-iphonesimulator-x86_64/lib/libmunimffmpeg.a"

for slice in "$DEVICE" "$SIM_ARM" "$SIM_X86"; do
  [ -f "$slice" ] || { echo "  missing $slice — run build-ios.sh" >&2; exit 1; }
done

# Both simulator architectures go in one fat library; the device slice stays
# separate because an xcframework cannot mix platforms in a single binary.
# The file name has to match the device one — CocoaPods refuses an xcframework
# whose static libraries have differing binary names.
SIM_DIR="$WORKSPACE/build/simulator-fat"
rm -rf "$SIM_DIR"; mkdir -p "$SIM_DIR"
SIM_FAT="$SIM_DIR/libmunimffmpeg.a"
lipo -create "$SIM_ARM" "$SIM_X86" -output "$SIM_FAT"

rm -rf "$STAGE/ios/MunimFFmpeg.xcframework"
xcodebuild -create-xcframework \
  -library "$DEVICE" \
  -library "$SIM_FAT" \
  -output "$STAGE/ios/MunimFFmpeg.xcframework" > /dev/null
echo "  xcframework: $(du -sh "$STAGE/ios/MunimFFmpeg.xcframework" | cut -f1)"

# Version-less name: the release tag already identifies the version, and this
# lets the checksum be computed before semantic-release picks the next version.
ARCHIVE="$OUTPUT/munim-ffmpeg-binaries.tar.gz"
tar czf "$ARCHIVE" -C "$STAGE" android ios
shasum -a 256 "$ARCHIVE" | awk '{print $1}' > "$ARCHIVE.sha256"

# What went into the build, per slice: FFmpeg's configure summary lists every
# enabled encoder, decoder, muxer, filter and external library, and config.log
# keeps the exact configure invocation. Attached to the release next to the
# archive so the contents of a build can be checked without downloading it.
echo "==> build-info.txt"
INFO="$OUTPUT/build-info.txt"
{
  echo "munim-ffmpeg $VERSION — FFmpeg ${FFMPEG_VERSION:-9.0.1}"
  echo "built $(date -u +%Y-%m-%dT%H:%M:%SZ) on $(uname -sm)"
  echo
  echo "## External libraries"
  grep -ho 'fetch "[^"]*" [^ ]*' "$HERE/build-android.sh" "$HERE/build-ios.sh" \
    | awk '{print $3}' | sed -E 's/\.tar\.(gz|xz|bz2)$//' | sort -u | sed 's/^/- /'
  echo
  echo "## Bundle"
  (cd "$STAGE" && find android ios -type f | sort | while read -r file; do
    printf -- "- %s (%s)\n" "$file" "$(du -h "$file" | cut -f1)"
  done)
  for slice in android-arm64-v8a android-armeabi-v7a android-x86_64 \
               ios-iphoneos-arm64 ios-iphonesimulator-arm64 ios-iphonesimulator-x86_64; do
    log="$WORKSPACE/build/ffmpeg-${slice#*-}-configure.log"
    config="$WORKSPACE/build/$slice/ffbuild/config.log"
    echo
    echo "## $slice"
    echo
    [ -f "$config" ] && grep -m1 -- '--prefix=' "$config" | sed 's/^# //'
    echo
    [ -f "$log" ] && sed -n '/^install prefix/,/^License:/p' "$log"
  done
} > "$INFO"
echo "  $(wc -l < "$INFO" | tr -d ' ') lines"

# Committed so an install can verify the download without trusting the network.
mkdir -p "$ROOT/scripts"
cat > "$ROOT/scripts/binaries.json" <<EOF
{
  "archive": "munim-ffmpeg-binaries.tar.gz",
  "sha256": "$(cat "$ARCHIVE.sha256")",
  "ffmpeg": "${FFMPEG_VERSION:-9.0.1}"
}
EOF

echo
echo "$ARCHIVE"
echo "  $(du -h "$ARCHIVE" | cut -f1), sha256 $(cat "$ARCHIVE.sha256")"
