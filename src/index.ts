import { NitroModules } from 'react-native-nitro-modules'
import type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegSessionCreatedCallback,
  FFmpegSessionState,
  FFmpegStatisticsCallback,
  MunimFfmpeg as MunimFfmpegSpec,
} from './specs/MunimFfmpeg.nitro'
import { parseArguments } from './arguments'
import {
  getDisplaySize,
  getFrameRate,
  getMediaDuration,
  getVideoStream,
  normalizePath,
  type MediaInformation,
} from './media'
import {
  compressArguments,
  defaultVideoBitrateKbits,
  fitWithin,
  HARDWARE_ENCODERS,
  isHardwareEncoder,
  jpegQualityScale,
  progressFraction,
  SOFTWARE_ENCODERS,
  thumbnailArguments,
  type VideoCodec,
} from './recipes'
import {
  parseCodecs,
  parseFilters,
  parseFormats,
  parseProtocols,
} from './reports'

const MunimFfmpeg =
  NitroModules.createHybridObject<MunimFfmpegSpec>('MunimFfmpeg')

export type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegSessionCreatedCallback,
  FFmpegSessionState,
  FFmpegStatisticsCallback,
  MunimFfmpegSpec,
  VideoCodec,
}
export type {
  MediaChapter,
  MediaFormat,
  MediaInformation,
  MediaStream,
} from './media'
export {
  getDisplaySize,
  getFrameRate,
  getMediaDuration,
  getRotation,
  getVideoStream,
  normalizePath,
} from './media'
export { formatArguments, parseArguments } from './arguments'

/** Why a high-level helper such as {@link compressVideo} gave up. */
export type MunimFfmpegErrorCode =
  'NO_VIDEO_STREAM' | 'NO_ENCODER' | 'CANCELLED' | 'FAILED'

export class MunimFfmpegError extends Error {
  readonly code: MunimFfmpegErrorCode
  /** The last FFmpeg run, when one happened. */
  readonly result?: FFmpegSessionResult

  constructor(
    code: MunimFfmpegErrorCode,
    message: string,
    result?: FFmpegSessionResult
  ) {
    super(message)
    this.name = 'MunimFfmpegError'
    this.code = code
    this.result = result
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
 * {@link execute} for a command written as one string, the way FFmpegKit's
 * `FFmpegKit.execute(command)` takes it. The string is split with
 * {@link parseArguments}, so quote paths that contain spaces:
 *
 * ```ts
 * await executeCommand(`-i "${input}" -c:v copy "${output}"`)
 * ```
 *
 * Throws a `SyntaxError` for an unterminated quote.
 */
export function executeCommand(
  command: string,
  onLog?: FFmpegLogCallback,
  onStatistics?: FFmpegStatisticsCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return execute(parseArguments(command), onLog, onStatistics, onSessionCreated)
}

/** {@link probe} for a command written as one string; see {@link executeCommand}. */
export function probeCommand(
  command: string,
  onLog?: FFmpegLogCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return probe(parseArguments(command), onLog, onSessionCreated)
}

export function getMediaInformation(path: string): Promise<MediaInformation> {
  return MunimFfmpeg.getMediaInformation(normalizePath(path)).then(
    (value) => JSON.parse(value) as MediaInformation
  )
}

/**
 * Cancels one session. A queued session is dropped before it starts and a
 * running one is stopped; either way only that session settles as cancelled,
 * and every other session carries on. Finished and unknown ids are ignored.
 *
 * Without an id, cancels the running session and everything queued behind
 * it, like {@link cancelAll}.
 */
export function cancel(sessionId?: number): void {
  MunimFfmpeg.cancel(sessionId)
}

/** Cancels the running session and every queued one. */
export function cancelAll(): void {
  MunimFfmpeg.cancelAll()
}

/**
 * Pauses a session started with `execute()`, whether it is running or still
 * queued. FFmpeg stops reading its inputs and the rest of the pipeline idles
 * once it has drained, so a paused session costs no CPU. Output files stay
 * open, and `resume()` continues from exactly where it stopped: nothing is
 * re-encoded or skipped, and the `execute()` promise settles once, when the
 * work finishes. `cancel()` still works while paused.
 *
 * Returns false if the session is unknown, has finished, or is a probe.
 */
export function pause(sessionId: number): boolean {
  return MunimFfmpeg.pause(sessionId)
}

/** Resumes a paused session. Returns false if it was not paused. */
export function resume(sessionId: number): boolean {
  return MunimFfmpeg.resume(sessionId)
}

export function getSessionState(sessionId: number): FFmpegSessionState {
  return MunimFfmpeg.getSessionState(sessionId)
}

/**
 * How often log callbacks are delivered, in milliseconds. FFmpeg can log
 * thousands of lines a second at `-loglevel verbose` or `debug`, and every
 * callback is a separate hop onto the JavaScript thread, so by default lines
 * are collected natively and handed over at most every 100 ms, several lines
 * per callback. Every line still arrives, in order, and all of them have been
 * delivered by the time the session's promise settles.
 *
 * `0` delivers each message as FFmpeg logs it, as versions before 0.10 did.
 * Applies to sessions started after the call. Values are clamped to 0–5000.
 */
export function setLogBatchInterval(intervalMs: number): void {
  if (!Number.isFinite(intervalMs)) {
    throw new RangeError(`Invalid log batch interval: ${intervalMs}`)
  }
  MunimFfmpeg.setLogBatchInterval(Math.min(5000, Math.max(0, intervalMs)))
}

export function getFFmpegVersion(): string {
  return MunimFfmpeg.ffmpegVersion
}

// The bundled FFmpeg builds differ per platform: Android ships the MediaCodec
// hardware encoders, iOS ships VideoToolbox. Asking the binary what it
// supports is more reliable than hard-coding a per-platform table. Each
// report is fetched once and cached; a failed fetch is retried next time.
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

/** Encoder names the bundled FFmpeg build can write, e.g. `libx264`. */
export function listEncoders(): Promise<string[]> {
  return listReport('-encoders', parseCodecs)
}

/** Decoder names the bundled FFmpeg build can read, e.g. `h264`. */
export function listDecoders(): Promise<string[]> {
  return listReport('-decoders', parseCodecs)
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

/** The hardware video encoders this device's build provides, e.g. `h264_videotoolbox`. */
export async function listHardwareEncoders(): Promise<string[]> {
  return (await listEncoders()).filter(isHardwareEncoder)
}

export interface TranscodeProgress {
  /** 0–1, when the input's duration is known. */
  fraction?: number
  /** Output time written so far, in milliseconds. */
  timeMs: number
  sizeBytes: number
  bitrateKbits: number
  speed: number
  fps: number
}

export interface CompressVideoOptions {
  /** Output codec. Default `h264`. HEVC has no software fallback in this build. */
  codec?: VideoCodec
  /** Fit the picture inside this box, keeping its aspect ratio. Never upscales. */
  maxWidth?: number
  maxHeight?: number
  /** Video bitrate. Default: chosen from the output size and frame rate. */
  videoBitrateKbits?: number
  /** Output frame rate. Default: the source's. */
  frameRate?: number
  /** Default `aac`. `copy` keeps the source audio, `none` drops it. */
  audio?: 'aac' | 'copy' | 'none'
  /** AAC bitrate. Default 128. */
  audioBitrateKbits?: number
  /**
   * `prefer` (default): hardware encoder, then software if it fails.
   * `require`: hardware only. `avoid`: software only.
   */
  hardware?: 'prefer' | 'require' | 'avoid'
  /** Decode with VideoToolbox when encoding with it (iOS). Default true. */
  hardwareDecoding?: boolean
  /** Move the MP4 index to the front so playback can start while downloading. Default true. */
  faststart?: boolean
  onProgress?: (progress: TranscodeProgress) => void
  onLog?: FFmpegLogCallback
  /** Called for every attempt, so a fallback attempt reports its own id. */
  onSessionCreated?: FFmpegSessionCreatedCallback
}

export interface CompressVideoResult {
  output: string
  encoder: string
  hardware: boolean
  width?: number
  height?: number
  videoBitrateKbits: number
  /** Every encoder tried, in order, with FFmpeg's return code. */
  attempts: Array<{ encoder: string; returnCode: number }>
  session: FFmpegSessionResult
}

/**
 * True when `path` holds at least one decodable video frame. An Android
 * emulator's MediaCodec encoder "succeeds" without writing any, so a return
 * code of 0 is not enough on its own.
 */
async function hasVideoFrames(path: string): Promise<boolean> {
  try {
    const stream = getVideoStream(await getMediaInformation(path))
    if (!stream) return false
    const frames = Number(stream.nb_frames)
    return !Number.isFinite(frames) || frames > 0
  } catch {
    return false
  }
}

/**
 * Re-encodes a video for sharing or upload, hardware-accelerated by default.
 *
 * Uses the platform's hardware encoder (VideoToolbox on iOS, MediaCodec on
 * Android), and on iOS also decodes with VideoToolbox. If the hardware path
 * fails, or writes no frames (as an Android emulator's MediaCodec does), it
 * retries with the software encoder. The picture is scaled to fit `maxWidth` ×
 * `maxHeight` without upscaling, rotation from phone footage is applied, and
 * progress is reported as a fraction of the input's duration.
 *
 * ```ts
 * const { encoder } = await compressVideo(input, output, {
 *   maxWidth: 1280,
 *   maxHeight: 1280,
 *   onProgress: ({ fraction }) => setProgress(fraction ?? 0),
 * })
 * ```
 *
 * Throws {@link MunimFfmpegError}: `NO_VIDEO_STREAM`, `NO_ENCODER` (for
 * example HEVC with `hardware: 'avoid'`), `CANCELLED` if the session was
 * cancelled, or `FAILED` once every encoder has failed.
 */
export async function compressVideo(
  input: string,
  output: string,
  options: CompressVideoOptions = {}
): Promise<CompressVideoResult> {
  const codec = options.codec ?? 'h264'
  const hardware = options.hardware ?? 'prefer'

  const information = await getMediaInformation(input)
  const stream = getVideoStream(information)
  if (!stream) {
    throw new MunimFfmpegError(
      'NO_VIDEO_STREAM',
      `${input} has no video stream to compress`
    )
  }

  const source = getDisplaySize(stream)
  const target = source
    ? fitWithin(
        source.width,
        source.height,
        options.maxWidth,
        options.maxHeight
      )
    : undefined
  // Odd source sizes are scaled too: 4:2:0 encoders need even dimensions.
  const size =
    source &&
    target &&
    (target.width !== source.width || target.height !== source.height)
      ? target
      : undefined
  const frameRate = options.frameRate ?? getFrameRate(stream) ?? 30
  const videoBitrateKbits =
    options.videoBitrateKbits ??
    defaultVideoBitrateKbits(
      target?.width ?? 1280,
      target?.height ?? 720,
      frameRate,
      codec
    )
  const duration = getMediaDuration(information)

  const available = new Set(await listEncoders())
  const candidates = [
    ...(hardware === 'avoid' ? [] : HARDWARE_ENCODERS[codec]),
    ...(hardware === 'require' ? [] : SOFTWARE_ENCODERS[codec]),
  ].filter((encoder) => available.has(encoder))

  if (candidates.length === 0) {
    throw new MunimFfmpegError(
      'NO_ENCODER',
      `No ${codec} encoder available for hardware: '${hardware}'` +
        (codec === 'hevc' ? ' (HEVC is hardware-only in this build)' : '')
    )
  }

  const attempts: CompressVideoResult['attempts'] = []
  let last: FFmpegSessionResult | undefined

  for (const encoder of candidates) {
    const session = await execute(
      compressArguments({
        input,
        output,
        encoder,
        codec,
        size,
        videoBitrateKbits,
        frameRate: options.frameRate,
        audio: options.audio ?? 'aac',
        audioBitrateKbits: options.audioBitrateKbits ?? 128,
        hardwareDecoding:
          encoder.endsWith('_videotoolbox') &&
          options.hardwareDecoding !== false,
        faststart: options.faststart ?? true,
      }),
      options.onLog,
      options.onProgress
        ? (timeMs, sizeBytes, bitrateKbits, speed, _frame, fps) =>
            options.onProgress?.({
              fraction: progressFraction(timeMs, duration),
              timeMs,
              sizeBytes,
              bitrateKbits,
              speed,
              fps,
            })
        : undefined,
      options.onSessionCreated
    )
    attempts.push({ encoder, returnCode: session.returnCode })
    last = session

    if (session.cancelled) {
      throw new MunimFfmpegError(
        'CANCELLED',
        `Compressing ${input} was cancelled`,
        session
      )
    }
    if (session.success && (await hasVideoFrames(output))) {
      return {
        output,
        encoder,
        hardware: isHardwareEncoder(encoder),
        width: target?.width,
        height: target?.height,
        videoBitrateKbits,
        attempts,
        session,
      }
    }
  }

  throw new MunimFfmpegError(
    'FAILED',
    `Every encoder failed (${attempts
      .map((attempt) => `${attempt.encoder}: ${attempt.returnCode}`)
      .join(', ')}): ${last?.output.trim().split('\n').pop() ?? ''}`,
    last
  )
}

export interface ThumbnailOptions {
  /** Where to grab the frame. Default 0; clamped to the video's length. */
  timeMs?: number
  /** Fit the image inside this box, keeping its aspect ratio. Never upscales. */
  maxWidth?: number
  maxHeight?: number
  /** JPEG quality from 0 (smallest) to 1 (best). Default 0.8. */
  quality?: number
}

export interface Thumbnail {
  /** The output path, as passed in. */
  path: string
  width: number
  height: number
  /** The time the frame was taken from, after clamping. */
  timeMs: number
}

/**
 * Writes one frame of a video to an image, like `expo-video-thumbnails`, but
 * for any format the bundled FFmpeg can read. The image format follows the
 * output's extension: `.jpg`/`.jpeg` or `.png`.
 *
 * Throws {@link MunimFfmpegError} with `NO_VIDEO_STREAM` or `FAILED`.
 */
export async function createThumbnail(
  input: string,
  output: string,
  options: ThumbnailOptions = {}
): Promise<Thumbnail> {
  const information = await getMediaInformation(input)
  const stream = getVideoStream(information)
  const source = stream ? getDisplaySize(stream) : undefined
  if (!stream || !source) {
    throw new MunimFfmpegError(
      'NO_VIDEO_STREAM',
      `${input} has no video stream to take a thumbnail from`
    )
  }

  const duration = getMediaDuration(information)
  let timeMs = Math.max(0, options.timeMs ?? 0)
  // Seeking to the very end yields no frame; stay a little before it.
  if (duration !== undefined) {
    timeMs = Math.min(timeMs, Math.max(0, duration * 1000 - 100))
  }

  const target = fitWithin(
    source.width,
    source.height,
    options.maxWidth,
    options.maxHeight
  )
  const scaled =
    target.width !== source.width || target.height !== source.height

  const session = await execute(
    thumbnailArguments({
      input,
      output,
      timeSeconds: timeMs / 1000,
      size: scaled ? target : undefined,
      jpegQuality: jpegQualityScale(options.quality ?? 0.8),
    })
  )
  if (!session.success) {
    throw new MunimFfmpegError(
      session.cancelled ? 'CANCELLED' : 'FAILED',
      `Could not take a thumbnail from ${input}: ${session.output.trim().split('\n').pop() ?? ''}`,
      session
    )
  }

  return {
    path: output,
    width: scaled ? target.width : source.width,
    height: scaled ? target.height : source.height,
    timeMs,
  }
}

export default MunimFfmpeg
