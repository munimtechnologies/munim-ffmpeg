import { useCallback, useRef, useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  cancel,
  execute,
  getMediaInformation,
  normalizePath,
  pickEncoder,
  type FFmpegSessionResult,
} from 'munim-ffmpeg'

import { rawVideoFrames, RAW_VIDEO, wavFixture } from './fixture'

/**
 * Interactive counterpart to the device suite: pick a file (or generate one),
 * inspect it, transcode it with whichever hardware encoder the device has,
 * embed or burn in subtitles, write an AVIF still, and cancel mid-run.
 *
 * Each action is a plain FFmpeg argument array — the same command you would
 * type on a desktop — so it doubles as a set of copy-pasteable recipes.
 */

type StreamInfo = {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  sample_rate?: string
  channels?: number
  tags?: { language?: string; title?: string }
}
type MediaInfo = {
  format?: { format_name?: string; duration?: string; size?: string }
  streams?: StreamInfo[]
}

type Output = { name: string; uri: string; bytes: number; note: string }

// Hardware first, software as the fallback; the same list works on both
// platforms because pickEncoder asks the bundled build what it has.
const H264_ENCODERS = ['h264_videotoolbox', 'h264_mediacodec', 'libopenh264']

// MediaCodec wants NV12 frames, everything else takes planar YUV.
function encoderArguments(encoder: string) {
  return [
    '-c:v',
    encoder,
    '-pix_fmt',
    encoder.endsWith('_mediacodec') ? 'nv12' : 'yuv420p',
  ]
}

// Filter-graph strings have their own escaping: a path used inside
// `subtitles=` needs `\` `:` and `'` escaped or FFmpeg stops parsing at them.
function filterPath(uri: string) {
  return normalizePath(uri).replace(/[\\:']/g, (character) => `\\${character}`)
}

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:01,400
Soft subtitles stay toggleable.

2
00:00:01,500 --> 00:00:03,000
Burned-in ones are pixels forever.
`

function workspace() {
  const directory = new Directory(Paths.cache, 'munim-ffmpeg-playground')
  if (!directory.exists) directory.create({ intermediates: true })
  return directory
}

function writeFile(
  directory: Directory,
  name: string,
  contents: string | Uint8Array
) {
  const file = new File(directory, name)
  file.create({ overwrite: true })
  file.write(contents)
  return file
}

function describe(information: MediaInfo) {
  const streams = (information.streams ?? []).map((stream) => {
    if (stream.codec_type === 'video') {
      return `video ${stream.codec_name} ${stream.width}×${stream.height}`
    }
    if (stream.codec_type === 'audio') {
      return `audio ${stream.codec_name} ${stream.sample_rate} Hz ×${stream.channels}`
    }
    const tags = [stream.tags?.language, stream.tags?.title].filter(Boolean)
    return `${stream.codec_type} ${stream.codec_name}${tags.length ? ` (${tags.join(', ')})` : ''}`
  })
  const seconds = Number(information.format?.duration ?? 0)
  return [
    `${information.format?.format_name ?? '?'} · ${seconds.toFixed(2)} s`,
    ...streams,
  ].join('\n')
}

export function Playground() {
  const directory = useRef(workspace()).current
  const [input, setInput] = useState<{ uri: string; name: string }>()
  const [inputInfo, setInputInfo] = useState<string>()
  const [duration, setDuration] = useState(0)
  const [busy, setBusy] = useState<string>()
  const [progress, setProgress] = useState<number>()
  const [statistics, setStatistics] = useState<string>()
  const [log, setLog] = useState<string[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [error, setError] = useState<string>()
  const session = useRef<number | undefined>(undefined)

  const inspect = useCallback(async (uri: string) => {
    const information = (await getMediaInformation(uri)) as MediaInfo
    setInputInfo(describe(information))
    setDuration(Number(information.format?.duration ?? 0))
  }, [])

  /**
   * Runs one FFmpeg command with progress, the log tail, and cancellation
   * wired to the UI. `-progress`-style statistics arrive through the
   * statistics callback; the session ID lands before the first log line so
   * the cancel button always has something to cancel.
   */
  const runCommand = useCallback(
    async (label: string, arguments_: string[], expectedSeconds: number) => {
      setBusy(label)
      setError(undefined)
      setProgress(expectedSeconds > 0 ? 0 : undefined)
      setStatistics(undefined)
      setLog([])
      try {
        const result: FFmpegSessionResult = await execute(
          arguments_,
          (message) =>
            setLog((previous) => [...previous.slice(-11), message.trimEnd()]),
          (timeMs, _size, bitrate, speed, _frame, fps) => {
            if (expectedSeconds > 0) {
              setProgress(Math.min(1, timeMs / 1000 / expectedSeconds))
            }
            setStatistics(
              `${(timeMs / 1000).toFixed(1)} s · ${fps.toFixed(0)} fps · ${speed.toFixed(2)}× · ${bitrate.toFixed(0)} kbit/s`
            )
          },
          (id) => {
            session.current = id
          }
        )
        if (!result.success) {
          throw new Error(
            result.cancelled
              ? 'Cancelled'
              : (result.failStackTrace ??
                  result.output.trim().split('\n').pop() ??
                  `exit ${result.returnCode}`)
          )
        }
        return result
      } finally {
        session.current = undefined
        setBusy(undefined)
        setProgress(undefined)
      }
    },
    []
  )

  const addOutput = useCallback((file: File, note: string) => {
    setOutputs((previous) => [
      { name: file.name, uri: file.uri, bytes: file.size ?? 0, note },
      ...previous.filter((output) => output.name !== file.name),
    ])
  }, [])

  const guard = useCallback(
    (label: string, action: () => Promise<void>) => async () => {
      try {
        await action()
      } catch (thrown) {
        setError(
          `${label}: ${thrown instanceof Error ? thrown.message : String(thrown)}`
        )
      }
    },
    []
  )

  const pickFile = guard('Pick', async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['video/*', 'audio/*'],
      copyToCacheDirectory: true,
    })
    if (picked.canceled || !picked.assets?.[0]) return
    const asset = picked.assets[0]
    // The picker returns a file:// URI; normalizePath() (applied by every API
    // call) turns it into the plain path FFmpeg's file protocol expects.
    setInput({ uri: asset.uri, name: asset.name })
    setOutputs([])
    await inspect(asset.uri)
  })

  const generateSample = guard('Sample', async () => {
    // Fixtures generated in JavaScript: no bundled media, no network.
    const raw = writeFile(directory, 'sample.rgb', rawVideoFrames())
    const wav = writeFile(
      directory,
      'sample.wav',
      wavFixture(RAW_VIDEO.frames / RAW_VIDEO.fps)
    )
    const encoder = await pickEncoder(H264_ENCODERS)
    if (!encoder) throw new Error('no H.264 encoder in this build')
    const sample = new File(directory, 'sample.mp4')
    await runCommand(
      `Generating sample with ${encoder}`,
      [
        '-y',
        '-hide_banner',
        '-f',
        'rawvideo',
        '-pixel_format',
        'rgb24',
        '-video_size',
        `${RAW_VIDEO.width}x${RAW_VIDEO.height}`,
        '-framerate',
        String(RAW_VIDEO.fps),
        '-i',
        raw.uri,
        '-i',
        wav.uri,
        // Hardware encoders reject tiny frames; 320×240 is safe everywhere.
        '-vf',
        'scale=320:240',
        ...encoderArguments(encoder),
        '-c:a',
        'aac',
        '-shortest',
        sample.uri,
      ],
      RAW_VIDEO.frames / RAW_VIDEO.fps
    )
    setInput({ uri: sample.uri, name: 'sample.mp4 (generated)' })
    setOutputs([])
    await inspect(sample.uri)
  })

  const transcode = guard('Transcode', async () => {
    if (!input) return
    const encoder = await pickEncoder(H264_ENCODERS)
    if (!encoder) throw new Error('no H.264 encoder in this build')
    const output = new File(directory, 'transcoded.mp4')
    await runCommand(
      `Transcoding with ${encoder}`,
      [
        '-y',
        '-hide_banner',
        '-i',
        input.uri,
        // Even dimensions keep every encoder happy; 480p is quick on a phone.
        '-vf',
        'scale=-2:480',
        ...encoderArguments(encoder),
        '-b:v',
        '1500k',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        output.uri,
      ],
      duration
    )
    addOutput(output, `H.264 via ${encoder}`)
  })

  const embedSubtitles = guard('Soft subtitles', async () => {
    if (!input) return
    const srt = writeFile(directory, 'captions.srt', SAMPLE_SRT)
    const output = new File(directory, 'soft-subtitles.mkv')
    // Streams are copied, so this is a remux: it finishes in a moment and
    // the video is never re-encoded. MP4 would want `-c:s mov_text` instead.
    await runCommand(
      'Embedding soft subtitles',
      [
        '-y',
        '-hide_banner',
        '-i',
        input.uri,
        '-i',
        srt.uri,
        '-map',
        '0',
        '-map',
        '1:0',
        '-c',
        'copy',
        '-c:s',
        'srt',
        '-metadata:s:s:0',
        'language=eng',
        '-metadata:s:s:0',
        'title=English',
        output.uri,
      ],
      0
    )
    const information = (await getMediaInformation(output.uri)) as MediaInfo
    const subtitles = (information.streams ?? []).filter(
      (s) => s.codec_type === 'subtitle'
    )
    addOutput(output, `${subtitles.length} toggleable subtitle track(s) in MKV`)
  })

  const burnSubtitles = guard('Burn-in', async () => {
    if (!input) return
    const srt = writeFile(directory, 'captions.srt', SAMPLE_SRT)
    const encoder = await pickEncoder(H264_ENCODERS)
    if (!encoder) throw new Error('no H.264 encoder in this build')
    const output = new File(directory, 'burned-in.mp4')
    await runCommand(
      'Burning in subtitles with libass',
      [
        '-y',
        '-hide_banner',
        '-i',
        input.uri,
        '-vf',
        `subtitles=${filterPath(srt.uri)}:force_style='FontSize=28,PrimaryColour=&H0000FFFF,Outline=2'`,
        ...encoderArguments(encoder),
        '-c:a',
        'copy',
        output.uri,
      ],
      duration
    )
    addOutput(output, `libass rendered into pixels via ${encoder}`)
  })

  const avifStill = guard('AVIF', async () => {
    if (!input) return
    const output = new File(directory, 'still.avif')
    await runCommand(
      'Encoding AVIF with libaom',
      [
        '-y',
        '-hide_banner',
        '-ss',
        String(Math.min(0.5, duration / 2)),
        '-i',
        input.uri,
        '-frames:v',
        '1',
        '-vf',
        'scale=-2:360',
        '-c:v',
        'libaom-av1',
        '-still-picture',
        '1',
        '-cpu-used',
        '6',
        '-crf',
        '28',
        '-pix_fmt',
        'yuv420p',
        '-f',
        'avif',
        output.uri,
      ],
      0
    )
    addOutput(output, 'AVIF still (libaom encodes, dav1d decodes)')
  })

  const cancelCurrent = () => {
    if (session.current !== undefined) cancel(session.current)
  }

  const disabled = busy !== undefined
  const needsInput = disabled || !input

  return (
    <View>
      <Text style={styles.sectionTitle}>1 · Input</Text>
      <View style={styles.row}>
        <Button label="Pick a file" onPress={pickFile} disabled={disabled} />
        <Button
          label="Generate sample"
          onPress={generateSample}
          disabled={disabled}
          secondary
        />
      </View>
      {input ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{input.name}</Text>
          <Text selectable style={styles.mono}>
            {inputInfo ?? 'inspecting…'}
          </Text>
        </View>
      ) : (
        <Text style={styles.hint}>
          Pick a video from the device, or generate a short clip from the
          suite's JavaScript fixtures.
        </Text>
      )}

      <Text style={styles.sectionTitle}>2 · Actions</Text>
      <View style={styles.row}>
        <Button
          label="Transcode H.264"
          onPress={transcode}
          disabled={needsInput}
        />
        <Button label="AVIF still" onPress={avifStill} disabled={needsInput} />
      </View>
      <View style={styles.row}>
        <Button
          label="Embed soft subs"
          onPress={embedSubtitles}
          disabled={needsInput}
        />
        <Button
          label="Burn in subs"
          onPress={burnSubtitles}
          disabled={needsInput}
        />
      </View>

      {busy ? (
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <ActivityIndicator color="#72f59b" />
            <Text style={styles.cardTitle}>{busy}</Text>
            <Pressable onPress={cancelCurrent} hitSlop={12}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
          {progress !== undefined ? (
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          {statistics ? <Text style={styles.mono}>{statistics}</Text> : null}
          <Text style={styles.logText} numberOfLines={12}>
            {log.join('\n')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.card, styles.cardFailed]}>
          <Text style={styles.cardTitle}>Failed</Text>
          <Text selectable style={styles.mono}>
            {error}
          </Text>
        </View>
      ) : null}

      {outputs.length ? (
        <Text style={styles.sectionTitle}>3 · Outputs</Text>
      ) : null}
      {outputs.map((output) => (
        <View key={output.name} style={styles.card}>
          <Text style={styles.cardTitle}>{output.name}</Text>
          <Text style={styles.mono}>
            {(output.bytes / 1024).toFixed(1)} KB · {output.note}
          </Text>
          {output.name.endsWith('.avif') ? (
            // React Native decodes AVIF natively on iOS 16+ and Android 12+.
            <Image
              source={{ uri: output.uri }}
              style={styles.preview}
              resizeMode="contain"
            />
          ) : null}
          <Text selectable style={styles.path}>
            {normalizePath(output.uri)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function Button({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  secondary?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[styles.buttonText, secondary && styles.buttonTextSecondary]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const mono = Platform.select({ ios: 'Courier', default: 'monospace' })

const styles = StyleSheet.create({
  sectionTitle: {
    color: '#72f59b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 24,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  button: {
    alignItems: 'center',
    backgroundColor: '#72f59b',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  buttonSecondary: {
    backgroundColor: '#0d1d13',
    borderColor: '#72f59b',
    borderWidth: 1,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#07110b', fontSize: 14, fontWeight: '800' },
  buttonTextSecondary: { color: '#72f59b' },
  hint: { color: '#a8bdad', fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: '#0d1d13',
    borderColor: '#1e3926',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
  },
  cardFailed: { borderColor: '#7a2b2b' },
  cardTitle: { color: '#f2fff5', flex: 1, fontSize: 15, fontWeight: '700' },
  mono: {
    color: '#cce8d2',
    fontFamily: mono,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  path: { color: '#6f8975', fontFamily: mono, fontSize: 10, marginTop: 8 },
  logText: {
    color: '#6f8975',
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
  },
  progressHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  cancel: { color: '#ff8080', fontSize: 14, fontWeight: '800' },
  track: {
    backgroundColor: '#1e3926',
    borderRadius: 4,
    height: 6,
    marginTop: 12,
    overflow: 'hidden',
  },
  bar: { backgroundColor: '#72f59b', height: 6 },
  preview: {
    backgroundColor: '#07110b',
    borderRadius: 8,
    height: 180,
    marginTop: 10,
    width: '100%',
  },
})
