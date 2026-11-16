import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  compressArguments,
  defaultVideoBitrateKbits,
  encoderArguments,
  fitWithin,
  isHardwareEncoder,
  jpegQualityScale,
  progressFraction,
  thumbnailArguments,
} from '../src/recipes.ts'

describe('fitWithin', () => {
  it('scales down to fit the box, keeping the aspect ratio', () => {
    assert.deepEqual(fitWithin(3840, 2160, 1280, 1280), {
      width: 1280,
      height: 720,
    })
    assert.deepEqual(fitWithin(1080, 1920, 1280, 1280), {
      width: 720,
      height: 1280,
    })
  })

  it('never upscales', () => {
    assert.deepEqual(fitWithin(640, 480, 1920, 1080), {
      width: 640,
      height: 480,
    })
  })

  it('rounds down to even sizes, staying inside the box', () => {
    assert.deepEqual(fitWithin(641, 361), { width: 640, height: 360 })
    assert.deepEqual(fitWithin(1920, 1080, 853), { width: 852, height: 478 })
  })
})

describe('encoders', () => {
  it('recognises hardware encoders', () => {
    assert.ok(isHardwareEncoder('h264_videotoolbox'))
    assert.ok(isHardwareEncoder('hevc_mediacodec'))
    assert.ok(!isHardwareEncoder('libopenh264'))
  })

  it('feeds MediaCodec NV12 and tags HEVC for Apple players', () => {
    assert.deepEqual(encoderArguments('h264_mediacodec', 'h264'), [
      '-c:v',
      'h264_mediacodec',
      '-pix_fmt',
      'nv12',
    ])
    assert.deepEqual(encoderArguments('hevc_videotoolbox', 'hevc'), [
      '-c:v',
      'hevc_videotoolbox',
      '-pix_fmt',
      'yuv420p',
      '-tag:v',
      'hvc1',
    ])
  })

  it('picks a bitrate from the picture size', () => {
    assert.equal(defaultVideoBitrateKbits(1280, 720, 30, 'h264'), 1935)
    assert.ok(
      defaultVideoBitrateKbits(1280, 720, 30, 'hevc') <
        defaultVideoBitrateKbits(1280, 720, 30, 'h264')
    )
    assert.equal(defaultVideoBitrateKbits(16, 16, 30, 'h264'), 300)
    assert.equal(defaultVideoBitrateKbits(7680, 4320, 120, 'h264'), 40000)
    assert.equal(
      defaultVideoBitrateKbits(1280, 720, Number.NaN, 'h264'),
      defaultVideoBitrateKbits(1280, 720, 30, 'h264')
    )
  })
})

describe('compressArguments', () => {
  const base = {
    input: '/in.mov',
    output: '/out.mp4',
    encoder: 'h264_videotoolbox',
    codec: 'h264' as const,
    videoBitrateKbits: 2000,
    audio: 'aac' as const,
    audioBitrateKbits: 128,
    hardwareDecoding: true,
    faststart: true,
  }

  it('builds a hardware command', () => {
    assert.deepEqual(
      compressArguments({ ...base, size: { width: 1280, height: 720 } }),
      [
        '-y',
        '-hide_banner',
        '-hwaccel',
        'videotoolbox',
        '-i',
        '/in.mov',
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-vf',
        'scale=1280:720',
        '-c:v',
        'h264_videotoolbox',
        '-pix_fmt',
        'yuv420p',
        '-b:v',
        '2000k',
        '-movflags',
        '+faststart',
        '/out.mp4',
      ]
    )
  })

  it('drops or copies audio and skips optional parts', () => {
    const silent = compressArguments({
      ...base,
      encoder: 'libopenh264',
      audio: 'none',
      hardwareDecoding: false,
      faststart: false,
      frameRate: 24,
    })
    assert.ok(silent.includes('-an'))
    assert.ok(!silent.includes('-hwaccel'))
    assert.ok(!silent.includes('-vf'))
    assert.ok(!silent.includes('-movflags'))
    assert.deepEqual(silent.slice(-3), ['-r', '24', '/out.mp4'])

    const copied = compressArguments({ ...base, audio: 'copy' })
    assert.deepEqual(copied.slice(8, 12), ['-map', '0:a:0?', '-c:a', 'copy'])
  })
})

describe('thumbnails', () => {
  it('seeks before the input and writes one frame', () => {
    assert.deepEqual(
      thumbnailArguments({
        input: '/in.mp4',
        output: '/thumb.jpg',
        timeSeconds: 1.5,
        size: { width: 320, height: 180 },
        jpegQuality: 4,
      }),
      [
        '-y',
        '-hide_banner',
        '-ss',
        '1.500',
        '-i',
        '/in.mp4',
        '-map',
        '0:v:0',
        '-frames:v',
        '1',
        '-vf',
        'scale=320:180',
        '-q:v',
        '4',
        '-update',
        '1',
        '/thumb.jpg',
      ]
    )
  })

  it('omits JPEG quality for PNG', () => {
    const png = thumbnailArguments({
      input: '/in.mp4',
      output: '/thumb.png',
      timeSeconds: 0,
      jpegQuality: 4,
    })
    assert.ok(!png.includes('-q:v'))
  })

  it('maps quality onto the JPEG scale', () => {
    assert.equal(jpegQualityScale(1), 2)
    assert.equal(jpegQualityScale(0), 31)
    assert.equal(jpegQualityScale(5), 2)
  })
})

describe('progressFraction', () => {
  it('is the share of the duration written so far', () => {
    assert.equal(progressFraction(5000, 10), 0.5)
    assert.equal(progressFraction(12000, 10), 1)
    assert.equal(progressFraction(5000, undefined), undefined)
    assert.equal(progressFraction(5000, 0), undefined)
  })
})
