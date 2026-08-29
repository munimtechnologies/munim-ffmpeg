#!/usr/bin/env bash
# Cross-compiles the non-GPL external libraries for iOS arm64 (device).
#
# No mbedTLS here: FFmpeg uses Apple's SecureTransport for TLS on iOS.
set -euo pipefail

MIN_IOS="${MIN_IOS:-15.1}"
SDK="$(xcrun -sdk iphoneos --show-sdk-path)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPS="$ROOT/deps"
PREFIX="$ROOT/out/ios-arm64"
JOBS="$(sysctl -n hw.ncpu)"

export CC="$(xcrun -f clang)"
export CXX="$(xcrun -f clang++)"
export AR="$(xcrun -f ar)"
export RANLIB="$(xcrun -f ranlib)"
export STRIP="$(xcrun -f strip)"
export CFLAGS="-arch arm64 -isysroot $SDK -mios-version-min=$MIN_IOS -fPIC -O2"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-arch arm64 -isysroot $SDK -mios-version-min=$MIN_IOS"

HOST=aarch64-apple-darwin
mkdir -p "$DEPS" "$PREFIX" "$ROOT/build"

fetch() {
  [ -f "$DEPS/$2" ] || curl -sL -o "$DEPS/$2" "$1"
}

if [ -f "$PREFIX/lib/libmp3lame.a" ]; then echo "=== LAME — already built ==="; else
echo "=== LAME (LGPL) ==="
fetch "https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz" lame-3.100.tar.gz
rm -rf "$DEPS/lame-ios"; mkdir -p "$DEPS/lame-ios"
tar xf "$DEPS/lame-3.100.tar.gz" -C "$DEPS/lame-ios" --strip-components=1
(
  cd "$DEPS/lame-ios"
  sed -i '' '/lame_init_old/d' include/libmp3lame.sym
  ./configure --host="$HOST" --prefix="$PREFIX" \
    --disable-shared --enable-static --disable-frontend --disable-analyzer-hooks
  # LAME 3.100 predates C99 and relies on implicit declarations, which modern
  # clang rejects. The force-includes only go in at compile time: adding them to
  # configure's CFLAGS breaks its probe programs.
  make -j"$JOBS" CFLAGS="$CFLAGS -DHAVE_MEMCPY=1 -DHAVE_STRCHR=1 -include string.h -include stdlib.h -Wno-implicit-function-declaration"
  make install
) > "$ROOT/build/lame-ios.log" 2>&1
fi

if [ -f "$PREFIX/lib/libopus.a" ]; then echo "=== Opus — already built ==="; else
echo "=== Opus (BSD) ==="
fetch "https://downloads.xiph.org/releases/opus/opus-1.5.2.tar.gz" opus-1.5.2.tar.gz
rm -rf "$DEPS/opus-ios"; mkdir -p "$DEPS/opus-ios"
tar xf "$DEPS/opus-1.5.2.tar.gz" -C "$DEPS/opus-ios" --strip-components=1
(
  cd "$DEPS/opus-ios"
  ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
    --disable-doc --disable-extra-programs
  make -j"$JOBS" && make install
) > "$ROOT/build/opus-ios.log" 2>&1
fi

if [ -f "$PREFIX/lib/libvpx.a" ]; then echo "=== libvpx — already built ==="; else
echo "=== libvpx (BSD) ==="
fetch "https://github.com/webmproject/libvpx/archive/refs/tags/v1.15.0.tar.gz" libvpx-1.15.0.tar.gz
rm -rf "$DEPS/libvpx-ios"; mkdir -p "$DEPS/libvpx-ios"
tar xf "$DEPS/libvpx-1.15.0.tar.gz" -C "$DEPS/libvpx-ios" --strip-components=1
(
  cd "$DEPS/libvpx-ios"
  ./configure --target=arm64-darwin-gcc --prefix="$PREFIX" \
    --disable-shared --enable-static --enable-pic \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests \
    --enable-vp8 --enable-vp9 --enable-vp9-highbitdepth
  make -j"$JOBS" && make install
) > "$ROOT/build/libvpx-ios.log" 2>&1
fi

if [ -f "$PREFIX/lib/libdav1d.a" ]; then echo "=== dav1d — already built ==="; else
echo "=== dav1d (BSD, AV1 decoding) ==="
fetch "https://code.videolan.org/videolan/dav1d/-/archive/1.5.1/dav1d-1.5.1.tar.gz" dav1d-1.5.1.tar.gz
rm -rf "$DEPS/dav1d-ios"; mkdir -p "$DEPS/dav1d-ios"
tar xf "$DEPS/dav1d-1.5.1.tar.gz" -C "$DEPS/dav1d-ios" --strip-components=1
(
  cd "$DEPS/dav1d-ios"
  cat > ios-arm64.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = ['-arch', 'arm64', '-isysroot', '$SDK', '-mios-version-min=$MIN_IOS']
c_link_args = ['-arch', 'arm64', '-isysroot', '$SDK', '-mios-version-min=$MIN_IOS']
[host_machine]
system = 'darwin'
cpu_family = 'aarch64'
cpu = 'aarch64'
endian = 'little'
EOF
  meson setup build --cross-file ios-arm64.txt --prefix="$PREFIX" \
    --default-library=static --buildtype=release -Denable_tools=false -Denable_tests=false
  ninja -C build && ninja -C build install
) > "$ROOT/build/dav1d-ios.log" 2>&1
fi

echo
echo "Installed into $PREFIX/lib:"
ls "$PREFIX/lib"/*.a 2>/dev/null | xargs -n1 basename
