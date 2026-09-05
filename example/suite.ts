import { Directory, File, Paths } from 'expo-file-system'
import {
  cancel,
  cancelAll,
  execute,
  getFFmpegVersion,
  getMediaDuration,
  getMediaInformation,
  listDecoders,
  listDemuxers,
  listEncoders,
  listFilters,
  listMuxers,
  listProtocols,
  normalizePath,
  pickEncoder,
  probe,
} from 'munim-ffmpeg'

import { RAW_VIDEO, rawVideoFrames, wavFixture } from './fixture'

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

function workspace() {
  const directory = new Directory(Paths.cache, 'munim-ffmpeg-suite')
  if (directory.exists) directory.delete()
  directory.create({ intermediates: true })
  return directory
}

// Which H.264/HEVC encoder exists depends entirely on how the bundled FFmpeg
// was built: libx264 in a GPL build, VideoToolbox on iOS, MediaCodec on
// Android. Asking at runtime is the only portable approach.
const H264_ENCODERS = [
  'libx264',
  'h264_videotoolbox',
  'h264_mediacodec',
  'libopenh264',
]
const HEVC_ENCODERS = ['libx265', 'hevc_videotoolbox', 'hevc_mediacodec']

// The Android build is compiled with `--disable-indev=lavfi`, so the usual
// `testsrc` generator is unavailable. Raw RGB frames written from JavaScript
// give both platforms the same input without bundling a media asset.
const RAW_WIDTH = RAW_VIDEO.width
const RAW_HEIGHT = RAW_VIDEO.height
const RAW_FRAMES = RAW_VIDEO.frames
const RAW_FPS = RAW_VIDEO.fps
const SOURCE_SECONDS = RAW_FRAMES / RAW_FPS

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

// Each encoder family wants a different input format: MediaCodec takes NV12,
// the software and VideoToolbox encoders take planar YUV.
function videoEncoderArguments(encoder: string) {
  const common = ['-c:v', encoder, '-g', String(RAW_FPS)]
  if (encoder.endsWith('_mediacodec')) return [...common, '-pix_fmt', 'nv12']
  if (encoder === 'libx264') {
    return [...common, '-preset', 'ultrafast', '-pix_fmt', 'yuv420p']
  }
  return [...common, '-pix_fmt', 'yuv420p']
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function run(
  name: string,
  body: () => Promise<string>
): Promise<CheckResult> {
  const startedAt = Date.now()
  // Logged before the work starts so a hung check is identifiable from logcat
  // or the Xcode console.
  console.log('MUNIM_FFMPEG_CHECK', name)
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
  source.write(wavFixture(SOURCE_SECONDS))

  const raw = new File(directory, 'source.rgb')
  raw.create({ overwrite: true })
  raw.write(rawVideoFrames())

  const video = new File(directory, 'video-h264.mp4')
  const scaled = new File(directory, 'scaled.mp4')
  const mp3 = new File(directory, 'audio.mp3')
  const aac = new File(directory, 'audio.m4a')
  const muxed = new File(directory, 'muxed.mp4')

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
    await run('Encodes H.264 in software (libopenh264)', async () => {
      const encoders = await listEncoders()
      assert(
        encoders.includes('libopenh264'),
        'libopenh264 missing from this build'
      )

      const software = new File(directory, 'software-h264.mp4')
      const result = await execute([
        '-y',
        '-hide_banner',
        ...rawVideoInput(raw.uri),
        ...videoEncoderArguments('libopenh264'),
        software.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      // Hardware encoders can report success while writing nothing, so the
      // output is probed rather than trusted.
      const information = await getMediaInformation(software.uri)
      const stream = information.streams?.find(
        (candidate) => candidate.codec_type === 'video'
      )
      assert(
        stream?.codec_name === 'h264',
        `expected h264, got ${stream?.codec_name}`
      )
      return `${software.size} bytes, ${stream?.width}x${stream?.height}`
    })
  )

  record(
    await run('Probes the encoded video', async () => {
      const information = await getMediaInformation(video.uri)
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
      const duration = getMediaDuration(information)
      assert(
        duration !== undefined && duration > 0,
        `getMediaDuration reported ${duration}`
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
        'scale=176:144',
        ...videoEncoderArguments(h264),
        scaled.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(scaled.uri)
      const stream = information.streams?.find(
        (candidate) => candidate.codec_type === 'video'
      )
      // MediaCodec rejects very small frames, so the target is a size every
      // encoder accepts: both dimensions are multiples of 16.
      assert(
        stream?.width === 176 && stream?.height === 144,
        `expected 176x144, got ${stream?.width}x${stream?.height}`
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

      const information = await getMediaInformation(mp3.uri)
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

      const information = await getMediaInformation(aac.uri)
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

  record(
    await run('Muxes video and audio into one file', async () => {
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        video.uri,
        '-i',
        source.uri,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-shortest',
        muxed.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(muxed.uri)
      const kinds = (information.streams ?? []).map(
        (stream) => stream.codec_type
      )
      assert(kinds.includes('video'), 'no video stream in the muxed file')
      assert(kinds.includes('audio'), 'no audio stream in the muxed file')

      const duration = Number(information.format?.duration ?? 'NaN')
      const expected = SOURCE_SECONDS
      assert(
        Math.abs(duration - expected) < 0.3,
        `expected about ${expected}s, got ${information.format?.duration}`
      )
      return `${kinds.join(' + ')}, ${duration.toFixed(2)}s`
    })
  )

  record(
    await run('Extracts the audio track back out', async () => {
      const extracted = new File(directory, 'extracted.m4a')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        muxed.uri,
        '-vn',
        '-c:a',
        'copy',
        extracted.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(extracted.uri)
      assert(
        information.streams?.length === 1 &&
          information.streams[0]?.codec_type === 'audio',
        'expected a single audio stream'
      )
      return `${extracted.size} bytes, ${information.streams?.[0]?.codec_name}`
    })
  )

  record(
    await run('Trims with stream copy', async () => {
      const trimmed = new File(directory, 'trimmed.mp4')
      // `-ss` before `-i` is input seeking: it snaps to a keyframe, which is
      // what stream copy needs. After `-i` it drops packets mid-GOP and can
      // leave a file with no decodable duration.
      const result = await execute([
        '-y',
        '-hide_banner',
        '-ss',
        '1',
        '-i',
        muxed.uri,
        '-t',
        '1',
        '-c',
        'copy',
        trimmed.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(trimmed.uri)
      const duration = Number(information.format?.duration ?? 'NaN')
      assert(
        Number.isFinite(duration) && duration > 0.5 && duration < 1.6,
        `unexpected trimmed duration ${JSON.stringify(information.format)}`
      )
      return `${duration.toFixed(3)}s from a ${SOURCE_SECONDS}s source`
    })
  )

  record(
    await run('Extracts a thumbnail at a timestamp', async () => {
      const thumbnail = new File(directory, 'thumbnail.png')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-ss',
        '0.3',
        '-i',
        video.uri,
        '-frames:v',
        '1',
        thumbnail.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)
      assert((thumbnail.size ?? 0) > 0, 'no thumbnail written')

      const information = await getMediaInformation(thumbnail.uri)
      assert(
        information.streams?.[0]?.codec_name === 'png',
        `expected png, got ${information.streams?.[0]?.codec_name}`
      )
      return `${thumbnail.size} bytes png`
    })
  )

  record(
    await run('Encodes and decodes an AVIF image', async () => {
      // libaom encodes (issue #6); dav1d decodes, so the round trip exercises
      // both AV1 libraries and the AVIF muxer/demuxer in between.
      const encoders = await listEncoders()
      assert(encoders.includes('libaom-av1'), 'libaom-av1 encoder missing')

      const avif = new File(directory, 'thumbnail.avif')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-ss',
        '0.3',
        '-i',
        video.uri,
        '-frames:v',
        '1',
        '-c:v',
        'libaom-av1',
        '-still-picture',
        '1',
        '-cpu-used',
        '8',
        '-crf',
        '28',
        '-pix_fmt',
        'yuv420p',
        '-f',
        'avif',
        avif.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)
      assert((avif.size ?? 0) > 0, 'no avif written')

      const information = await getMediaInformation(avif.uri)
      const stream = information.streams?.[0]
      assert(
        stream?.codec_name === 'av1',
        `expected av1, got ${stream?.codec_name}`
      )
      assert(
        stream.width === RAW_WIDTH && stream.height === RAW_HEIGHT,
        `expected ${RAW_WIDTH}x${RAW_HEIGHT}, got ${stream.width}x${stream.height}`
      )

      const logs: string[] = []
      const decoded = await execute(
        [
          '-hide_banner',
          '-c:v',
          'libdav1d',
          '-i',
          avif.uri,
          '-vf',
          'signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG',
          '-f',
          'null',
          '-',
        ],
        (message) => logs.push(message)
      )
      assert(decoded.success, decoded.failStackTrace ?? decoded.output)
      const luma = /YAVG=([0-9.]+)/.exec(
        `${logs.join('')}${decoded.output}`
      )?.[1]
      assert(luma !== undefined, 'dav1d decoded no frame')
      assert(Number(luma) > 16, `decoded frame is black (YAVG ${luma})`)
      return `${avif.size} bytes avif, decoded by dav1d with YAVG ${Number(luma).toFixed(1)}`
    })
  )

  record(
    await run('Encodes VP9 and Opus into WebM', async () => {
      const webm = new File(directory, 'clip.webm')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        muxed.uri,
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '200k',
        '-deadline',
        'realtime',
        '-cpu-used',
        '8',
        '-c:a',
        'libopus',
        webm.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(webm.uri)
      const codecs = (information.streams ?? []).map(
        (stream) => stream.codec_name
      )
      assert(codecs.includes('vp9'), `expected vp9, got ${codecs.join(', ')}`)
      assert(codecs.includes('opus'), `expected opus, got ${codecs.join(', ')}`)
      return `${webm.size} bytes, ${codecs.join(' + ')}`
    })
  )

  record(
    await run('Lists muxers, demuxers, filters, and protocols', async () => {
      const [muxers, demuxers, filters, protocols] = await Promise.all([
        listMuxers(),
        listDemuxers(),
        listFilters(),
        listProtocols(),
      ])
      assert(muxers.includes('matroska'), 'matroska muxer missing')
      assert(muxers.includes('mp4'), 'mp4 muxer missing')
      assert(demuxers.includes('matroska'), 'matroska demuxer missing')
      assert(filters.includes('subtitles'), 'subtitles filter missing')
      assert(filters.includes('ass'), 'ass filter missing')
      assert(filters.includes('drawtext'), 'drawtext filter missing')
      assert(protocols.includes('https'), 'https protocol missing')
      return `${muxers.length} muxers, ${demuxers.length} demuxers, ${filters.length} filters, ${protocols.length} protocols`
    })
  )

  // Subtitle rendering is verified by measuring luma: the source frames are
  // pure black (Y = 16 in limited range), so any brighter average proves text
  // was actually rasterised, not merely that the filter graph ran.
  const black = new File(directory, 'black.rgb')
  black.create({ overwrite: true })
  black.write(new Uint8Array(RAW_WIDTH * RAW_HEIGHT * 3 * RAW_FRAMES))

  async function burnAndMeasure(filterGraph: string): Promise<number> {
    const logs: string[] = []
    const result = await execute(
      [
        '-y',
        '-hide_banner',
        ...rawVideoInput(black.uri),
        '-vf',
        `${filterGraph},signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG`,
        '-f',
        'null',
        '-',
      ],
      (message) => logs.push(message)
    )
    assert(result.success, result.failStackTrace ?? result.output)

    const values = `${logs.join('')}${result.output}`
      .split('\n')
      .map((line) => /YAVG=([0-9.]+)/.exec(line)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number)
    assert(
      values.length > 0,
      `signalstats reported no luma values; returnCode=${result.returnCode} logs=${logs.length} output=${result.output.length} tail: ${`${logs.join('')}${result.output}`.slice(-600)}`
    )
    return Math.max(...values)
  }

  const ass = new File(directory, 'styled.ass')
  ass.create({ overwrite: true })
  ass.write(
    [
      '[Script Info]',
      'ScriptType: v4.00+',
      `PlayResX: ${RAW_WIDTH}`,
      `PlayResY: ${RAW_HEIGHT}`,
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Alignment, MarginL, MarginR, MarginV, Outline, Shadow',
      'Style: Big,Arial,48,&H00FFFFFF,&H00000000,&H00000000,1,0,5,10,10,10,2,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Text',
      `Dialogue: 0,0:00:00.00,0:00:09.00,Big,{\\an5}HELLO مرحبا`,
    ].join('\n')
  )

  record(
    await run('Burns styled ASS subtitles with libass', async () => {
      const luma = await burnAndMeasure(
        `ass=filename=${normalizePath(ass.uri)}`
      )
      assert(
        luma > 18,
        `frames stayed black (max YAVG ${luma}); libass rendered nothing`
      )
      return `Arabic + Latin text rendered, max YAVG ${luma.toFixed(1)}`
    })
  )

  const srt = new File(directory, 'plain.srt')
  srt.create({ overwrite: true })
  srt.write('1\n00:00:00,000 --> 00:00:09,000\nSUBTITLE TEST\n')

  record(
    await run('Burns SRT subtitles with force_style', async () => {
      const luma = await burnAndMeasure(
        `subtitles=filename=${normalizePath(srt.uri)}:force_style='Fontsize=64,Outline=2,Alignment=10'`
      )
      assert(
        luma > 18,
        `frames stayed black (max YAVG ${luma}); no subtitle rendered`
      )
      return `styled SRT rendered, max YAVG ${luma.toFixed(1)}`
    })
  )

  record(
    await run('Muxes a multi-track MKV and maps streams', async () => {
      const mkv = new File(directory, 'multitrack.mkv')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        muxed.uri,
        '-i',
        source.uri,
        '-i',
        srt.uri,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-map',
        '1:a:0',
        '-map',
        '2:s:0',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-c:s',
        'srt',
        '-metadata:s:a:1',
        'language=urd',
        mkv.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(mkv.uri)
      const kinds = (information.streams ?? []).map((s) => s.codec_type)
      assert(
        /matroska/.test(information.format?.format_name ?? ''),
        `expected matroska, got ${information.format?.format_name}`
      )
      assert(
        kinds.filter((k) => k === 'audio').length === 2,
        `expected 2 audio streams, got ${kinds.join(', ')}`
      )
      assert(kinds.includes('subtitle'), 'subtitle stream missing from MKV')

      // Remux everything with stream copy, then pull out just the second
      // audio track — the workflows issue #2 asked to support.
      const remuxed = new File(directory, 'remuxed.mkv')
      const copyResult = await execute([
        '-y',
        '-hide_banner',
        '-i',
        mkv.uri,
        '-map',
        '0',
        '-c',
        'copy',
        remuxed.uri,
      ])
      assert(copyResult.success, copyResult.failStackTrace ?? copyResult.output)
      const remuxedInfo = await getMediaInformation(remuxed.uri)
      assert(
        (remuxedInfo.streams ?? []).length === 4,
        `remux kept ${(remuxedInfo.streams ?? []).length} of 4 streams`
      )

      const track = new File(directory, 'second-audio.m4a')
      const extractResult = await execute([
        '-y',
        '-hide_banner',
        '-i',
        remuxed.uri,
        '-map',
        '0:a:1',
        '-c',
        'copy',
        track.uri,
      ])
      assert(
        extractResult.success,
        extractResult.failStackTrace ?? extractResult.output
      )
      const trackInfo = await getMediaInformation(track.uri)
      assert(
        trackInfo.streams?.length === 1 &&
          trackInfo.streams[0]?.codec_type === 'audio',
        'expected exactly the mapped audio stream'
      )
      return `4 streams muxed, remuxed with -c copy, track extracted`
    })
  )

  record(
    await run('Embeds soft subtitle tracks with metadata', async () => {
      // MKV carries SRT and ASS side by side; the player toggles them and the
      // video is never re-encoded.
      const softMkv = new File(directory, 'soft-subs.mkv')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        muxed.uri,
        '-i',
        srt.uri,
        '-i',
        ass.uri,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-map',
        '1:0',
        '-map',
        '2:0',
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-c:s:0',
        'srt',
        '-c:s:1',
        'ass',
        '-metadata:s:s:0',
        'language=eng',
        '-metadata:s:s:0',
        'title=English',
        '-metadata:s:s:1',
        'language=urd',
        '-metadata:s:s:1',
        'title=Urdu',
        softMkv.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(softMkv.uri)
      const subtitles = (information.streams ?? []).filter(
        (stream) => stream.codec_type === 'subtitle'
      )
      assert(
        subtitles.length === 2,
        `expected 2 subtitle streams, got ${subtitles.length}`
      )
      const codecs = subtitles.map((stream) => stream.codec_name)
      assert(
        codecs.includes('subrip'),
        `no subrip track in ${codecs.join(', ')}`
      )
      assert(codecs.includes('ass'), `no ass track in ${codecs.join(', ')}`)
      const languages = subtitles.map((stream) => stream.tags?.language)
      assert(
        languages.includes('eng') && languages.includes('urd'),
        `language tags did not round-trip: ${languages.join(', ')}`
      )
      const titles = subtitles.map((stream) => stream.tags?.title)
      assert(
        titles.includes('English') && titles.includes('Urdu'),
        `title tags did not round-trip: ${titles.join(', ')}`
      )

      // MP4 wants its own subtitle codec: mov_text.
      const softMp4 = new File(directory, 'soft-subs.mp4')
      const mp4Result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        muxed.uri,
        '-i',
        srt.uri,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-map',
        '1:0',
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-c:s',
        'mov_text',
        '-metadata:s:s:0',
        'language=eng',
        softMp4.uri,
      ])
      assert(mp4Result.success, mp4Result.failStackTrace ?? mp4Result.output)

      const mp4Information = await getMediaInformation(softMp4.uri)
      const movText = (mp4Information.streams ?? []).find(
        (stream) => stream.codec_type === 'subtitle'
      )
      assert(
        movText?.codec_name === 'mov_text',
        `expected mov_text, got ${movText?.codec_name}`
      )
      return 'MKV: subrip + ass with language and title tags; MP4: mov_text'
    })
  )

  const hevc = await pickEncoder(HEVC_ENCODERS)

  record(
    await run(
      `Encodes HEVC with ${hevc ?? 'no available encoder'}`,
      async () => {
        assert(hevc, `none of ${HEVC_ENCODERS.join(', ')} are available`)
        const output = new File(directory, 'clip-hevc.mp4')
        const result = await execute([
          '-y',
          '-hide_banner',
          '-i',
          video.uri,
          ...videoEncoderArguments(hevc),
          '-tag:v',
          'hvc1',
          output.uri,
        ])
        assert(result.success, result.failStackTrace ?? result.output)

        const information = await getMediaInformation(output.uri)
        assert(
          information.streams?.[0]?.codec_name === 'hevc',
          `expected hevc, got ${information.streams?.[0]?.codec_name}`
        )
        return `${output.size} bytes`
      }
    )
  )

  record(
    await run('Runs a multi-step filter graph (animated GIF)', async () => {
      const gif = new File(directory, 'clip.gif')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        video.uri,
        '-filter_complex',
        'fps=8,scale=128:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
        gif.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(gif.uri)
      assert(
        information.streams?.[0]?.codec_name === 'gif',
        `expected gif, got ${information.streams?.[0]?.codec_name}`
      )
      return `${gif.size} bytes, ${information.streams?.[0]?.width}px wide`
    })
  )

  record(
    await run('Concatenates two clips', async () => {
      const listPath = new File(directory, 'concat.txt')
      const plain = normalizePath(video.uri)
      listPath.create({ overwrite: true })
      listPath.write(`file '${plain}'\nfile '${plain}'\n`)

      const joined = new File(directory, 'joined.mp4')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        normalizePath(listPath.uri),
        '-c',
        'copy',
        joined.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(joined.uri)
      const duration = Number(information.format?.duration ?? 'NaN')
      assert(
        duration > SOURCE_SECONDS * 1.8,
        `expected roughly ${(SOURCE_SECONDS * 2).toFixed(2)}s, got ${duration}`
      )
      return `${duration.toFixed(3)}s from two copies`
    })
  )

  record(
    await run('Resamples audio to 44.1 kHz stereo', async () => {
      const resampled = new File(directory, 'resampled.wav')
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        source.uri,
        '-ar',
        '44100',
        '-ac',
        '2',
        resampled.uri,
      ])
      assert(result.success, result.failStackTrace ?? result.output)

      const information = await getMediaInformation(resampled.uri)
      const stream = information.streams?.[0]
      assert(
        stream?.sample_rate === '44100' && stream?.channels === 2,
        `got ${stream?.sample_rate} Hz, ${stream?.channels} channels`
      )
      return '44100 Hz, 2 channels'
    })
  )

  record(
    await run(
      'Handles paths with spaces and non-ASCII characters',
      async () => {
        const awkward = new File(directory, 'clip with spaces é 漢字.mp4')
        const result = await execute([
          '-y',
          '-hide_banner',
          '-i',
          video.uri,
          '-c',
          'copy',
          awkward.uri,
        ])
        assert(result.success, result.failStackTrace ?? result.output)
        assert((awkward.size ?? 0) > 0, 'no output written')

        const information = await getMediaInformation(awkward.uri)
        assert(information.streams?.length === 1, 'could not probe the output')
        return `${awkward.size} bytes`
      }
    )
  )

  record(
    await run('Runs two sessions concurrently', async () => {
      const first = new File(directory, 'concurrent-1.m4a')
      const second = new File(directory, 'concurrent-2.m4a')
      const ids: number[] = []

      const [one, two] = await Promise.all([
        execute(
          ['-y', '-hide_banner', '-i', source.uri, '-c:a', 'aac', first.uri],
          undefined,
          undefined,
          (id) => ids.push(id)
        ),
        execute(
          ['-y', '-hide_banner', '-i', source.uri, '-c:a', 'aac', second.uri],
          undefined,
          undefined,
          (id) => ids.push(id)
        ),
      ])

      assert(one.success, one.failStackTrace ?? one.output)
      assert(two.success, two.failStackTrace ?? two.output)
      assert(ids.length === 2, `expected 2 session IDs, got ${ids.length}`)
      assert(ids[0] !== ids[1], 'both sessions reported the same ID')
      assert(one.sessionId !== two.sessionId, 'results share a session ID')
      return `sessions ${ids.join(' and ')} both completed`
    })
  )

  record(
    await run('cancelAll() stops every running session', async () => {
      const longRun = (name: string) =>
        execute([
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
          new File(directory, name).uri,
        ])

      const running = [longRun('all-1.mp4'), longRun('all-2.mp4')]
      await new Promise((resolve) => setTimeout(resolve, 900))
      cancelAll()

      const results = await Promise.all(running)
      assert(
        results.every((result) => result.cancelled),
        `cancelled flags: ${results.map((result) => result.cancelled).join(', ')}`
      )
      return `${results.length} sessions cancelled`
    })
  )

  record(
    await run('Reports HTTPS protocol support', async () => {
      const result = await execute(['-hide_banner', '-protocols'])
      assert(result.success, result.failStackTrace ?? result.output)
      const protocols = result.output
      assert(/\bhttps\b/.test(protocols), 'https protocol missing')
      assert(/\btls\b/.test(protocols), 'tls protocol missing')
      return 'https and tls available'
    })
  )

  record(
    await run('Reports failure for an unknown encoder', async () => {
      const result = await execute([
        '-y',
        '-hide_banner',
        '-i',
        source.uri,
        '-c:a',
        'definitely_not_an_encoder',
        new File(directory, 'never.m4a').uri,
      ])
      assert(!result.success, 'an unknown encoder unexpectedly succeeded')
      assert(
        /Unknown encoder|Encoder not found|not found/i.test(result.output),
        `unexpected output: ${result.output.slice(0, 120)}`
      )
      return `returnCode ${result.returnCode}`
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
