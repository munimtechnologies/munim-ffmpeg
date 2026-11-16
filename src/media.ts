/*
 * FFprobe report types and the pure helpers around them. Kept free of native
 * imports so they can be unit-tested.
 */

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

/**
 * Shape of the FFprobe report returned by `getMediaInformation()`.
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

/** The first video stream that is not attached cover art, if any. */
export function getVideoStream(
  information: MediaInformation
): MediaStream | undefined {
  return information.streams?.find(
    (stream) =>
      stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1
  )
}

/**
 * Clockwise rotation, in degrees (0, 90, 180 or 270), that players apply when
 * showing a stream. Phones record portrait video as landscape frames plus this
 * rotation, which FFmpeg reports either as a display matrix side data entry or,
 * in older files, as a `rotate` tag.
 */
export function getRotation(stream: MediaStream): number {
  const matrix = stream.side_data_list?.find(
    (entry) => typeof entry.rotation === 'number'
  )
  // The display matrix rotation is counter-clockwise; the legacy tag is clockwise.
  const degrees =
    matrix !== undefined
      ? -(matrix.rotation as number)
      : Number(stream.tags?.rotate ?? 0)
  if (!Number.isFinite(degrees)) return 0
  return (((Math.round(degrees / 90) * 90) % 360) + 360) % 360
}

/**
 * Width and height as the stream is displayed, after rotation. FFmpeg rotates
 * frames upright before any `-vf` filter runs, so this is the size filters see.
 */
export function getDisplaySize(
  stream: MediaStream
): { width: number; height: number } | undefined {
  const { width, height } = stream
  if (!width || !height) return undefined
  return getRotation(stream) % 180 === 0
    ? { width, height }
    : { width: height, height: width }
}

/** Frames per second from a `30000/1001`-style rate, if FFprobe reported one. */
export function getFrameRate(stream: MediaStream): number | undefined {
  for (const raw of [stream.avg_frame_rate, stream.r_frame_rate]) {
    if (!raw) continue
    const [numerator, denominator = '1'] = raw.split('/')
    const rate = Number(numerator) / Number(denominator)
    if (Number.isFinite(rate) && rate > 0) return rate
  }
  return undefined
}
