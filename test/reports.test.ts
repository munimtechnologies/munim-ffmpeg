import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseCodecs,
  parseFilters,
  parseFormats,
  parseProtocols,
} from '../src/reports.ts'

// Trimmed from FFmpeg 9's own output.
const ENCODERS = `Encoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 .F.... = Frame-level multithreading
 ..S... = Slice-level multithreading
 ...X.. = Codec is experimental
 ....B. = Supports draw_horiz_band
 .....D = Supports direct rendering method 1
 ------
 V....D libopenh264          OpenH264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
 S..... srt                  SubRip subtitle
`

const MUXERS = `Formats:
 D. = Demuxing supported
 .E = Muxing supported
 ---
  E 3g2             3GP2 (3GPP2 file format)
 D  aac             raw ADTS AAC (Advanced Audio Coding)
 DE matroska,webm   Matroska / WebM
  E mp4             MP4 (MPEG-4 Part 14)
`

const FILTERS = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  A = Audio input/output
  V = Video input/output
  | = Source or sink filter
 ... abuffer           |->A       Buffer audio frames, and make them accessible to the filterchain.
 TS. scale             V->V       Scale the input video size and/or convert the image format.
 T.C subtitles         V->V       Render text subtitles onto input video using the libass library.
`

const PROTOCOLS = `Supported file protocols:
Input:
  android_content
  fd
  file
  https
Output:
  fd
  file
  tee
`

describe('report parsers', () => {
  it('reads encoder names below the legend', () => {
    assert.deepEqual(parseCodecs(ENCODERS), [
      'libopenh264',
      'h264_videotoolbox',
      'aac',
      'srt',
    ])
  })

  it('reads muxer names and splits aliases', () => {
    assert.deepEqual(parseFormats(MUXERS), [
      '3g2',
      'aac',
      'matroska',
      'webm',
      'mp4',
    ])
  })

  it('reads filter names whatever the flag width', () => {
    assert.deepEqual(parseFilters(FILTERS), ['abuffer', 'scale', 'subtitles'])
  })

  it('reads each protocol once', () => {
    assert.deepEqual(parseProtocols(PROTOCOLS), [
      'android_content',
      'fd',
      'file',
      'https',
      'tee',
    ])
  })

  it('returns nothing for unrelated output', () => {
    assert.deepEqual(parseCodecs('Unrecognized option'), [])
    assert.deepEqual(parseProtocols(''), [])
  })
})
