#!/usr/bin/env bash
# Cross-compiles the non-GPL external libraries FFmpeg links against.
#
# Deliberately excluded: x264, x265, xvid, vid.stab (all GPL). H.264/HEVC
# encoding comes from MediaCodec instead, which keeps the whole package LGPL.
set -euo pipefail

NDK="${ANDROID_NDK:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}"
API="${ANDROID_API:-24}"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/darwin-x86_64"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPS="$ROOT/deps"
PREFIX="$ROOT/out/android-arm64"
JOBS="$(sysctl -n hw.ncpu)"

export CC="$TOOLCHAIN/bin/aarch64-linux-android$API-clang"
export CXX="$TOOLCHAIN/bin/aarch64-linux-android$API-clang++"
export AR="$TOOLCHAIN/bin/llvm-ar"
export RANLIB="$TOOLCHAIN/bin/llvm-ranlib"
export STRIP="$TOOLCHAIN/bin/llvm-strip"
export NM="$TOOLCHAIN/bin/llvm-nm"
export CFLAGS="-O2 -fPIC -DANDROID"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-Wl,-z,max-page-size=16384"

HOST=aarch64-linux-android
mkdir -p "$DEPS" "$PREFIX"

fetch() { # url filename
  local url="$1" file="$2"
  [ -f "$DEPS/$file" ] || curl -sL -o "$DEPS/$file" "$url"
}

if [ -f "$PREFIX/lib/libmp3lame.a" ]; then echo "=== LAME (LGPL) — already built ==="; else
echo "=== LAME (LGPL) ==="
fetch "https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz" lame-3.100.tar.gz
rm -rf "$DEPS/lame-3.100"; tar xf "$DEPS/lame-3.100.tar.gz" -C "$DEPS"
(
  cd "$DEPS/lame-3.100"
  # 3.100 predates modern clang; these two are the standard Android fixes.
  sed -i '' '/lame_init_old/d' include/libmp3lame.sym
  ./configure --host="$HOST" --prefix="$PREFIX" \
    --disable-shared --enable-static --disable-frontend --disable-analyzer-hooks
  make -j"$JOBS" && make install
) > "$ROOT/build/lame.log" 2>&1
fi

if [ -f "$PREFIX/lib/libopus.a" ]; then echo "=== Opus (BSD) — already built ==="; else
echo "=== Opus (BSD) ==="
fetch "https://downloads.xiph.org/releases/opus/opus-1.5.2.tar.gz" opus-1.5.2.tar.gz
rm -rf "$DEPS/opus-1.5.2"; tar xf "$DEPS/opus-1.5.2.tar.gz" -C "$DEPS"
(
  cd "$DEPS/opus-1.5.2"
  ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
    --disable-doc --disable-extra-programs
  make -j"$JOBS" && make install
) > "$ROOT/build/opus.log" 2>&1
fi

if [ -f "$PREFIX/lib/libvpx.a" ]; then echo "=== libvpx (BSD) — already built ==="; else
echo "=== libvpx (BSD) ==="
fetch "https://github.com/webmproject/libvpx/archive/refs/tags/v1.15.0.tar.gz" libvpx-1.15.0.tar.gz
rm -rf "$DEPS/libvpx-1.15.0"; tar xf "$DEPS/libvpx-1.15.0.tar.gz" -C "$DEPS"
(
  cd "$DEPS/libvpx-1.15.0"
  PATH="$TOOLCHAIN/bin:$PATH" ./configure --target=arm64-android-gcc \
    --prefix="$PREFIX" --disable-shared --enable-static --enable-pic \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests \
    --enable-vp8 --enable-vp9 --enable-vp9-highbitdepth
  make -j"$JOBS" && make install
) > "$ROOT/build/libvpx.log" 2>&1
fi

if [ -f "$PREFIX/lib/libdav1d.a" ]; then echo "=== dav1d (BSD, AV1 decoding) — already built ==="; else
echo "=== dav1d (BSD, AV1 decoding) ==="
if command -v meson >/dev/null 2>&1; then
  fetch "https://code.videolan.org/videolan/dav1d/-/archive/1.5.1/dav1d-1.5.1.tar.gz" dav1d-1.5.1.tar.gz
  rm -rf "$DEPS/dav1d-1.5.1"; tar xf "$DEPS/dav1d-1.5.1.tar.gz" -C "$DEPS"
  (
    cd "$DEPS/dav1d-1.5.1"
    cat > android-arm64.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
pkg-config = 'pkg-config'
[host_machine]
system = 'android'
cpu_family = 'aarch64'
cpu = 'aarch64'
endian = 'little'
EOF
    meson setup build --cross-file android-arm64.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release -Denable_tools=false -Denable_tests=false
    ninja -C build && ninja -C build install
  ) > "$ROOT/build/dav1d.log" 2>&1
else
  echo "  meson not installed, skipping dav1d"
fi
fi

if [ -f "$PREFIX/lib/libmbedtls.a" ]; then echo "=== mbedTLS (Apache-2.0, for https) — already built ==="; else
echo "=== mbedTLS (Apache-2.0, for https) ==="
fetch "https://github.com/Mbed-TLS/mbedtls/releases/download/mbedtls-3.6.2/mbedtls-3.6.2.tar.bz2" mbedtls-3.6.2.tar.bz2
rm -rf "$DEPS/mbedtls-3.6.2"; tar xf "$DEPS/mbedtls-3.6.2.tar.bz2" -C "$DEPS"
(
  cd "$DEPS/mbedtls-3.6.2"
  cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM="android-$API" \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" -DUSE_SHARED_MBEDTLS_LIBRARY=OFF \
    -DENABLE_TESTING=OFF -DENABLE_PROGRAMS=OFF -DCMAKE_BUILD_TYPE=Release
  cmake --build build -j"$JOBS" && cmake --install build
) > "$ROOT/build/mbedtls.log" 2>&1
fi

echo
echo "Installed into $PREFIX/lib:"
ls "$PREFIX/lib"/*.a 2>/dev/null | xargs -n1 basename
