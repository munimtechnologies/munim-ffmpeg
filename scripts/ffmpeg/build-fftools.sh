#!/usr/bin/env bash
# Compiles FFmpeg 9's stock fftools into a callable library plus a device test
# harness, to find out how much patching an in-process `ffmpeg` really needs.
#
# The only source modification is a handful of lines appended to ffmpeg.c to
# expose cancel/reset for its file-static signal flags. Everything else is
# upstream, unmodified.
set -euo pipefail

NDK="${ANDROID_NDK:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}"
API="${ANDROID_API:-24}"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/darwin-x86_64"
CC="$TOOLCHAIN/bin/aarch64-linux-android$API-clang"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$ROOT/ffmpeg-9.0.1"
BUILD="$ROOT/build/android-arm64"
PREFIX="$ROOT/out/android-arm64"
WORK="$ROOT/build/fftools"

rm -rf "$WORK"
mkdir -p "$WORK/obj"
cp -R "$SOURCE/fftools" "$WORK/src"

bash "$ROOT/fftools-hooks.sh" "$WORK/src"

SOURCES=(
  cmdutils.c
  opt_common.c
  ffmpeg.c
  ffmpeg_dec.c
  ffmpeg_demux.c
  ffmpeg_enc.c
  ffmpeg_filter.c
  ffmpeg_hw.c
  ffmpeg_mux.c
  ffmpeg_mux_init.c
  ffmpeg_opt.c
  ffmpeg_sched.c
  sync_queue.c
  thread_queue.c
  graph/graphprint_stub.c
  textformat/avtextformat.c
  textformat/tf_compact.c
  textformat/tf_default.c
  textformat/tf_flat.c
  textformat/tf_ini.c
  textformat/tf_json.c
  textformat/tf_mermaid.c
  textformat/tf_xml.c
  textformat/tw_avio.c
  textformat/tw_buffer.c
  textformat/tw_stdout.c
)

# fftools calls ABinderProcess_setThreadPoolMaxThreadCount() at startup for
# MediaCodec. That aborts the process if a binder thread pool already exists,
# which is always true inside an Android app, so it is stubbed out: the app's
# own pool is already running.
cat > "$WORK/src/binder_stub.c" <<'BINDER'
void android_binder_threadpool_init_if_required(void)
{
}
BINDER
COMPAT_SOURCES=("$WORK/src/binder_stub.c")

# Mirror the CPPFLAGS FFmpeg's own build uses for fftools (see
# ffbuild/config.mak): the C23 stdbit shim and strtod override matter.
CFLAGS=(
  -O2 -fPIC -DANDROID
  -D_ISOC11_SOURCE -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE
  -Dstrtod=avpriv_strtod -DPIC -DZLIB_CONST
  "-I$SOURCE/compat/stdbit"
  -Dmain=ffmpeg_main
  "-I$WORK" "-I$SOURCE" "-I$BUILD" "-I$PREFIX/include" "-I$ROOT/jni"
  -Wno-deprecated-declarations -Wno-incompatible-pointer-types-discards-qualifiers
)

echo "Compiling ${#SOURCES[@]} fftools sources…"
for file in "${SOURCES[@]}"; do
  mkdir -p "$WORK/obj/$(dirname "$file")"
  "$CC" "${CFLAGS[@]}" -c "$WORK/src/$file" -o "$WORK/obj/${file%.c}.o"
done

for file in "${COMPAT_SOURCES[@]}"; do
  "$CC" "${CFLAGS[@]}" -c "$file" -o "$WORK/obj/$(basename "${file%.c}").o"
done

FFMPEG_LIBS=(-lavdevice -lavfilter -lavformat -lavcodec -lswresample -lswscale -lavutil)

# ffprobe lives in its own library: it defines program_name just like ffmpeg.c,
# so the two cannot share one link unit. -Bsymbolic keeps each library bound to
# its own copy of cmdutils.
echo "Building libmunimffprobe9.so…"
PROBE_SOURCES=(cmdutils.c opt_common.c ffprobe.c
  textformat/avtextformat.c textformat/tf_compact.c textformat/tf_default.c
  textformat/tf_flat.c textformat/tf_ini.c textformat/tf_json.c
  textformat/tf_mermaid.c textformat/tf_xml.c textformat/tw_avio.c
  textformat/tw_buffer.c textformat/tw_stdout.c)

mkdir -p "$WORK/probe"
for file in "${PROBE_SOURCES[@]}"; do
  mkdir -p "$WORK/probe/$(dirname "$file")"
  "$CC" "${CFLAGS[@]/-Dmain=ffmpeg_main/-Dmain=ffprobe_main}" \
    -c "$WORK/src/$file" -o "$WORK/probe/${file%.c}.o"
done

"$CC" -shared -fPIC -o "$WORK/libmunimffprobe9.so" \
  $(find "$WORK/probe" -name '*.o') \
  -L"$PREFIX/lib" "${FFMPEG_LIBS[@]}" -lm -lz -llog -landroid \
  -Wl,-Bsymbolic -Wl,-z,max-page-size=16384

echo "Building libmunimffmpeg9.so…"
# -Dstrtod=avpriv_strtod is for FFmpeg's own sources; the core and bridge must
# call the real strtod.
CORE_CFLAGS=()
for flag in "${CFLAGS[@]}"; do
  [ "$flag" = "-Dstrtod=avpriv_strtod" ] || CORE_CFLAGS+=("$flag")
done
"$CC" "${CORE_CFLAGS[@]}" -c "$ROOT/jni/munim_ffmpeg_core.c" -o "$WORK/obj/munim_ffmpeg_core.o"
"$CC" "${CORE_CFLAGS[@]}" -c "$ROOT/jni/android_bridge.c" -o "$WORK/obj/android_bridge.o"

"$CC" -shared -fPIC \
  -o "$WORK/libmunimffmpeg9.so" \
  $(find "$WORK/obj" -name '*.o') \
  -L"$PREFIX/lib" "${FFMPEG_LIBS[@]}" \
  -L"$WORK" -lmunimffprobe9 \
  -lm -lz -llog -landroid \
  -Wl,-Bsymbolic -Wl,-z,max-page-size=16384

echo "Built $WORK/libmunimffmpeg9.so and $WORK/libmunimffprobe9.so"
