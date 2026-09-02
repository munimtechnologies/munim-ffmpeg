#!/usr/bin/env bash
# Builds FFmpeg and the munim core for one iOS slice.
#
#   ./build-ios.sh iphoneos arm64
#   ./build-ios.sh iphonesimulator arm64
#   ./build-ios.sh iphonesimulator x86_64
#
# package-ios.sh then merges the slices into a single .xcframework.
set -euo pipefail

SDK_NAME="${1:-iphoneos}"
ARCH="${2:-arm64}"
MIN_IOS="${MIN_IOS:-15.1}"
SDK="$(xcrun -sdk "$SDK_NAME" --show-sdk-path)"

case "$SDK_NAME" in
  iphoneos)        MIN_FLAG="-mios-version-min=$MIN_IOS"; MESON_SUBSYSTEM=ios ;;
  iphonesimulator) MIN_FLAG="-mios-simulator-version-min=$MIN_IOS"; MESON_SUBSYSTEM=ios-simulator ;;
  *) echo "Unsupported SDK: $SDK_NAME" >&2; exit 1 ;;
esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
SOURCE="$WORKSPACE/ffmpeg-${FFMPEG_VERSION:-9.0.1}"
DEPS="$WORKSPACE/deps"
SLICE="$SDK_NAME-$ARCH"
PREFIX="$WORKSPACE/out/ios-$SLICE"
BUILD="$WORKSPACE/build/ios-$SLICE"
JOBS="$(sysctl -n hw.ncpu)"

export CC="$(xcrun -f clang)"
export CXX="$(xcrun -f clang++)"
export AR="$(xcrun -f ar)"
export RANLIB="$(xcrun -f ranlib)"
export STRIP="$(xcrun -f strip)"
export CFLAGS="-arch $ARCH -isysroot $SDK $MIN_FLAG -fPIC -O2"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-arch $ARCH -isysroot $SDK $MIN_FLAG"

case "$ARCH" in
  arm64)
    HOST=aarch64-apple-darwin; FF_ARCH=arm64
    # libvpx has no arm64 simulator target, and its arm64-darwin one builds
    # against the macOS SDK, which then fails to link. generic-gnu compiles
    # portable C with our own flags instead.
    [ "$SDK_NAME" = "iphoneos" ] && VPX_TARGET=arm64-darwin-gcc || VPX_TARGET=generic-gnu
    ;;
  x86_64) HOST=x86_64-apple-darwin;  FF_ARCH=x86_64; VPX_TARGET=x86_64-iphonesimulator-gcc ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

mkdir -p "$DEPS" "$PREFIX" "$WORKSPACE/build"
test -d "$SOURCE" || { echo "FFmpeg source missing: $SOURCE (run fetch-source.sh)" >&2; exit 1; }

fetch() { [ -f "$DEPS/$2" ] || curl -sL -o "$DEPS/$2" "$1"; }
unpack() { rm -rf "$DEPS/$2"; mkdir -p "$DEPS/$2"; tar xf "$DEPS/$1" -C "$DEPS/$2" --strip-components=1; }

echo "==> external libraries for $SLICE"

if [ ! -f "$PREFIX/lib/libmp3lame.a" ]; then
  echo "  LAME"
  fetch "https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz" lame-3.100.tar.gz
  unpack lame-3.100.tar.gz "lame-$SLICE"
  (
    cd "$DEPS/lame-$SLICE"
    sed -i.bak '/lame_init_old/d' include/libmp3lame.sym && rm -f include/libmp3lame.sym.bak
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-frontend --disable-analyzer-hooks
    make -j"$JOBS" CFLAGS="$CFLAGS -include string.h -include stdlib.h -Wno-implicit-function-declaration"
    make install
  ) > "$WORKSPACE/build/lame-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libopus.a" ]; then
  echo "  Opus"
  fetch "https://downloads.xiph.org/releases/opus/opus-1.5.2.tar.gz" opus-1.5.2.tar.gz
  unpack opus-1.5.2.tar.gz "opus-$SLICE"
  (
    cd "$DEPS/opus-$SLICE"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-doc --disable-extra-programs
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/opus-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libvpx.a" ]; then
  echo "  libvpx"
  fetch "https://github.com/webmproject/libvpx/archive/refs/tags/v1.15.0.tar.gz" libvpx-1.15.0.tar.gz
  unpack libvpx-1.15.0.tar.gz "libvpx-$SLICE"
  (
    cd "$DEPS/libvpx-$SLICE"
    ./configure --target="$VPX_TARGET" --prefix="$PREFIX" \
      --disable-shared --enable-static --enable-pic \
      --disable-examples --disable-tools --disable-docs --disable-unit-tests \
      --enable-vp8 --enable-vp9 --enable-vp9-highbitdepth
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/libvpx-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libdav1d.a" ]; then
  echo "  dav1d"
  fetch "https://code.videolan.org/videolan/dav1d/-/archive/1.5.1/dav1d-1.5.1.tar.gz" dav1d-1.5.1.tar.gz
  unpack dav1d-1.5.1.tar.gz "dav1d-$SLICE"
  (
    cd "$DEPS/dav1d-$SLICE"
    [ "$ARCH" = "arm64" ] && MESON_CPU_FAMILY=aarch64 || MESON_CPU_FAMILY=x86_64
    cat > cross.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
c_link_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
[host_machine]
system = 'darwin'
subsystem = '$MESON_SUBSYSTEM'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU_FAMILY'
endian = 'little'
EOF
    meson setup build --cross-file cross.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release \
      -Denable_tools=false -Denable_tests=false
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/dav1d-$SLICE.log" 2>&1
fi

# AVIF encoding (issue #6): libaom provides the AV1 encoder; dav1d keeps
# decoding, so libaom's own decoder is compiled out. libaom ships toolchains
# for the device and the x86_64 simulator only, so one file covers all three
# slices the same way its own do.
if [ ! -f "$PREFIX/lib/libaom.a" ]; then
  echo "  libaom"
  fetch "https://storage.googleapis.com/aom-releases/libaom-3.15.0.tar.gz" libaom-3.15.0.tar.gz
  unpack libaom-3.15.0.tar.gz "libaom-$SLICE"
  (
    cd "$DEPS/libaom-$SLICE"
    cat > toolchain-ios.cmake <<EOF
set(CMAKE_SYSTEM_NAME Darwin)
set(CMAKE_SYSTEM_PROCESSOR $ARCH)
set(CMAKE_OSX_ARCHITECTURES $ARCH)
set(CMAKE_OSX_SYSROOT $SDK)
set(CMAKE_C_COMPILER $CC)
set(CMAKE_CXX_COMPILER $CXX)
set(CMAKE_C_FLAGS_INIT "-arch $ARCH $MIN_FLAG")
set(CMAKE_CXX_FLAGS_INIT "-arch $ARCH $MIN_FLAG")
set(CMAKE_EXE_LINKER_FLAGS_INIT "-arch $ARCH $MIN_FLAG")
EOF
    # Apple silicon has no SVE, and Apple's clang rejects the flags anyway.
    cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$PWD/toolchain-ios.cmake" \
      -DCMAKE_INSTALL_PREFIX="$PREFIX" -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=0 -DCONFIG_PIC=1 -DCONFIG_AV1_DECODER=0 \
      -DENABLE_SVE=0 -DENABLE_SVE2=0 \
      -DENABLE_EXAMPLES=0 -DENABLE_TESTS=0 -DENABLE_TOOLS=0 -DENABLE_DOCS=0
    cmake --build build -j"$JOBS" && cmake --install build
  ) > "$WORKSPACE/build/libaom-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libopenh264.a" ]; then
  echo "  openh264"
  fetch "https://github.com/cisco/openh264/archive/refs/tags/v2.6.0.tar.gz" openh264-2.6.0.tar.gz
  unpack openh264-2.6.0.tar.gz "openh264-$SLICE"
  (
    cd "$DEPS/openh264-$SLICE"
    [ "$ARCH" = "arm64" ] && MESON_CPU_FAMILY=aarch64 || MESON_CPU_FAMILY=x86_64
    cat > cross-openh264.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
cpp_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
c_link_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
cpp_link_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
[host_machine]
system = 'darwin'
subsystem = '$MESON_SUBSYSTEM'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU_FAMILY'
endian = 'little'
EOF
    meson setup build --cross-file cross-openh264.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release -Dtests=disabled
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/openh264-$SLICE.log" 2>&1
fi

# FreeType's freetype2.pc declares `Requires.private: zlib`, and the iOS SDK
# ships zlib without a .pc file, so pkg-config would otherwise refuse every
# package that depends on FreeType.
mkdir -p "$PREFIX/lib/pkgconfig"
if [ ! -f "$PREFIX/lib/pkgconfig/zlib.pc" ]; then
  cat > "$PREFIX/lib/pkgconfig/zlib.pc" <<'ZLIBPC'
Name: zlib
Description: zlib from the platform sysroot
Version: 1.3
Libs: -lz
ZLIBPC
fi

# The subtitle stack (issue #1): FreeType, FriBidi and HarfBuzz shape and
# rasterise text, libass renders ASS/SSA. On iOS libass finds system fonts
# through Core Text, so no fontconfig is needed.
if [ ! -f "$PREFIX/lib/libfreetype.a" ]; then
  echo "  FreeType"
  fetch "https://download.savannah.gnu.org/releases/freetype/freetype-2.13.3.tar.xz" freetype-2.13.3.tar.xz
  unpack freetype-2.13.3.tar.xz "freetype-$SLICE"
  (
    cd "$DEPS/freetype-$SLICE"
    PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --with-zlib=yes --without-png --without-harfbuzz --without-brotli --without-bzip2
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/freetype-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libfribidi.a" ]; then
  echo "  FriBidi"
  fetch "https://github.com/fribidi/fribidi/releases/download/v1.0.16/fribidi-1.0.16.tar.xz" fribidi-1.0.16.tar.xz
  unpack fribidi-1.0.16.tar.xz "fribidi-$SLICE"
  (
    cd "$DEPS/fribidi-$SLICE"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-debug
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/fribidi-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libharfbuzz.a" ]; then
  echo "  HarfBuzz"
  fetch "https://github.com/harfbuzz/harfbuzz/releases/download/10.1.0/harfbuzz-10.1.0.tar.xz" harfbuzz-10.1.0.tar.xz
  unpack harfbuzz-10.1.0.tar.xz "harfbuzz-$SLICE"
  (
    cd "$DEPS/harfbuzz-$SLICE"
    [ "$ARCH" = "arm64" ] && MESON_CPU_FAMILY=aarch64 || MESON_CPU_FAMILY=x86_64
    cat > cross-harfbuzz.txt <<EOF
[binaries]
pkg-config = '$(command -v pkg-config)'
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
cpp_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
c_link_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
cpp_link_args = ['-arch', '$ARCH', '-isysroot', '$SDK', '$MIN_FLAG']
pkg_config_path = '$PREFIX/lib/pkgconfig'
[host_machine]
system = 'darwin'
subsystem = '$MESON_SUBSYSTEM'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU_FAMILY'
endian = 'little'
EOF
    meson setup build --cross-file cross-harfbuzz.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release \
      -Dfreetype=enabled -Dglib=disabled -Dgobject=disabled -Dcairo=disabled \
      -Dicu=disabled -Dtests=disabled -Ddocs=disabled -Dbenchmark=disabled \
      -Dintrospection=disabled -Dutilities=disabled -Dcoretext=disabled
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/harfbuzz-$SLICE.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libass.a" ]; then
  echo "  libass"
  fetch "https://github.com/libass/libass/releases/download/0.17.4/libass-0.17.4.tar.xz" libass-0.17.4.tar.xz
  unpack libass-0.17.4.tar.xz "libass-$SLICE"
  (
    cd "$DEPS/libass-$SLICE"
    PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-fontconfig
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/libass-$SLICE.log" 2>&1
fi

echo "==> FFmpeg for $SLICE"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
rm -rf "$BUILD"; mkdir -p "$BUILD"; cd "$BUILD"

"$SOURCE/configure" \
  --prefix="$PREFIX" \
  --target-os=darwin \
  --arch="$FF_ARCH" \
  --cpu=generic \
  --enable-cross-compile \
  --sysroot="$SDK" \
  --cc="$CC" --cxx="$CXX" --ar="$AR" --ranlib="$RANLIB" --strip="$STRIP" \
  --extra-cflags="$CFLAGS -I$PREFIX/include" \
  --extra-ldflags="$LDFLAGS -L$PREFIX/lib" \
  --extra-libs="-lc++" \
  --pkg-config-flags=--static \
  --disable-autodetect \
  --enable-static --disable-shared --enable-pic \
  --enable-asm \
  --enable-videotoolbox --enable-audiotoolbox --enable-securetransport \
  --enable-zlib --enable-libmp3lame --enable-libopus --enable-libvpx \
  --enable-libdav1d --enable-libaom --disable-decoder=libaom_av1 \
  --enable-libopenh264 \
  --enable-libass --enable-libfreetype --enable-libfribidi --enable-libharfbuzz \
  --enable-pthreads --enable-swscale --enable-avfilter --enable-network \
  --enable-protocol=file,pipe,http,tcp,https,tls,crypto,data,concat,concatf \
  --disable-programs --disable-doc --disable-debug --disable-vulkan \
  --disable-avdevice \
  > "$WORKSPACE/build/ffmpeg-$SLICE-configure.log" 2>&1

make -j"$JOBS" > "$WORKSPACE/build/ffmpeg-$SLICE.log" 2>&1
make install >> "$WORKSPACE/build/ffmpeg-$SLICE.log" 2>&1

echo "==> fftools + core for $SLICE"
"$HERE/build-ios-fftools.sh" "$SDK_NAME" "$ARCH"

echo "Done: $PREFIX"
