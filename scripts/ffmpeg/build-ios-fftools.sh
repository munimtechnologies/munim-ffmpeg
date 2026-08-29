#!/usr/bin/env bash
# Compiles FFmpeg 9's fftools plus the munim core into one static library for
# iOS arm64.
#
# ffmpeg.c and ffprobe.c each define program_name and show_help_default, and a
# static link pulls in both, so ffprobe's copies are renamed. cmdutils is
# compiled once and shared.
set -euo pipefail

MIN_IOS="${MIN_IOS:-15.1}"
SDK="$(xcrun -sdk iphoneos --show-sdk-path)"
CC="$(xcrun -f clang)"
AR="$(xcrun -f ar)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$ROOT/ffmpeg-9.0.1"
BUILD="$ROOT/build/ios-arm64"
PREFIX="$ROOT/out/ios-arm64"
WORK="$ROOT/build/ios-fftools"

rm -rf "$WORK"
mkdir -p "$WORK/obj"
cp -R "$SOURCE/fftools" "$WORK/src"
bash "$ROOT/fftools-hooks.sh" "$WORK/src"

BASE_CFLAGS=(
  -arch arm64 -isysroot "$SDK" "-mios-version-min=$MIN_IOS"
  -O2 -fPIC
  -D_ISOC11_SOURCE -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE
  -Dstrtod=avpriv_strtod -DPIC -DZLIB_CONST
  "-I$SOURCE/compat/stdbit"
  "-I$WORK" "-I$SOURCE" "-I$BUILD" "-I$PREFIX/include" "-I$ROOT/jni"
  -Wno-deprecated-declarations
  -Wno-incompatible-pointer-types-discards-qualifiers
)

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

compile() { # output-dir extra-flags... -- sources...
  local outdir="$1"; shift
  local flags=()
  while [ "$1" != "--" ]; do flags+=("$1"); shift; done
  shift
  for file in "$@"; do
    mkdir -p "$outdir/$(dirname "$file")"
    "$CC" "${BASE_CFLAGS[@]}" "${flags[@]}" -c "$WORK/src/$file" \
      -o "$outdir/${file%.c}.o"
  done
}

echo "Compiling shared fftools sources…"
compile "$WORK/obj" -Dmain=ffmpeg_main -- "${SHARED_SOURCES[@]}"

echo "Compiling ffmpeg…"
compile "$WORK/obj" -Dmain=ffmpeg_main -- "${FFMPEG_SOURCES[@]}"

echo "Compiling ffprobe…"
compile "$WORK/obj/probe" \
  -Dmain=ffprobe_main \
  -Dprogram_name=ffprobe_program_name \
  -Dshow_help_default=ffprobe_show_help_default \
  -- ffprobe.c

echo "Compiling the munim core…"
# -Dstrtod=avpriv_strtod is for FFmpeg's own sources; applying it here would
# redirect the core's strtod calls to an internal symbol it cannot link against.
CORE_CFLAGS=()
for flag in "${BASE_CFLAGS[@]}"; do
  [ "$flag" = "-Dstrtod=avpriv_strtod" ] || CORE_CFLAGS+=("$flag")
done
"$CC" "${CORE_CFLAGS[@]}" -c "$ROOT/jni/munim_ffmpeg_core.c" \
  -o "$WORK/obj/munim_ffmpeg_core.o"

"$AR" rcs "$PREFIX/lib/libmunimffmpeg9.a" $(find "$WORK/obj" -name '*.o')
echo "Built $PREFIX/lib/libmunimffmpeg9.a"
ls -lh "$PREFIX/lib/libmunimffmpeg9.a" | awk '{print $5}'
