/*
 * Host-side test for scripts/ffmpeg/src/modified_utf8.h, run by CI:
 *
 *   cc -std=c11 -Wall -Wextra -Werror -I scripts/ffmpeg/src \
 *     scripts/ffmpeg/test/modified_utf8_test.c -o /tmp/utf8 && /tmp/utf8
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "modified_utf8.h"

static int failures;

static void expect(const char *name, char *actual, const char *expected)
{
    if (!actual || strcmp(actual, expected) != 0) {
        fprintf(stderr, "FAIL %s\n  expected:", name);
        for (const unsigned char *p = (const unsigned char *)expected; *p; p++)
            fprintf(stderr, " %02X", *p);
        fprintf(stderr, "\n  actual:  ");
        for (const unsigned char *p = (const unsigned char *)actual; p && *p; p++)
            fprintf(stderr, " %02X", *p);
        fprintf(stderr, "\n");
        failures++;
    } else {
        printf("ok   %s\n", name);
    }
    free(actual);
}

int main(void)
{
    /* U+1F3AC CLAPPER BOARD: F0 9F 8E AC <-> ED A0 BC ED BE AC */
    const char *emoji = "clip \xF0\x9F\x8E\xAC.mp4";
    const char *emoji_modified = "clip \xED\xA0\xBC\xED\xBE\xAC.mp4";

    expect("ascii is unchanged", munim_utf8_to_modified("frame=  12 fps=30"),
           "frame=  12 fps=30");
    expect("2- and 3-byte sequences are unchanged",
           munim_utf8_to_modified("caf\xC3\xA9 \xE6\xBC\xA2\xE5\xAD\x97"),
           "caf\xC3\xA9 \xE6\xBC\xA2\xE5\xAD\x97");
    expect("4-byte sequence becomes a surrogate pair",
           munim_utf8_to_modified(emoji), emoji_modified);
    expect("U+10FFFF becomes the last surrogate pair",
           munim_utf8_to_modified("\xF4\x8F\xBF\xBF"),
           "\xED\xAF\xBF\xED\xBF\xBF");
    expect("latin-1 byte becomes U+FFFD",
           munim_utf8_to_modified("Bj\xF6rk"), "Bj\xEF\xBF\xBDrk");
    expect("truncated sequence becomes U+FFFD",
           munim_utf8_to_modified("a\xE6\xBC"), "a\xEF\xBF\xBD\xEF\xBF\xBD");
    expect("overlong encoding becomes U+FFFD",
           munim_utf8_to_modified("\xC0\xAF"), "\xEF\xBF\xBD\xEF\xBF\xBD");
    expect("encoded lone surrogate becomes U+FFFD",
           munim_utf8_to_modified("\xED\xA0\x80"),
           "\xEF\xBF\xBD\xEF\xBF\xBD\xEF\xBF\xBD");

    expect("surrogate pair becomes a 4-byte sequence",
           munim_utf8_from_modified(emoji_modified), emoji);
    expect("last surrogate pair becomes U+10FFFF",
           munim_utf8_from_modified("\xED\xAF\xBF\xED\xBF\xBF"),
           "\xF4\x8F\xBF\xBF");
    expect("BMP text is unchanged",
           munim_utf8_from_modified("/data/clip with spaces \xC3\xA9 \xE6\xBC\xA2.mp4"),
           "/data/clip with spaces \xC3\xA9 \xE6\xBC\xA2.mp4");

    char *round_trip = munim_utf8_to_modified(emoji);
    expect("round trip", munim_utf8_from_modified(round_trip), emoji);
    free(round_trip);

    if (failures) {
        fprintf(stderr, "%d failure(s)\n", failures);
        return 1;
    }
    printf("all passed\n");
    return 0;
}
