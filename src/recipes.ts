/*
 * Argument builders behind compressVideo() and createThumbnail(). Kept free of
 * native imports so the exact commands can be unit-tested.
 */

export type VideoCodec = 'h264' | 'hevc'

/**
 * Hardware encoders first, in the order they are tried. Only one family exists
 * per platform build (VideoToolbox on iOS, MediaCodec on Android), so the list
 * is filtered against what the bundled FFmpeg reports.
 */
export const HARDWARE_ENCODERS: Record<VideoCodec, readonly string[]> = {
  h264: ['h264_videotoolbox', 'h264_mediacodec'],
  hevc: ['hevc_videotoolbox', 'hevc_mediacodec'],
}

/**
 * Software encoders the LGPL build ships. There is no software HEVC encoder:
 * x265 is GPL, so HEVC is hardware-only.
 */
export const SOFTWARE_ENCODERS: Record<VideoCodec, readonly string[]> = {
  h264: ['libopenh264'],
  hevc: [],
}

export function isHardwareEncoder(encoder: string): boolean {
  return /_(videotoolbox|mediacodec)$/.test(encoder)
}

/**
 * The size that fits inside `maxWidth` × `maxHeight` with the same aspect
 * ratio, never larger than the source or the box, rounded down to even
 * numbers because every 4:2:0 encoder needs them.
 */
export function fitWithin(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxWidth && maxWidth > 0 ? maxWidth / width : 1,
    maxHeight && maxHeight > 0 ? maxHeight / height : 1
  )
  const even = (value: number) => Math.max(2, 2 * Math.floor(value / 2 + 1e-9))
  return { width: even(width * scale), height: even(height * scale) }
}

/**
 * A bitrate that keeps typical phone footage looking clean: about 0.07 bits
 * per pixel per frame for H.264, a third less for HEVC, clamped to a range
 * hardware encoders accept.
 */
export function defaultVideoBitrateKbits(
  width: number,
  height: number,
  frameRate: number,
  codec: VideoCodec
): number {
  const bitsPerPixel = codec === 'hevc' ? 0.045 : 0.07
  const fps = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30
  const kbits = (width * height * Math.min(fps, 60) * bitsPerPixel) / 1000
  return Math.round(Math.min(40_000, Math.max(300, kbits)))
}

/**
 * Encoder-specific options. MediaCodec takes NV12 frames; the others take
 * planar 4:2:0. HEVC in MP4 is tagged `hvc1`, the only tag Apple's players
 * accept.
 */
export function encoderArguments(encoder: string, codec: VideoCodec): string[] {
  const pixelFormat = encoder.endsWith('_mediacodec') ? 'nv12' : 'yuv420p'
  const tag = codec === 'hevc' ? ['-tag:v', 'hvc1'] : []
  return ['-c:v', encoder, '-pix_fmt', pixelFormat, ...tag]
}

export interface CompressCommand {
  input: string
  output: string
  encoder: string
  codec: VideoCodec
  /** Output size; omitted keeps the source size. */
  size?: { width: number; height: number }
  videoBitrateKbits: number
  frameRate?: number
  audio: 'aac' | 'copy' | 'none'
  audioBitrateKbits: number
  /** Decode with VideoToolbox (iOS). */
  hardwareDecoding: boolean
  faststart: boolean
}

export function compressArguments(command: CompressCommand): string[] {
  const filters: string[] = []
  if (command.size) {
    filters.push(`scale=${command.size.width}:${command.size.height}`)
  }

  const audio =
    command.audio === 'none'
      ? ['-an']
      : command.audio === 'copy'
        ? ['-map', '0:a:0?', '-c:a', 'copy']
        : [
            '-map',
            '0:a:0?',
            '-c:a',
            'aac',
            '-b:a',
            `${command.audioBitrateKbits}k`,
          ]

  return [
    '-y',
    '-hide_banner',
    // Hardware decoding falls back to software by itself when VideoToolbox
    // cannot take a stream, and frames come back in system memory, so the
    // scale filter works unchanged.
    ...(command.hardwareDecoding ? ['-hwaccel', 'videotoolbox'] : []),
    '-i',
    command.input,
    // First video stream and, if present, first audio stream. Data and
    // subtitle tracks that MP4 cannot carry are left out instead of failing.
    '-map',
    '0:v:0',
    ...audio,
    ...(filters.length ? ['-vf', filters.join(',')] : []),
    ...encoderArguments(command.encoder, command.codec),
    '-b:v',
    `${command.videoBitrateKbits}k`,
    ...(command.frameRate ? ['-r', String(command.frameRate)] : []),
    ...(command.faststart ? ['-movflags', '+faststart'] : []),
    command.output,
  ]
}

export interface ThumbnailCommand {
  input: string
  output: string
  timeSeconds: number
  size?: { width: number; height: number }
  /** 1 (best) to 31 (smallest), FFmpeg's JPEG quality scale. */
  jpegQuality: number
}

export function thumbnailArguments(command: ThumbnailCommand): string[] {
  const filters = command.size
    ? ['-vf', `scale=${command.size.width}:${command.size.height}`]
    : []
  return [
    '-y',
    '-hide_banner',
    // Seeking before -i jumps to the nearest keyframe and decodes forward to
    // the exact time, which is far faster than decoding from the start.
    '-ss',
    command.timeSeconds.toFixed(3),
    '-i',
    command.input,
    '-map',
    '0:v:0',
    '-frames:v',
    '1',
    ...filters,
    ...(/\.jpe?g$/i.test(command.output)
      ? ['-q:v', String(command.jpegQuality)]
      : []),
    '-update',
    '1',
    command.output,
  ]
}

/** Maps a 0–1 quality onto FFmpeg's 2–31 JPEG scale (lower is better). */
export function jpegQualityScale(quality: number): number {
  const clamped = Math.min(1, Math.max(0, quality))
  return Math.round(31 - clamped * 29)
}

/** Fraction of the work done, 0–1, from a statistics callback's `timeMs`. */
export function progressFraction(
  timeMs: number,
  durationSeconds: number | undefined
): number | undefined {
  if (!durationSeconds || durationSeconds <= 0 || timeMs < 0) return undefined
  return Math.min(1, timeMs / 1000 / durationSeconds)
}
