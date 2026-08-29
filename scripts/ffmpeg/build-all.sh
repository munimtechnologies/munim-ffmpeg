#!/usr/bin/env bash
# Builds every architecture the package ships.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$HERE/fetch-source.sh"

for abi in arm64-v8a armeabi-v7a x86_64; do
  "$HERE/build-android.sh" "$abi"
done

"$HERE/build-ios.sh" iphoneos arm64
"$HERE/build-ios.sh" iphonesimulator arm64
"$HERE/build-ios.sh" iphonesimulator x86_64

"$HERE/package.sh"
