#!/usr/bin/env bash
# Compiles FFmpeg's fftools plus the munim core into the two shared libraries
# the Kotlin layer loads, for one Android ABI.
set -euo pipefail

ABI="${1:-arm64-v8a}"
NDK="${ANDROID_NDK:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}"
API="${ANDROID_API:-24}"
HOST_TAG="$(ls "$NDK/toolchains/llvm/prebuilt" | head -1)"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/$HOST_TAG"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
SOURCE="$WORKSPACE/ffmpeg-${FFMPEG_VERSION:-9.0.1}"
PREFIX="$WORKSPACE/out/android-$ABI"
BUILD="$WORKSPACE/build/android-$ABI"
WORK="$WORKSPACE/build/fftools-$ABI"

case "$ABI" in
  arm64-v8a)   TRIPLE=aarch64-linux-android; EXTRA_CFLAGS="" ;;
  armeabi-v7a) TRIPLE=armv7a-linux-androideabi; EXTRA_CFLAGS="-mfpu=neon -mfloat-abi=softfp" ;;
  x86_64)      TRIPLE=x86_64-linux-android; EXTRA_CFLAGS="" ;;
  *) echo "Unsupported ABI: $ABI" >&2; exit 1 ;;
esac

CC="$TOOLCHAIN/bin/$TRIPLE$API-clang"

rm -rf "$WORK"
mkdir -p "$WORK/obj" "$WORK/probe"
cp -R "$SOURCE/fftools" "$WORK/src"
bash "$HERE/fftools-hooks.sh" "$WORK/src"

# fftools calls ABinderProcess_setThreadPoolMaxThreadCount() at startup for
# MediaCodec. That aborts when a binder thread pool already exists, which is
# always true inside an app, so it is replaced with a no-op.
cat > "$WORK/src/binder_stub.c" <<'BINDER'
void android_binder_threadpool_init_if_required(void)
{
}
BINDER

CFLAGS=(
  -O2 -fPIC -DANDROID $EXTRA_CFLAGS
  -D_ISOC11_SOURCE -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE
  -DPIC -DZLIB_CONST
  "-I$SOURCE/compat/stdbit"
  "-I$WORK" "-I$SOURCE" "-I$BUILD" "-I$PREFIX/include" "-I$HERE/src"
  -Wno-deprecated-declarations
  -Wno-incompatible-pointer-types-discards-qualifiers
)
# FFmpeg's own sources expect this; the core and bridge must not have it.
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
  sync_queue.c thread_queue.c graph/graphprint_stub.c binder_stub.c
)

for file in "${SHARED_SOURCES[@]}" "${FFMPEG_SOURCES[@]}"; do
  mkdir -p "$WORK/obj/$(dirname "$file")"
  "$CC" "${FFTOOLS_CFLAGS[@]}" -Dmain=ffmpeg_main -c "$WORK/src/$file" \
    -o "$WORK/obj/${file%.c}.o"
done

# ffprobe defines program_name and show_help_default just like ffmpeg.c, so it
# gets its own library with its own copy of cmdutils.
for file in "${SHARED_SOURCES[@]}" ffprobe.c; do
  mkdir -p "$WORK/probe/$(dirname "$file")"
  "$CC" "${FFTOOLS_CFLAGS[@]}" -Dmain=ffprobe_main -c "$WORK/src/$file" \
    -o "$WORK/probe/${file%.c}.o"
done

"$CC" "${CFLAGS[@]}" -c "$HERE/src/munim_ffmpeg_core.c" -o "$WORK/obj/munim_ffmpeg_core.o"
"$CC" "${CFLAGS[@]}" -c "$HERE/src/android_bridge.c" -o "$WORK/obj/android_bridge.o"

FFMPEG_LIBS=(-lavdevice -lavfilter -lavformat -lavcodec -lswresample -lswscale -lavutil)
LINK_FLAGS=(-L"$PREFIX/lib" "${FFMPEG_LIBS[@]}" -lm -lz -llog -landroid
            -Wl,-Bsymbolic -Wl,-z,max-page-size=16384)

"$CC" -shared -fPIC -o "$PREFIX/lib/libmunimffprobe9.so" \
  $(find "$WORK/probe" -name '*.o') "${LINK_FLAGS[@]}"

"$CC" -shared -fPIC -o "$PREFIX/lib/libmunimffmpeg9.so" \
  $(find "$WORK/obj" -name '*.o') "${LINK_FLAGS[@]}" \
  -L"$PREFIX/lib" -lmunimffprobe9

echo "  built libmunimffmpeg9.so and libmunimffprobe9.so"
