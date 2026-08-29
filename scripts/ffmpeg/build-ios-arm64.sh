#!/usr/bin/env bash
# Cross-compiles FFmpeg 9 for iOS arm64 (device) as static libraries.
#
# VideoToolbox and AudioToolbox provide hardware H.264/HEVC, and SecureTransport
# provides TLS, so no GPL encoder and no bundled TLS library are needed.
set -euo pipefail

MIN_IOS="${MIN_IOS:-15.1}"
SDK="$(xcrun -sdk iphoneos --show-sdk-path)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$ROOT/ffmpeg-9.0.1"
PREFIX="$ROOT/out/ios-arm64"
BUILD="$ROOT/build/ios-arm64"

rm -rf "$BUILD"
mkdir -p "$BUILD" "$PREFIX"
cd "$BUILD"

"$SOURCE/configure" \
  --prefix="$PREFIX" \
  --target-os=darwin \
  --arch=arm64 \
  --cpu=generic \
  --enable-cross-compile \
  --sysroot="$SDK" \
  --cc="$(xcrun -f clang)" \
  --cxx="$(xcrun -f clang++)" \
  --ar="$(xcrun -f ar)" \
  --ranlib="$(xcrun -f ranlib)" \
  --strip="$(xcrun -f strip)" \
  --extra-cflags="-arch arm64 -isysroot $SDK -mios-version-min=$MIN_IOS -fPIC -O2 -I$PREFIX/include" \
  --extra-ldflags="-arch arm64 -isysroot $SDK -mios-version-min=$MIN_IOS -L$PREFIX/lib" \
  --disable-autodetect \
  --enable-static \
  --disable-shared \
  --enable-pic \
  --enable-neon \
  --enable-asm \
  --enable-videotoolbox \
  --enable-audiotoolbox \
  --enable-securetransport \
  --enable-zlib \
  --enable-libmp3lame \
  --enable-libopus \
  --enable-libvpx \
  --enable-libdav1d \
  --enable-pthreads \
  --enable-swscale \
  --enable-avfilter \
  --enable-network \
  --enable-protocol=file,pipe,http,tcp,https,tls,crypto,data,concat,concatf \
  --disable-programs \
  --disable-doc \
  --disable-debug \
  --disable-vulkan \
  --disable-avdevice

make -j"$(sysctl -n hw.ncpu)"
make install

echo
echo "Built into $PREFIX"
ls -la "$PREFIX/lib"/*.a 2>/dev/null || true
