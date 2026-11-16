#!/usr/bin/env bash
# Fails if an iOS static library needs a symbol that an app linking it can't
# provide.
#
#   ./check-ios-link.sh <libmunimffmpeg.a> <iphoneos|iphonesimulator> <arch>
#
# Every symbol the archive references but doesn't define itself has to come from
# the system frameworks and libraries the podspec links, or from the ones every
# iOS app links anyway (Foundation, CoreFoundation). A stub program is linked
# against exactly those, with `-u` forcing each of the archive's external
# symbols to resolve, so the linker reports anything nothing provides — the
# same "Undefined symbols" error an app build would hit. 0.10.0 shipped one: the
# FreeType HVF driver needed libhvf.
#
# This is stricter than linking the archive itself: it covers every object in
# it, not only the ones a particular app happens to pull in. Linking with
# -force_load instead would trip over duplicate definitions that a normal link
# never loads together.
set -euo pipefail

LIB="$1"
SDK_NAME="$2"
ARCH="$3"
MIN_IOS="${MIN_IOS:-15.1}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PODSPEC="$HERE/../../NitroMunimFfmpeg.podspec"

case "$SDK_NAME" in
  iphoneos)        MIN_FLAG="-mios-version-min=$MIN_IOS" ;;
  iphonesimulator) MIN_FLAG="-mios-simulator-version-min=$MIN_IOS" ;;
  *) echo "Unsupported SDK: $SDK_NAME" >&2; exit 1 ;;
esac

# `s.frameworks = "A", "B"` and `s.libraries = "x", "y"` in the podspec.
podspec_list() {
  { grep -E "^[[:space:]]*s\.$1[[:space:]]*=" "$PODSPEC" || true; } | { grep -oE '"[^"]+"' || true; } | tr -d '"'
}
FRAMEWORKS="Foundation CoreFoundation $(podspec_list frameworks | tr '\n' ' ')"
LIBRARIES="$(podspec_list libraries | tr '\n' ' ')"
if [ -z "$LIBRARIES" ] || [ "$FRAMEWORKS" = "Foundation CoreFoundation " ]; then
  echo "  could not read s.frameworks / s.libraries from $PODSPEC" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

NM="$(xcrun -f nm)"
"$NM" -arch "$ARCH" -g -U -j "$LIB" 2>/dev/null | awk 'NF && !/:$/' | sort -u > "$TMP/defined"
"$NM" -arch "$ARCH" -u "$LIB" 2>/dev/null | awk 'NF && !/:$/' | sort -u > "$TMP/undefined"
comm -23 "$TMP/undefined" "$TMP/defined" > "$TMP/external"
if [ ! -s "$TMP/defined" ]; then
  echo "  $LIB has no $ARCH symbols" >&2
  exit 1
fi

{
  while read -r symbol; do printf -- '-Wl,-u,%s\n' "$symbol"; done < "$TMP/external"
  for framework in $FRAMEWORKS; do printf -- '-framework\n%s\n' "$framework"; done
  for library in $LIBRARIES; do printf -- '-l%s\n' "$library"; done
} > "$TMP/link.rsp"
printf 'int main(void) { return 0; }\n' > "$TMP/main.c"

if ! xcrun --sdk "$SDK_NAME" clang -arch "$ARCH" "$MIN_FLAG" "$TMP/main.c" \
    -o "$TMP/a.out" @"$TMP/link.rsp" > "$TMP/link.log" 2>&1; then
  echo "  $SDK_NAME $ARCH: symbols no linked framework or library provides:" >&2
  grep -E '^[[:space:]]*"' "$TMP/link.log" | sed 's/, referenced from:$//' >&2 \
    || cat "$TMP/link.log" >&2
  exit 1
fi
echo "  $SDK_NAME $ARCH: all $(wc -l < "$TMP/external" | tr -d ' ') external symbols resolve"
