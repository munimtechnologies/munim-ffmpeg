#!/usr/bin/env bash
# Builds FFmpeg and the munim core for one Android ABI.
#
#   ./build-android.sh arm64-v8a
#   ./build-android.sh armeabi-v7a
#   ./build-android.sh x86_64
#
# Outputs land in $WORKSPACE/out/android-<abi> and are copied into
# android/src/main/jniLibs/<abi> by package.sh.
set -euo pipefail

ABI="${1:-arm64-v8a}"
NDK="${ANDROID_NDK:-/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006}"
API="${ANDROID_API:-24}"
HOST_TAG="$(ls "$NDK/toolchains/llvm/prebuilt" | head -1)"
TOOLCHAIN="$NDK/toolchains/llvm/prebuilt/$HOST_TAG"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
SOURCE="$WORKSPACE/ffmpeg-${FFMPEG_VERSION:-9.0.1}"
DEPS="$WORKSPACE/deps"
PREFIX="$WORKSPACE/out/android-$ABI"
BUILD="$WORKSPACE/build/android-$ABI"
JOBS="$(sysctl -n hw.ncpu 2>/dev/null || nproc)"

case "$ABI" in
  arm64-v8a)
    TRIPLE=aarch64-linux-android; HOST=aarch64-linux-android
    FF_ARCH=aarch64; FF_CPU=armv8-a; VPX_TARGET=arm64-android-gcc
    EXTRA_CFLAGS=""
    ;;
  armeabi-v7a)
    TRIPLE=armv7a-linux-androideabi; HOST=arm-linux-androideabi
    FF_ARCH=arm; FF_CPU=armv7-a
    # libvpx's armv7-android target passes -march=armv7-a, which NDK 27's clang
    # rejects for this triple. generic-gnu builds portable C with our flags.
    VPX_TARGET=generic-gnu
    EXTRA_CFLAGS="-mfpu=neon -mfloat-abi=softfp"
    ;;
  x86_64)
    TRIPLE=x86_64-linux-android; HOST=x86_64-linux-android
    FF_ARCH=x86_64; FF_CPU=x86-64; VPX_TARGET=x86_64-android-gcc
    EXTRA_CFLAGS=""
    ;;
  *)
    echo "Unsupported ABI: $ABI" >&2; exit 1 ;;
esac

export CC="$TOOLCHAIN/bin/$TRIPLE$API-clang"
export CXX="$TOOLCHAIN/bin/$TRIPLE$API-clang++"
export AR="$TOOLCHAIN/bin/llvm-ar"
export RANLIB="$TOOLCHAIN/bin/llvm-ranlib"
export STRIP="$TOOLCHAIN/bin/llvm-strip"
export NM="$TOOLCHAIN/bin/llvm-nm"
export CFLAGS="-O2 -fPIC -DANDROID $EXTRA_CFLAGS"
export CXXFLAGS="$CFLAGS"
export LDFLAGS="-Wl,-z,max-page-size=16384"

mkdir -p "$DEPS" "$PREFIX" "$WORKSPACE/build"
test -d "$SOURCE" || { echo "FFmpeg source missing: $SOURCE (run fetch-source.sh)" >&2; exit 1; }

fetch() { [ -f "$DEPS/$2" ] || curl -sL -o "$DEPS/$2" "$1"; }
unpack() { rm -rf "$DEPS/$2"; mkdir -p "$DEPS/$2"; tar xf "$DEPS/$1" -C "$DEPS/$2" --strip-components=1; }

echo "==> external libraries for $ABI"

if [ ! -f "$PREFIX/lib/libmp3lame.a" ]; then
  echo "  LAME"
  fetch "https://downloads.sourceforge.net/project/lame/lame/3.100/lame-3.100.tar.gz" lame-3.100.tar.gz
  unpack lame-3.100.tar.gz "lame-$ABI"
  (
    cd "$DEPS/lame-$ABI"
    sed -i '' '/lame_init_old/d' include/libmp3lame.sym
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-frontend --disable-analyzer-hooks
    # LAME predates C99 and relies on implicit declarations. The force-includes
    # only go in at compile time; in configure they break its probe programs.
    make -j"$JOBS" CFLAGS="$CFLAGS -include string.h -include stdlib.h -Wno-implicit-function-declaration"
    make install
  ) > "$WORKSPACE/build/lame-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libopus.a" ]; then
  echo "  Opus"
  fetch "https://downloads.xiph.org/releases/opus/opus-1.5.2.tar.gz" opus-1.5.2.tar.gz
  unpack opus-1.5.2.tar.gz "opus-$ABI"
  (
    cd "$DEPS/opus-$ABI"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-doc --disable-extra-programs
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/opus-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libvpx.a" ]; then
  echo "  libvpx"
  fetch "https://github.com/webmproject/libvpx/archive/refs/tags/v1.15.0.tar.gz" libvpx-1.15.0.tar.gz
  unpack libvpx-1.15.0.tar.gz "libvpx-$ABI"
  (
    cd "$DEPS/libvpx-$ABI"
    # Runtime CPU detection stays on: disabling it bakes in instructions many
    # devices lack, and the VP9 encoder then dies with SIGILL.
    PATH="$TOOLCHAIN/bin:$PATH" ./configure --target="$VPX_TARGET" --prefix="$PREFIX" \
      --disable-shared --enable-static --enable-pic \
      --disable-examples --disable-tools --disable-docs --disable-unit-tests \
      --enable-vp8 --enable-vp9 --enable-vp9-highbitdepth
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/libvpx-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libdav1d.a" ]; then
  echo "  dav1d"
  fetch "https://code.videolan.org/videolan/dav1d/-/archive/1.5.1/dav1d-1.5.1.tar.gz" dav1d-1.5.1.tar.gz
  unpack dav1d-1.5.1.tar.gz "dav1d-$ABI"
  (
    cd "$DEPS/dav1d-$ABI"
    case "$ABI" in
      arm64-v8a)   MESON_CPU_FAMILY=aarch64; MESON_CPU=aarch64 ;;
      armeabi-v7a) MESON_CPU_FAMILY=arm;     MESON_CPU=armv7 ;;
      x86_64)      MESON_CPU_FAMILY=x86_64;  MESON_CPU=x86_64 ;;
    esac
    cat > cross.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
[host_machine]
system = 'android'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU'
endian = 'little'
EOF
    meson setup build --cross-file cross.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release \
      -Denable_tools=false -Denable_tests=false
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/dav1d-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libopenh264.a" ]; then
  echo "  openh264"
  fetch "https://github.com/cisco/openh264/archive/refs/tags/v2.6.0.tar.gz" openh264-2.6.0.tar.gz
  unpack openh264-2.6.0.tar.gz "openh264-$ABI"
  (
    cd "$DEPS/openh264-$ABI"
    case "$ABI" in
      arm64-v8a)   MESON_CPU_FAMILY=aarch64; MESON_CPU=aarch64 ;;
      armeabi-v7a) MESON_CPU_FAMILY=arm;     MESON_CPU=armv7 ;;
      x86_64)      MESON_CPU_FAMILY=x86_64;  MESON_CPU=x86_64 ;;
    esac
    cat > cross-openh264.txt <<EOF
[binaries]
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
cpp_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
[host_machine]
system = 'android'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU'
endian = 'little'
EOF
    meson setup build --cross-file cross-openh264.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release -Dtests=disabled
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/openh264-$ABI.log" 2>&1
fi

# FreeType's freetype2.pc declares `Requires.private: zlib`, and the NDK ships
# zlib in the sysroot without a .pc file, so pkg-config would otherwise refuse
# every package that depends on FreeType.
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
# rasterise text, libass renders ASS/SSA, and fontconfig + expat let libass
# discover the system fonts under /system/fonts.
if [ ! -f "$PREFIX/lib/libfreetype.a" ]; then
  echo "  FreeType"
  fetch "https://download.savannah.gnu.org/releases/freetype/freetype-2.13.3.tar.xz" freetype-2.13.3.tar.xz
  unpack freetype-2.13.3.tar.xz "freetype-$ABI"
  (
    cd "$DEPS/freetype-$ABI"
    PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --with-zlib=yes --without-png --without-harfbuzz --without-brotli --without-bzip2
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/freetype-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libfribidi.a" ]; then
  echo "  FriBidi"
  fetch "https://github.com/fribidi/fribidi/releases/download/v1.0.16/fribidi-1.0.16.tar.xz" fribidi-1.0.16.tar.xz
  unpack fribidi-1.0.16.tar.xz "fribidi-$ABI"
  (
    cd "$DEPS/fribidi-$ABI"
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --disable-debug
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/fribidi-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libharfbuzz.a" ]; then
  echo "  HarfBuzz"
  fetch "https://github.com/harfbuzz/harfbuzz/releases/download/10.1.0/harfbuzz-10.1.0.tar.xz" harfbuzz-10.1.0.tar.xz
  unpack harfbuzz-10.1.0.tar.xz "harfbuzz-$ABI"
  (
    cd "$DEPS/harfbuzz-$ABI"
    case "$ABI" in
      arm64-v8a)   MESON_CPU_FAMILY=aarch64; MESON_CPU=aarch64 ;;
      armeabi-v7a) MESON_CPU_FAMILY=arm;     MESON_CPU=armv7 ;;
      x86_64)      MESON_CPU_FAMILY=x86_64;  MESON_CPU=x86_64 ;;
    esac
    cat > cross-harfbuzz.txt <<EOF
[binaries]
pkg-config = '$(command -v pkg-config)'
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
cpp_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
pkg_config_path = '$PREFIX/lib/pkgconfig'
[host_machine]
system = 'android'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU'
endian = 'little'
EOF
    meson setup build --cross-file cross-harfbuzz.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release \
      -Dfreetype=enabled -Dglib=disabled -Dgobject=disabled -Dcairo=disabled \
      -Dicu=disabled -Dtests=disabled -Ddocs=disabled -Dbenchmark=disabled \
      -Dintrospection=disabled -Dutilities=disabled
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/harfbuzz-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libexpat.a" ]; then
  echo "  expat"
  fetch "https://github.com/libexpat/libexpat/releases/download/R_2_7_1/expat-2.7.1.tar.xz" expat-2.7.1.tar.xz
  unpack expat-2.7.1.tar.xz "expat-$ABI"
  (
    cd "$DEPS/expat-$ABI"
    cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
      -DANDROID_ABI="$ABI" -DANDROID_PLATFORM="android-$API" \
      -DCMAKE_INSTALL_PREFIX="$PREFIX" -DCMAKE_BUILD_TYPE=Release \
      -DEXPAT_SHARED_LIBS=OFF -DEXPAT_BUILD_TOOLS=OFF -DEXPAT_BUILD_EXAMPLES=OFF \
      -DEXPAT_BUILD_TESTS=OFF -DEXPAT_BUILD_DOCS=OFF
    cmake --build build -j"$JOBS" && cmake --install build
  ) > "$WORKSPACE/build/expat-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libfontconfig.a" ]; then
  echo "  fontconfig"
  fetch "https://www.freedesktop.org/software/fontconfig/release/fontconfig-2.16.0.tar.xz" fontconfig-2.16.0.tar.xz
  unpack fontconfig-2.16.0.tar.xz "fontconfig-$ABI"
  (
    cd "$DEPS/fontconfig-$ABI"
    case "$ABI" in
      arm64-v8a)   MESON_CPU_FAMILY=aarch64; MESON_CPU=aarch64 ;;
      armeabi-v7a) MESON_CPU_FAMILY=arm;     MESON_CPU=armv7 ;;
      x86_64)      MESON_CPU_FAMILY=x86_64;  MESON_CPU=x86_64 ;;
    esac
    cat > cross-fontconfig.txt <<EOF
[binaries]
pkg-config = '$(command -v pkg-config)'
c = '$CC'
cpp = '$CXX'
ar = '$AR'
strip = '$STRIP'
[built-in options]
c_args = [$(printf "'%s', " $CFLAGS | sed 's/, $//')]
pkg_config_path = '$PREFIX/lib/pkgconfig'
[host_machine]
system = 'android'
cpu_family = '$MESON_CPU_FAMILY'
cpu = '$MESON_CPU'
endian = 'little'
EOF
    # The Kotlin layer writes the real fonts.conf at runtime and points
    # FONTCONFIG_FILE at it; the baked-in default is only a fallback.
    meson setup build --cross-file cross-fontconfig.txt --prefix="$PREFIX" \
      --default-library=static --buildtype=release \
      -Ddoc=disabled -Dnls=disabled -Dtests=disabled -Dtools=disabled \
      -Dcache-build=disabled -Diconv=disabled \
      -Ddefault-fonts-dirs=/system/fonts
    ninja -C build && ninja -C build install
  ) > "$WORKSPACE/build/fontconfig-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libass.a" ]; then
  echo "  libass"
  fetch "https://github.com/libass/libass/releases/download/0.17.4/libass-0.17.4.tar.xz" libass-0.17.4.tar.xz
  unpack libass-0.17.4.tar.xz "libass-$ABI"
  (
    cd "$DEPS/libass-$ABI"
    PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --host="$HOST" --prefix="$PREFIX" --disable-shared --enable-static \
      --enable-fontconfig
    make -j"$JOBS" && make install
  ) > "$WORKSPACE/build/libass-$ABI.log" 2>&1
fi

if [ ! -f "$PREFIX/lib/libmbedtls.a" ]; then
  echo "  mbedTLS"
  fetch "https://github.com/Mbed-TLS/mbedtls/releases/download/mbedtls-3.6.2/mbedtls-3.6.2.tar.bz2" mbedtls-3.6.2.tar.bz2
  unpack mbedtls-3.6.2.tar.bz2 "mbedtls-$ABI"
  (
    cd "$DEPS/mbedtls-$ABI"
    cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
      -DANDROID_ABI="$ABI" -DANDROID_PLATFORM="android-$API" \
      -DCMAKE_INSTALL_PREFIX="$PREFIX" -DUSE_SHARED_MBEDTLS_LIBRARY=OFF \
      -DENABLE_TESTING=OFF -DENABLE_PROGRAMS=OFF -DCMAKE_BUILD_TYPE=Release
    cmake --build build -j"$JOBS" && cmake --install build
  ) > "$WORKSPACE/build/mbedtls-$ABI.log" 2>&1
fi

echo "==> FFmpeg for $ABI"
# configure probes the external libraries through pkg-config.
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
rm -rf "$BUILD"; mkdir -p "$BUILD"; cd "$BUILD"

"$SOURCE/configure" \
  --prefix="$PREFIX" \
  --target-os=android \
  --arch="$FF_ARCH" \
  --cpu="$FF_CPU" \
  --enable-cross-compile \
  --sysroot="$TOOLCHAIN/sysroot" \
  --cc="$CC" --cxx="$CXX" --ar="$AR" --nm="$NM" --ranlib="$RANLIB" --strip="$STRIP" \
  --extra-cflags="$CFLAGS -I$PREFIX/include" \
  --extra-ldflags="$LDFLAGS -L$PREFIX/lib" \
  --extra-libs="-lc++_shared" \
  --pkg-config-flags=--static \
  --disable-autodetect \
  --enable-shared --disable-static --enable-pic \
  --enable-asm --enable-inline-asm \
  --enable-jni --enable-mediacodec \
  --enable-zlib --enable-libmp3lame --enable-libopus --enable-libvpx \
  --enable-libdav1d --enable-libopenh264 --enable-mbedtls --enable-version3 \
  --enable-libass --enable-libfreetype --enable-libfribidi --enable-libharfbuzz \
  --enable-libfontconfig \
  --enable-pthreads --enable-swscale --enable-avfilter --enable-network \
  --enable-protocol=file,pipe,http,tcp,https,tls,crypto,data,concat,concatf \
  --disable-programs --disable-doc --disable-debug --disable-vulkan \
  --disable-v4l2-m2m --disable-indev=android_camera \
  > "$WORKSPACE/build/ffmpeg-$ABI-configure.log" 2>&1

make -j"$JOBS" > "$WORKSPACE/build/ffmpeg-$ABI.log" 2>&1
make install >> "$WORKSPACE/build/ffmpeg-$ABI.log" 2>&1

echo "==> fftools + core for $ABI"
PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" \
  "$HERE/build-android-fftools.sh" "$ABI"

echo "Done: $PREFIX"
