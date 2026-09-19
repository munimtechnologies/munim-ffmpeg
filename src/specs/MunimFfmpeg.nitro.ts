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

/**
 * Where a session is in its life. `queued` sessions wait for the one running
 * ahead of them (FFmpeg runs one execution at a time); `unknown` means the id
 * was never issued or its record has been dropped.
 */
export type FFmpegSessionState =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown'

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

  /**
   * Pauses an `execute()` session, running or still queued. Input stops being
   * read and the pipeline idles; output files stay open. Returns false if the
   * session is unknown, finished, or a probe (probes cannot be paused).
   */
  pause(sessionId: number): boolean

  /** Resumes a paused session. Returns false if it was not paused. */
  resume(sessionId: number): boolean

  getSessionState(sessionId: number): FFmpegSessionState
}
