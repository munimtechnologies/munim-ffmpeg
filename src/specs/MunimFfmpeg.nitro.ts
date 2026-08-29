import type { HybridObject } from 'react-native-nitro-modules'

export type FFmpegSessionResult = {
  sessionId: number
  returnCode: number
  success: boolean
  cancelled: boolean
  state: string
  durationMs: number
  output: string
  failStackTrace?: string
}

export type FFmpegLogCallback = (message: string) => void

export type FFmpegSessionCreatedCallback = (sessionId: number) => void

export type FFmpegStatisticsCallback = (
  timeMs: number,
  sizeBytes: number,
  bitrateKbits: number,
  speed: number,
  videoFrameNumber: number,
  fps: number,
  quality: number
) => void

export interface MunimFfmpeg extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  readonly ffmpegVersion: string

  execute(
    arguments_: string[],
    onLog?: FFmpegLogCallback,
    onStatistics?: FFmpegStatisticsCallback,
    onSessionCreated?: FFmpegSessionCreatedCallback
  ): Promise<FFmpegSessionResult>

  probe(
    arguments_: string[],
    onLog?: FFmpegLogCallback,
    onSessionCreated?: FFmpegSessionCreatedCallback
  ): Promise<FFmpegSessionResult>

  getMediaInformation(path: string): Promise<string>

  cancel(sessionId?: number): void

  cancelAll(): void
}
