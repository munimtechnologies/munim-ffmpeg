/*
 * Conversions between standard UTF-8 and JNI's "modified UTF-8".
 *
 * JNI's NewStringUTF and GetStringUTFChars do not speak standard UTF-8:
 * characters outside the Basic Multilingual Plane (emoji, many CJK
 * extensions) travel as two 3-byte surrogates instead of one 4-byte sequence.
 *
 * - Handing FFmpeg's log text (standard UTF-8, or arbitrary bytes from file
 *   metadata) to NewStringUTF unconverted makes CheckJNI abort the app in
 *   debug builds and garbles the text in release builds.
 * - Handing GetStringUTFChars' output to FFmpeg unconverted turns a path such
 *   as "clip 🎬.mp4" into bytes that name a different, nonexistent file.
 *
 * Header-only so the conversions can be unit-tested on a host compiler
 * (scripts/ffmpeg/test/modified_utf8_test.c).
 */
#ifndef MUNIM_MODIFIED_UTF8_H
#define MUNIM_MODIFIED_UTF8_H

#include <stdlib.h>
#include <string.h>

static size_t munim_utf8_put3(char *out, unsigned int unit)
{
    out[0] = (char)(0xE0 | (unit >> 12));
    out[1] = (char)(0x80 | ((unit >> 6) & 0x3F));
    out[2] = (char)(0x80 | (unit & 0x3F));
    return 3;
}

static int munim_utf8_continuation(unsigned char byte)
{
    return (byte & 0xC0) == 0x80;
}

/*
 * Standard UTF-8 (possibly invalid) to modified UTF-8 that NewStringUTF
 * accepts. 4-byte sequences become surrogate pairs; bytes that are not valid
 * UTF-8 become U+FFFD. Returns a malloc'd string, or NULL if out of memory.
 */
static char *munim_utf8_to_modified(const char *input)
{
    const unsigned char *in = (const unsigned char *)input;
    size_t length = strlen(input);
    /* Worst case: every byte invalid, each becoming a 3-byte U+FFFD. */
    char *out = malloc(length * 3 + 1);
    if (!out) return NULL;

    size_t o = 0;
    for (size_t i = 0; i < length;) {
        unsigned char c = in[i];
        size_t remaining = length - i;

        if (c < 0x80) {
            out[o++] = (char)c;
            i += 1;
        } else if (c >= 0xC2 && c <= 0xDF && remaining >= 2 &&
                   munim_utf8_continuation(in[i + 1])) {
            memcpy(out + o, in + i, 2);
            o += 2;
            i += 2;
        } else if (c >= 0xE0 && c <= 0xEF && remaining >= 3 &&
                   munim_utf8_continuation(in[i + 1]) &&
                   munim_utf8_continuation(in[i + 2]) &&
                   !(c == 0xE0 && in[i + 1] < 0xA0) &&   /* overlong */
                   !(c == 0xED && in[i + 1] >= 0xA0)) {  /* lone surrogate */
            memcpy(out + o, in + i, 3);
            o += 3;
            i += 3;
        } else if (c >= 0xF0 && c <= 0xF4 && remaining >= 4 &&
                   munim_utf8_continuation(in[i + 1]) &&
                   munim_utf8_continuation(in[i + 2]) &&
                   munim_utf8_continuation(in[i + 3]) &&
                   !(c == 0xF0 && in[i + 1] < 0x90) &&   /* overlong */
                   !(c == 0xF4 && in[i + 1] >= 0x90)) {  /* above U+10FFFF */
            unsigned int code = ((unsigned int)(c & 0x07) << 18) |
                                ((unsigned int)(in[i + 1] & 0x3F) << 12) |
                                ((unsigned int)(in[i + 2] & 0x3F) << 6) |
                                (unsigned int)(in[i + 3] & 0x3F);
            code -= 0x10000;
            o += munim_utf8_put3(out + o, 0xD800 | (code >> 10));
            o += munim_utf8_put3(out + o, 0xDC00 | (code & 0x3FF));
            i += 4;
        } else {
            o += munim_utf8_put3(out + o, 0xFFFD);
            i += 1;
        }
    }
    out[o] = '\0';
    return out;
}

/*
 * Modified UTF-8 from GetStringUTFChars to standard UTF-8: surrogate pairs
 * are joined into 4-byte sequences. Everything else is already standard and is
 * copied as is. Returns a malloc'd string, or NULL if out of memory.
 */
static char *munim_utf8_from_modified(const char *input)
{
    const unsigned char *in = (const unsigned char *)input;
    size_t length = strlen(input);
    char *out = malloc(length + 1);
    if (!out) return NULL;

    size_t o = 0;
    for (size_t i = 0; i < length;) {
        if (length - i >= 6 &&
            in[i] == 0xED && in[i + 1] >= 0xA0 && in[i + 1] <= 0xAF &&
            munim_utf8_continuation(in[i + 2]) &&
            in[i + 3] == 0xED && in[i + 4] >= 0xB0 && in[i + 4] <= 0xBF &&
            munim_utf8_continuation(in[i + 5])) {
            unsigned int high = ((unsigned int)(in[i + 1] & 0x0F) << 6) |
                                (unsigned int)(in[i + 2] & 0x3F);
            unsigned int low = ((unsigned int)(in[i + 4] & 0x0F) << 6) |
                               (unsigned int)(in[i + 5] & 0x3F);
            unsigned int code = 0x10000 + ((high << 10) | low);
            out[o++] = (char)(0xF0 | (code >> 18));
            out[o++] = (char)(0x80 | ((code >> 12) & 0x3F));
            out[o++] = (char)(0x80 | ((code >> 6) & 0x3F));
            out[o++] = (char)(0x80 | (code & 0x3F));
            i += 6;
        } else {
            out[o++] = (char)in[i++];
        }
    }
    out[o] = '\0';
    return out;
}

#endif /* MUNIM_MODIFIED_UTF8_H */
