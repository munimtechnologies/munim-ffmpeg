#!/usr/bin/env bash
# Compiles FFmpeg's fftools plus the munim core, then links them with the
# static FFmpeg libraries and every dependency into the single shared library
# the Kotlin layer loads: libmunimffmpeg.so.
set -euo pipefail

ABI="${1:-arm64-v8a}"
NDK="${ANDROID_NDK:-${ANDROID_NDK_HOME:-${ANDROID_NDK_LATEST_HOME:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}}}"
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
STRIP="$TOOLCHAIN/bin/llvm-strip"

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
  -O2 -fPIC -DANDROID -ffunction-sections -fdata-sections $EXTRA_CFLAGS
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

# ffprobe defines program_name, program_birth_year and show_help_default just
# like ffmpeg.c, so its
# copies are renamed and cmdutils is shared; both tools live in one library.
"$CC" "${FFTOOLS_CFLAGS[@]}" \
  -Dmain=ffprobe_main \
  -Dprogram_name=ffprobe_program_name \
  -Dprogram_birth_year=ffprobe_program_birth_year \
  -Dshow_help_default=ffprobe_show_help_default \
  -c "$WORK/src/ffprobe.c" -o "$WORK/probe/ffprobe.o"

"$CC" "${CFLAGS[@]}" -c "$HERE/src/munim_ffmpeg_core.c" -o "$WORK/obj/munim_ffmpeg_core.o"
"$CC" "${CFLAGS[@]}" -c "$HERE/src/android_bridge.c" -o "$WORK/obj/android_bridge.o"

# FFmpeg and every dependency are static archives, so the app loads exactly one
# library (issue #8). pkg-config expands the full static link line from
# FFmpeg's own .pc files, so adding a dependency to build-android.sh does not
# also require editing a list here.
FFMPEG_LIBS="$(PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" pkg-config --static --libs \
  libavdevice libavfilter libavformat libavcodec libswresample libswscale libavutil)"

# Only the JNI entry points are exported: FFmpeg's symbols stay internal, which
# keeps the dynamic symbol table small and avoids clashing with any other
# FFmpeg an app might carry.
cat > "$WORK/exports.map" <<'MAP'
{ global: JNI_OnLoad; Java_*; local: *; };
MAP

rm -f "$PREFIX"/lib/libmunimff*.so
"$CC" -shared -fPIC -o "$PREFIX/lib/libmunimffmpeg.so" \
  $(find "$WORK/obj" "$WORK/probe" -name '*.o') \
  -L"$PREFIX/lib" -Wl,--start-group $FFMPEG_LIBS -Wl,--end-group \
  -lc++_shared -lm -lz -llog -landroid \
  -Wl,-Bsymbolic -Wl,--gc-sections -Wl,--exclude-libs,ALL \
  -Wl,--version-script="$WORK/exports.map" \
  -Wl,-z,max-page-size=16384

# Gradle strips native libraries when it packages an app anyway; doing it here
# keeps the local symbol table (over half the file) out of the download.
"$STRIP" --strip-unneeded "$PREFIX/lib/libmunimffmpeg.so"

echo "  built libmunimffmpeg.so ($(du -h "$PREFIX/lib/libmunimffmpeg.so" | cut -f1))"
