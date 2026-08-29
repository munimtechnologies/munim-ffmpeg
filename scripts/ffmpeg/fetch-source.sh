#!/usr/bin/env bash
# Downloads the FFmpeg release the package builds against.
set -euo pipefail
VERSION="${FFMPEG_VERSION:-9.0.1}"
WORKSPACE="${FFMPEG_WORKSPACE:-$HOME/.munim-ffmpeg-build}"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"
[ -f "ffmpeg-$VERSION.tar.xz" ] || curl -sL -O "https://ffmpeg.org/releases/ffmpeg-$VERSION.tar.xz"
[ -d "ffmpeg-$VERSION" ] || tar xf "ffmpeg-$VERSION.tar.xz"
echo "FFmpeg $VERSION source at $WORKSPACE/ffmpeg-$VERSION"
