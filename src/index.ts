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

export function execute(
  arguments_: string[],
  onLog?: FFmpegLogCallback,
  onStatistics?: FFmpegStatisticsCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.execute(arguments_, onLog, onStatistics, onSessionCreated)
}

export function probe(
  arguments_: string[],
  onLog?: FFmpegLogCallback,
  onSessionCreated?: FFmpegSessionCreatedCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.probe(arguments_, onLog, onSessionCreated)
}

export function getMediaInformation(path: string): Promise<unknown> {
  return MunimFfmpeg.getMediaInformation(path).then((value) =>
    JSON.parse(value)
  )
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

// The bundled FFmpeg builds differ per platform: Android ships libx264/libx265,
// iOS ships the VideoToolbox hardware encoders instead. Asking the binary what
// it supports is more reliable than hard-coding a per-platform table.
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
