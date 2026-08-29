#!/usr/bin/env bash
# Compiles FFmpeg's fftools plus the munim core, then merges everything for the
# slice into one static library: libmunimffmpeg.a.
set -euo pipefail

SDK_NAME="${1:-iphoneos}"
ARCH="${2:-arm64}"
MIN_IOS="${MIN_IOS:-15.1}"
SDK="$(xcrun -sdk "$SDK_NAME" --show-sdk-path)"
[ "$SDK_NAME" = "iphoneos" ] \
  && MIN_FLAG="-mios-version-min=$MIN_IOS" \
  || MIN_FLAG="-mios-simulator-version-min=$MIN_IOS"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
SOURCE="$WORKSPACE/ffmpeg-${FFMPEG_VERSION:-9.0.1}"
SLICE="$SDK_NAME-$ARCH"
PREFIX="$WORKSPACE/out/ios-$SLICE"
BUILD="$WORKSPACE/build/ios-$SLICE"
WORK="$WORKSPACE/build/ios-fftools-$SLICE"

CC="$(xcrun -f clang)"

rm -rf "$WORK"
mkdir -p "$WORK/obj" "$WORK/probe"
cp -R "$SOURCE/fftools" "$WORK/src"
bash "$HERE/fftools-hooks.sh" "$WORK/src"

CFLAGS=(
  -arch "$ARCH" -isysroot "$SDK" "$MIN_FLAG" -O2 -fPIC
  -D_ISOC11_SOURCE -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE
  -DPIC -DZLIB_CONST
  "-I$SOURCE/compat/stdbit"
  "-I$WORK" "-I$SOURCE" "-I$BUILD" "-I$PREFIX/include" "-I$HERE/src"
  -Wno-deprecated-declarations
  -Wno-incompatible-pointer-types-discards-qualifiers
)
FFTOOLS_CFLAGS=("${CFLAGS[@]}" -Dstrtod=avpriv_strtod)

SHARED_SOURCES=(
  cmdutils.c opt_common.c
  textformat/avtextformat.c textformat/tf_compact.c textformat/tf_default.c
  textformat/tf_flat.c textformat/tf_ini.c textformat/tf_json.c
  textformat/tf_mermaid.c textformat/tf_xml.c textformat/tw_avio.c
  textformat/tw_buffer.c textformat/tw_stdout.c
)
FFMPEG_SOURCES=(
  ffmpeg.c ffmpeg_dec.c ffmpeg_demux.c ffmpeg_enc.c ffmpeg_filter.c
  ffmpeg_hw.c ffmpeg_mux.c ffmpeg_mux_init.c ffmpeg_opt.c ffmpeg_sched.c
  sync_queue.c thread_queue.c graph/graphprint_stub.c
)

for file in "${SHARED_SOURCES[@]}" "${FFMPEG_SOURCES[@]}"; do
  mkdir -p "$WORK/obj/$(dirname "$file")"
  "$CC" "${FFTOOLS_CFLAGS[@]}" -Dmain=ffmpeg_main -c "$WORK/src/$file" \
    -o "$WORK/obj/${file%.c}.o"
done

# A static link pulls in both tools, and each defines program_name and
# show_help_default, so ffprobe's copies are renamed. cmdutils is shared.
"$CC" "${FFTOOLS_CFLAGS[@]}" \
  -Dmain=ffprobe_main \
  -Dprogram_name=ffprobe_program_name \
  -Dshow_help_default=ffprobe_show_help_default \
  -c "$WORK/src/ffprobe.c" -o "$WORK/probe/ffprobe.o"

"$CC" "${CFLAGS[@]}" -c "$HERE/src/munim_ffmpeg_core.c" -o "$WORK/obj/munim_ffmpeg_core.o"

# One library per slice keeps the xcframework and the download simple. Every
# static library in the prefix is merged, so adding a dependency to the build
# scripts does not also require editing this list.
rm -f "$PREFIX/lib/libmunimffmpeg.a"
xcrun libtool -static -no_warning_for_no_symbols \
  -o "$PREFIX/lib/libmunimffmpeg.a" \
  $(find "$WORK/obj" "$WORK/probe" -name '*.o') \
  "$PREFIX"/lib/*.a

echo "  built $(basename "$PREFIX")/lib/libmunimffmpeg.a ($(du -h "$PREFIX/lib/libmunimffmpeg.a" | cut -f1))"
