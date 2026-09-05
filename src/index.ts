import { NitroModules } from 'react-native-nitro-modules'
import type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegSessionCreatedCallback,
  FFmpegStatisticsCallback,
  MunimFfmpeg as MunimFfmpegSpec,
} from './specs/MunimFfmpeg.nitro'

const MunimFfmpeg =
  NitroModules.createHybridObject<MunimFfmpegSpec>('MunimFfmpeg')

export type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegSessionCreatedCallback,
  FFmpegStatisticsCallback,
  MunimFfmpegSpec,
}

const FILE_URI_SCHEME = /^file:\/\//

/**
 * Converts a `file://` URI into the plain path FFmpeg expects.
 *
 * `expo-file-system` and `react-native-fs` hand back percent-encoded URIs, but
 * FFmpeg's file protocol treats what follows `file://` literally: a path with a
 * space silently becomes a file named `my%20clip.mp4`. Anything that is not a
 * `file://` URI is returned untouched, so pipes, `content://`, and remote URLs
 * still work.
 */
export function normalizePath(value: string): string {
  if (!FILE_URI_SCHEME.test(value)) return value

  const path = value.replace(FILE_URI_SCHEME, '')
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function execute(
  arguments_: string[],
  onLog?: FFmpegLogCallback,
  onStatistics?: FFmpegStatisticsCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.execute(
    arguments_.map(normalizePath),
    onLog,
    onStatistics,
    onSessionCreated
  )
}

export function probe(
  arguments_: string[],
  onLog?: FFmpegLogCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.probe(
    arguments_.map(normalizePath),
    onLog,
    onSessionCreated
  )
}

/**
 * Shape of the FFprobe report returned by {@link getMediaInformation}.
 *
 * FFprobe's JSON output varies by container and codec, so every field is
 * optional and unknown keys are preserved. Numeric values such as durations
 * and bit rates arrive as strings, exactly as FFprobe prints them.
 */
export interface MediaStream {
  index: number
  codec_type?: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | string
  codec_name?: string
  codec_long_name?: string
  profile?: string
  codec_tag_string?: string
  codec_tag?: string
  width?: number
  height?: number
  coded_width?: number
  coded_height?: number
  pix_fmt?: string
  color_range?: string
  color_space?: string
  color_transfer?: string
  color_primaries?: string
  field_order?: string
  level?: number
  has_b_frames?: number
  sample_aspect_ratio?: string
  display_aspect_ratio?: string
  r_frame_rate?: string
  avg_frame_rate?: string
  time_base?: string
  start_pts?: number
  start_time?: string
  duration_ts?: number
  duration?: string
  bit_rate?: string
  max_bit_rate?: string
  bits_per_raw_sample?: string
  nb_frames?: string
  sample_fmt?: string
  sample_rate?: string
  channels?: number
  channel_layout?: string
  bits_per_sample?: number
  disposition?: Record<string, number>
  tags?: Record<string, string>
  side_data_list?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface MediaFormat {
  filename?: string
  nb_streams?: number
  nb_programs?: number
  format_name?: string
  format_long_name?: string
  start_time?: string
  duration?: string
  size?: string
  bit_rate?: string
  probe_score?: number
  tags?: Record<string, string>
  [key: string]: unknown
}

export interface MediaChapter {
  id: number
  time_base?: string
  start?: number
  start_time?: string
  end?: number
  end_time?: string
  tags?: Record<string, string>
  [key: string]: unknown
}

export interface MediaInformation {
  format?: MediaFormat
  streams?: MediaStream[]
  chapters?: MediaChapter[]
  [key: string]: unknown
}

export function getMediaInformation(path: string): Promise<MediaInformation> {
  return MunimFfmpeg.getMediaInformation(normalizePath(path)).then(
    (value) => JSON.parse(value) as MediaInformation
  )
}

/** Duration in seconds from a {@link MediaInformation} report, if FFprobe reported one. */
export function getMediaDuration(
  information: MediaInformation
): number | undefined {
  const raw =
    information.format?.duration ??
    information.streams?.find((stream) => stream.duration !== undefined)
      ?.duration
  if (raw === undefined) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds : undefined
}

export function cancel(sessionId?: number): void {
  MunimFfmpeg.cancel(sessionId)
}

export function cancelAll(): void {
  MunimFfmpeg.cancelAll()
}

export function getFFmpegVersion(): string {
  return MunimFfmpeg.ffmpegVersion
}

// The bundled FFmpeg builds differ per platform: Android ships the MediaCodec
// hardware encoders, iOS ships VideoToolbox. Asking the binary what it
// supports is more reliable than hard-coding a per-platform table.
const codecCache = new Map<string, Promise<string[]>>()

function listCodecs(flag: '-encoders' | '-decoders'): Promise<string[]> {
  const cached = codecCache.get(flag)
  if (cached) return cached

  const request = execute(['-hide_banner', flag])
    .then((result) => {
      if (!result.success) {
        throw new Error(result.failStackTrace ?? result.output)
      }

      // Each entry is printed as `<capability flags> <name> <description>`
      // below a line of dashes.
      const body = result.output.split(/^\s*-+\s*$/m).pop() ?? ''
      return body
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter(
          (columns) => columns.length >= 2 && /^[A-Z.]{6}$/.test(columns[0]!)
        )
        .map((columns) => columns[1]!)
    })
    .catch((error) => {
      codecCache.delete(flag)
      throw error
    })

  codecCache.set(flag, request)
  return request
}

/** Encoder names the bundled FFmpeg build can write, e.g. `libx264`. */
export function listEncoders(): Promise<string[]> {
  return listCodecs('-encoders')
}

/** Decoder names the bundled FFmpeg build can read, e.g. `h264`. */
export function listDecoders(): Promise<string[]> {
  return listCodecs('-decoders')
}

// Muxers, demuxers and filters print with different flag columns than codecs,
// and protocols use indented sections instead of a table, so each report gets
// its own parser. All of them are cached like the codec lists.
const reportCache = new Map<string, Promise<string[]>>()

function listReport(
  flag: string,
  parse: (output: string) => string[]
): Promise<string[]> {
  const cached = reportCache.get(flag)
  if (cached) return cached

  const request = execute(['-hide_banner', flag])
    .then((result) => {
      if (!result.success) {
        throw new Error(result.failStackTrace ?? result.output)
      }
      return parse(result.output)
    })
    .catch((error) => {
      reportCache.delete(flag)
      throw error
    })

  reportCache.set(flag, request)
  return request
}

// `-muxers`/`-demuxers` entries look like ` E  mp4  MP4 (MPEG-4 Part 14)`
// below a `--` separator line.
function parseFormats(output: string): string[] {
  const body = output.split(/^\s*-+\s*$/m).pop() ?? ''
  return body
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      (columns) => columns.length >= 2 && /^[DE.]{1,2}$/.test(columns[0]!)
    )
    .flatMap((columns) => columns[1]!.split(','))
}

// `-filters` entries look like ` TS scale  V->V  Scale the input video.`
// The flag column has held two or three characters across FFmpeg releases.
function parseFilters(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(
      (columns) =>
        columns.length >= 3 &&
        /^[TSC.]{2,3}$/.test(columns[0]!) &&
        /->/.test(columns[2]!)
    )
    .map((columns) => columns[1]!)
}

// `-protocols` prints `Input:` and `Output:` sections of indented names.
function parseProtocols(output: string): string[] {
  const names = new Set<string>()
  let inSection = false
  for (const line of output.split('\n')) {
    if (/^(Input|Output):/.test(line.trim())) {
      inSection = true
      continue
    }
    const name = line.trim()
    if (inSection && /^[a-z0-9_]+$/.test(name)) names.add(name)
  }
  return [...names]
}

/** Container formats the bundled FFmpeg build can write, e.g. `matroska`. */
export function listMuxers(): Promise<string[]> {
  return listReport('-muxers', parseFormats)
}

/** Container formats the bundled FFmpeg build can read, e.g. `matroska`. */
export function listDemuxers(): Promise<string[]> {
  return listReport('-demuxers', parseFormats)
}

/** Filter names the bundled FFmpeg build provides, e.g. `subtitles`. */
export function listFilters(): Promise<string[]> {
  return listReport('-filters', parseFilters)
}

/** Protocol names the bundled FFmpeg build provides, e.g. `https`. */
export function listProtocols(): Promise<string[]> {
  return listReport('-protocols', parseProtocols)
}

/**
 * Returns the first available encoder from `candidates`, so one command can
 * run on both platforms:
 *
 * ```ts
 * const encoder = await pickEncoder(['libx264', 'h264_videotoolbox'])
 * ```
 */
export async function pickEncoder(
  candidates: string[]
): Promise<string | undefined> {
  const encoders = new Set(await listEncoders())
  return candidates.find((candidate) => encoders.has(candidate))
}

export default MunimFfmpeg
