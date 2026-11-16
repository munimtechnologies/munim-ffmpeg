import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getDisplaySize,
  getFrameRate,
  getMediaDuration,
  getRotation,
  getVideoStream,
  normalizePath,
} from '../src/media.ts'

describe('normalizePath', () => {
  it('decodes file:// URIs', () => {
    assert.equal(
      normalizePath('file:///data/user/0/app/cache/my%20clip%20%C3%A9.mp4'),
      '/data/user/0/app/cache/my clip é.mp4'
    )
  })

  it('leaves other schemes and plain paths alone', () => {
    for (const value of [
      'content://media/external/video/media/42',
      'https://example.com/a%20b.mp4',
      '/plain/path with spaces.mp4',
      'pipe:1',
    ]) {
      assert.equal(normalizePath(value), value)
    }
  })

  it('keeps a malformed escape as written', () => {
    assert.equal(normalizePath('file:///tmp/100%.mp4'), '/tmp/100%.mp4')
  })
})

describe('stream helpers', () => {
  const portrait = {
    index: 0,
    codec_type: 'video',
    width: 1920,
    height: 1080,
    avg_frame_rate: '30000/1001',
    side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }],
  }

  it('reads rotation from the display matrix or the legacy tag', () => {
    assert.equal(getRotation(portrait), 90)
    assert.equal(getRotation({ index: 0, tags: { rotate: '270' } }), 270)
    assert.equal(getRotation({ index: 0 }), 0)
    assert.equal(
      getRotation({ index: 0, side_data_list: [{ rotation: 180 }] }),
      180
    )
  })

  it('swaps width and height for rotated video', () => {
    assert.deepEqual(getDisplaySize(portrait), { width: 1080, height: 1920 })
    assert.deepEqual(getDisplaySize({ index: 0, width: 640, height: 480 }), {
      width: 640,
      height: 480,
    })
    assert.equal(getDisplaySize({ index: 0 }), undefined)
  })

  it('parses fractional frame rates', () => {
    assert.ok(Math.abs(getFrameRate(portrait)! - 29.97) < 0.01)
    assert.equal(
      getFrameRate({ index: 0, avg_frame_rate: '0/0', r_frame_rate: '25/1' }),
      25
    )
    assert.equal(getFrameRate({ index: 0 }), undefined)
  })

  it('skips cover art when finding the video stream', () => {
    const information = {
      streams: [
        { index: 0, codec_type: 'audio' },
        { index: 1, codec_type: 'video', disposition: { attached_pic: 1 } },
        { index: 2, codec_type: 'video' },
      ],
    }
    assert.equal(getVideoStream(information)?.index, 2)
    assert.equal(getVideoStream({ streams: [] }), undefined)
  })

  it('reads the duration from the format, then the streams', () => {
    assert.equal(getMediaDuration({ format: { duration: '12.5' } }), 12.5)
    assert.equal(
      getMediaDuration({ streams: [{ index: 0, duration: '3.0' }] }),
      3
    )
    assert.equal(getMediaDuration({ format: { duration: 'N/A' } }), undefined)
  })
})
