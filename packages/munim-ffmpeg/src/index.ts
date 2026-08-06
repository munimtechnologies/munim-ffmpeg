import { NitroModules } from 'react-native-nitro-modules'
import type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegStatisticsCallback,
  MunimFfmpeg as MunimFfmpegSpec,
} from './specs/MunimFfmpeg.nitro'

const MunimFfmpeg =
  NitroModules.createHybridObject<MunimFfmpegSpec>('MunimFfmpeg')

export type {
  FFmpegLogCallback,
  FFmpegSessionResult,
  FFmpegStatisticsCallback,
  MunimFfmpegSpec,
}

export function execute(
  arguments_: string[],
  onLog?: FFmpegLogCallback,
  onStatistics?: FFmpegStatisticsCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.execute(arguments_, onLog, onStatistics)
}

export function probe(
  arguments_: string[],
  onLog?: FFmpegLogCallback
): Promise<FFmpegSessionResult> {
  return MunimFfmpeg.probe(arguments_, onLog)
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

export default MunimFfmpeg
