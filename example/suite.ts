import { Directory, File, Paths } from 'expo-file-system'
import {
  cancel,
  execute,
  getFFmpegVersion,
  getMediaInformation,
  listDecoders,
  listEncoders,
  pickEncoder,
  probe,
} from 'munim-ffmpeg'

import { SMOKE_WAV_BASE64, decodeBase64 } from './fixture'

export type CheckResult = {
  name: string
  passed: boolean
  detail: string
  durationMs: number
}

export type SuiteResult = {
  passed: boolean
  ffmpegVersion: string
  encoders: string[]
  checks: CheckResult[]
}

type MediaInformation = {
  streams?: {
    codec_name?: string
    codec_type?: string
    width?: number
    height?: number
    sample_rate?: string
    channels?: number
  }[]
  format?: { format_name?: string; duration?: string }
}

function workspace() {
  const directory = new Directory(Paths.cache, 'munim-ffmpeg-suite')
  if (directory.exists) directory.delete()
  directory.create({ intermediates: true })
  return directory
}

// libx264 ships in the Android GPL build; iOS falls back to the VideoToolbox
// hardware encoder, which does not understand x264's -preset.
const H264_ENCODERS = ['libx264', 'h264_videotoolbox']

// The Android build is compiled with `--disable-indev=lavfi`, so the usual
// `testsrc` generator is unavailable. Raw RGB frames written from JavaScript
// give both platforms the same input without bundling a media asset.
const RAW_WIDTH = 160
const RAW_HEIGHT = 120
const RAW_FRAMES = 10
const RAW_FPS = 15

function rawVideoFrames() {
  const frameSize = RAW_WIDTH * RAW_HEIGHT * 3
  const bytes = new Uint8Array(frameSize * RAW_FRAMES)

  for (let frame = 0; frame < RAW_FRAMES; frame += 1) {
    for (let y = 0; y < RAW_HEIGHT; y += 1) {
      for (let x = 0; x < RAW_WIDTH; x += 1) {
        const offset = frame * frameSize + (y * RAW_WIDTH + x) * 3
        bytes[offset] = (x * 2 + frame * 12) & 0xff
        bytes[offset + 1] = (y * 2) & 0xff
        bytes[offset + 2] = (x + y) & 0xff
      }
    }
  }

  return bytes
}

function rawVideoInput(uri: string) {
  return [
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgb24',
    '-video_size',
    `${RAW_WIDTH}x${RAW_HEIGHT}`,
    '-framerate',
    String(RAW_FPS),
    '-i',
    uri,
  ]
}

function videoEncoderArguments(encoder: string) {
  return encoder === 'libx264'
    ? ['-c:v', encoder, '-preset', 'ultrafast']
    : ['-c:v', encoder]
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function run(
  name: string,
  body: () => Promise<string>
): Promise<CheckResult> {
  const startedAt = Date.now()
  try {
    const detail = await body()
    return { name, passed: true, detail, durationMs: Date.now() - startedAt }
  } catch (error) {
    return {
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }
  }
}

/**
 * Runs FFmpeg work that has to happen on a real device: encoders the bundled
 * FFmpeg build is expected to provide, the filter graph, both callback streams,
 * FFprobe, and session cancellation.
 */
export async function runSuite(
  onProgress?: (check: CheckResult) => void
): Promise<SuiteResult> {
  const directory = workspace()
  const checks: CheckResult[] = []

  const record = (check: CheckResult) => {
    checks.push(check)
    onProgress?.(check)
    return check
  }

  const source = new File(directory, 'source.wav')
  source.create({ overwrite: true })
  source.write(decodeBase64(SMOKE_WAV_BASE64))

  const raw = new File(directory, 'source.rgb')
  raw.create({ overwrite: true })
  raw.write(rawVideoFrames())

  const video = new File(directory, 'video-h264.mp4')
  const scaled = new File(directory, 'scaled.mp4')
  const mp3 = new File(directory, 'audio.mp3')
  const aac = new File(directory, 'audio.m4a')

  record(
    await run('Reports an FFmpeg version', async () => {
      const version = getFFmpegVersion()
      assert(version.length > 0, 'ffmpegVersion was empty')
      return version
    })
  )

  record(
    await run('Lists the encoders the build provides', async () => {
      const encoders = await listEncoders()
      assert(encoders.length > 10, `only ${encoders.length} encoders reported`)
      assert(encoders.includes('aac'), 'aac encoder missing')
      assert(encoders.includes('libmp3lame'), 'libmp3lame encoder missing')
      const decoders = await listDecoders()
      assert(decoders.includes('h264'), 'h264 decoder missing')
      return `${encoders.length} encoders, including ${encoders
        .filter((name) => H264_ENCODERS.includes(name))
        .join(', ')}`
    })
  )

  const h264 = await pickEncoder(H264_ENCODERS)

  record(
    await run(
      `Encodes H.264 with ${h264 ?? 'no available encoder'}`,
      async () => {
        assert(h264, `none of ${H264_ENCODERS.join(', ')} are available`)
        const logs: string[] = []
        const sessions: number[] = []
        let statistics = 0

        const result = await execute(
          [
            '-y',
            '-hide_banner',
            ...rawVideoInput(raw.uri),
            ...videoEncoderArguments(h264),
            '-pix_fmt',
            'yuv420p',
            video.uri,
          ],
          (message) => logs.push(message),
          () => {
            statistics += 1
          },
          (sessionId) => sessions.push(sessionId)
        )

        assert(result.success, result.failStackTrace ?? result.output)
        assert(logs.length > 0, 'no log callbacks fired')
        assert(statistics > 0, 'no statistics callbacks fired')
        assert(
          sessions.some((id) => id > 0),
          'onSessionCreated never fired'
        )
        assert(video.exists && (video.size ?? 0) > 0, 'no output file written')
        return `${video.size} bytes, ${logs.length} logs, ${statistics} statistics events`
      }
    )
  )

  record(
    await run('Probes the encoded video', async () => {
      const information = (await getMediaInformation(
        video.uri
      )) as MediaInformation
      const stream = information.streams?.find(
        (candidate) => candidate.codec_type === 'video'
      )
      assert(stream, 'no video stream reported')
      assert(
        stream.codec_name === 'h264',
        `expected h264, got ${stream.codec_name}`
      )
      assert(
        stream.width === RAW_WIDTH && stream.height === RAW_HEIGHT,
        `expected ${RAW_WIDTH}x${RAW_HEIGHT}, got ${stream.width}x${stream.height}`
      )
      return `h264 ${stream.width}x${stream.height}, ${information.format?.duration}s`
    })
  )

  record(
    await run('Applies a scale filter', async () => {
      assert(h264, 'no H.264 encoder available')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        video.uri,
        '-vf',
        'scale=80:60',
        ...videoEncoderArguments(h264),
        scaled.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = (await getMediaInformation(
        scaled.uri
      )) as MediaInformation
      const stream = information.streams?.find(
        (candidate) => candidate.codec_type === 'video'
      )
      assert(
        stream?.width === 80 && stream?.height === 60,
        `expected 80x60, got ${stream?.width}x${stream?.height}`
      )
      return `scaled to ${stream?.width}x${stream?.height}`
    })
  )

  record(
    await run('Encodes MP3 with libmp3lame', async () => {
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        source.uri,
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        mp3.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = (await getMediaInformation(
        mp3.uri
      )) as MediaInformation
      const stream = information.streams?.[0]
      assert(
        stream?.codec_name === 'mp3',
        `expected mp3, got ${stream?.codec_name}`
      )
      return `${mp3.size} bytes, ${stream?.sample_rate} Hz`
    })
  )

  record(
    await run('Encodes AAC', async () => {
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        source.uri,
        '-c:a',
        'aac',
        aac.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = (await getMediaInformation(
        aac.uri
      )) as MediaInformation
      assert(
        information.streams?.[0]?.codec_name === 'aac',
        `expected aac, got ${information.streams?.[0]?.codec_name}`
      )
      return `${aac.size} bytes`
    })
  )

  record(
    await run('Runs FFprobe with custom arguments', async () => {
      const logs: string[] = []
      const sessions: number[] = []
      const result = await probe(
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_type,sample_rate,channels',
          '-of',
          'json',
          source.uri,
        ],
        (message) => logs.push(message),
        (sessionId) => sessions.push(sessionId)
      )

      assert(result.success, result.failStackTrace ?? result.output)
      assert(
        sessions.some((id) => id > 0),
        'onSessionCreated never fired'
      )
      const output = `${result.output}\n${logs.join('')}`
      assert(/"codec_type"\s*:\s*"audio"/.test(output), 'no audio stream found')
      assert(
        /"sample_rate"\s*:\s*"8000"/.test(output),
        'unexpected sample rate'
      )
      return 'audio stream, 8000 Hz'
    })
  )

  record(
    await run('Cancels a running session', async () => {
      const cancelled = new File(directory, 'cancelled.mp4')
      let sessionId: number | undefined

      const execution = execute(
        [
          '-y',
          '-hide_banner',
          '-stream_loop',
          '-1',
          ...rawVideoInput(raw.uri),
          '-t',
          '600',
          '-vf',
          'scale=1280:720',
          ...videoEncoderArguments(h264 ?? 'mpeg4'),
          cancelled.uri,
        ],
        undefined,
        undefined,
        (id) => {
          sessionId = id
        }
      )

      await new Promise((resolve) => setTimeout(resolve, 900))
      assert(sessionId !== undefined, 'never received a session ID')
      cancel(sessionId)

      const result = await execution
      assert(result.cancelled, `session ended in state ${result.state}`)
      return `session ${sessionId} cancelled after ${result.durationMs} ms`
    })
  )

  record(
    await run('Reports failure for an invalid command', async () => {
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        new File(directory, 'missing.mp4').uri,
        new File(directory, 'never-written.mp4').uri,
      ])
      assert(!result.success, 'a missing input unexpectedly succeeded')
      assert(result.returnCode !== 0, 'expected a non-zero return code')
      // Both platforms must report the same session-state vocabulary.
      assert(
        result.state === 'completed',
        `expected state "completed", got "${result.state}"`
      )
      return `returnCode ${result.returnCode}, state ${result.state}`
    })
  )

  directory.delete()

  return {
    passed: checks.every((check) => check.passed),
    ffmpegVersion: getFFmpegVersion(),
    encoders: await listEncoders().catch(() => []),
    checks,
  }
}
