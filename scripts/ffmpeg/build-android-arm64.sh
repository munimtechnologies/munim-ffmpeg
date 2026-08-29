#!/usr/bin/env bash
# Cross-compiles FFmpeg for Android arm64-v8a.
#
# Non-GPL configuration: LAME, Opus, libvpx, dav1d and mbedTLS come from
# build-android-libs.sh. x264/x265/xvid are deliberately absent — MediaCodec
# provides hardware H.264/HEVC encoding, so the package stays LGPL.
set -euo pipefail

NDK="${ANDROID_NDK:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}"
API="${ANDROID_API:-24}"
HOST_TAG="darwin-x86_64"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/$HOST_TAG"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$ROOT/ffmpeg-9.0.1"
PREFIX="$ROOT/out/android-arm64"
BUILD="$ROOT/build/android-arm64"

test -d "$TOOLCHAIN" || { echo "NDK toolchain not found: $TOOLCHAIN" >&2; exit 1; }
test -d "$SOURCE" || { echo "FFmpeg source not found: $SOURCE" >&2; exit 1; }

# keep $PREFIX: the external libraries were installed there first
rm -rf "$BUILD"
mkdir -p "$BUILD" "$PREFIX"
cd "$BUILD"

"$SOURCE/configure" \
  --prefix="$PREFIX" \
  --target-os=android \
  --arch=aarch64 \
  --cpu=armv8-a \
  --enable-cross-compile \
  --sysroot="$TOOLCHAIN/sysroot" \
  --cc="$TOOLCHAIN/bin/aarch64-linux-android$API-clang" \
  --cxx="$TOOLCHAIN/bin/aarch64-linux-android$API-clang++" \
  --ar="$TOOLCHAIN/bin/llvm-ar" \
  --nm="$TOOLCHAIN/bin/llvm-nm" \
  --ranlib="$TOOLCHAIN/bin/llvm-ranlib" \
  --strip="$TOOLCHAIN/bin/llvm-strip" \
  --extra-cflags="-O2 -fPIC -DANDROID -I$PREFIX/include" \
  --extra-ldflags="-Wl,-z,max-page-size=16384 -L$PREFIX/lib" \
  --pkg-config-flags=--static \
  --disable-autodetect \
  --enable-shared \
  --disable-static \
  --enable-pic \
  --enable-neon \
  --enable-asm \
  --enable-inline-asm \
  --enable-jni \
  --enable-mediacodec \
  --enable-zlib \
  --enable-libmp3lame \
  --enable-libopus \
  --enable-libvpx \
  --enable-libdav1d \
  --enable-mbedtls \
  --enable-version3 \
  --enable-pthreads \
  --enable-swscale \
  --enable-avfilter \
  --enable-network \
  --enable-protocol=file,pipe,http,tcp,https,tls,crypto,data,concat,concatf \
  --disable-programs \
  --disable-doc \
  --disable-debug \
  --disable-vulkan \
  --disable-v4l2-m2m \
  --disable-indev=android_camera

make -j"$(sysctl -n hw.ncpu)"
make install

echo
echo "Built into $PREFIX"
ls -la "$PREFIX/lib"/*.so 2>/dev/null || true
