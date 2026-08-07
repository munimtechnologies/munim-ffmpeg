import { useEffect, useState } from 'react'
import { File, Paths } from 'expo-file-system'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  execute,
  getFFmpegVersion,
  getMediaInformation,
  probe,
} from 'munim-ffmpeg'

// A dependency-free 100 ms PCM WAV fixture used by the physical-device test.
const SMOKE_WAV_BASE64 =
  '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'

function decodeBase64(value: string) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  const input = value.replace(/\s/g, '')

  for (let index = 0; index < input.length; index += 4) {
    const first = alphabet.indexOf(input[index] ?? '')
    const second = alphabet.indexOf(input[index + 1] ?? '')
    const third = alphabet.indexOf(input[index + 2] ?? '')
    const fourth = alphabet.indexOf(input[index + 3] ?? '')

    bytes.push((first << 2) | (second >> 4))
    if (third >= 0) bytes.push(((second & 15) << 4) | (third >> 2))
    if (fourth >= 0) bytes.push(((third & 3) << 6) | fourth)
  }

  return Uint8Array.from(bytes)
}

export default function App() {
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState(
    'Tap “Run Native Smoke Test” to verify FFmpeg, FFprobe, and Nitro callbacks.'
  )

  const runFFmpeg = async () => {
    setRunning(true)
    setOutput('Running native FFmpeg and FFprobe smoke tests…')
    const resultFile = new File(
      Paths.document,
      'munim-ffmpeg-smoke-result.json'
    )
    const writeResult = (value: unknown) => {
      resultFile.create({ overwrite: true })
      resultFile.write(JSON.stringify(value, null, 2))
    }

    try {
      writeResult({ stage: 'starting' })
      const fixtureFile = new File(Paths.cache, 'munim-ffmpeg-smoke.wav')
      fixtureFile.create({ overwrite: true })
      fixtureFile.write(decodeBase64(SMOKE_WAV_BASE64))
      const fixturePath = fixtureFile.uri
      writeResult({ stage: 'fixture-written' })

      const ffmpegLogs: string[] = []
      const ffmpegSessions: number[] = []
      let statisticsCount = 0
      const ffmpegResult = await execute(
        [
          '-hide_banner',
          '-stream_loop',
          '20',
          '-i',
          fixturePath,
          '-t',
          '2',
          '-loglevel',
          'info',
          '-f',
          'null',
          '-',
        ],
        (message) => ffmpegLogs.push(message),
        () => {
          statisticsCount += 1
        },
        (sessionId) => ffmpegSessions.push(sessionId)
      )
      writeResult({ stage: 'ffmpeg-complete', ffmpegResult })

      const probeLogs: string[] = []
      const probeSessions: number[] = []
      const probeResult = await probe(
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_type,sample_rate,channels',
          '-of',
          'json',
          fixturePath,
        ],
        (message) => probeLogs.push(message),
        (sessionId) => probeSessions.push(sessionId)
      )
      writeResult({ stage: 'probe-complete', probeResult })

      const mediaInformation = await getMediaInformation(fixturePath)
      const probeOutput = `${probeResult.output}\n${probeLogs.join('')}`
      const checks = {
        version: getFFmpegVersion().length > 0,
        ffmpeg: ffmpegResult.success && ffmpegResult.returnCode === 0,
        ffmpegLogs: ffmpegLogs.length > 0,
        statisticsCallback: statisticsCount > 0,
        ffmpegSessionCallback: ffmpegSessions.some((id) => id > 0),
        ffprobe: probeResult.success && probeResult.returnCode === 0,
        ffprobeSessionCallback: probeSessions.some((id) => id > 0),
        ffprobeAudio: /"codec_type"\s*:\s*"audio"/.test(probeOutput),
        ffprobeSampleRate: /"sample_rate"\s*:\s*"8000"/.test(probeOutput),
        mediaInformation:
          typeof mediaInformation === 'object' && mediaInformation !== null,
      }
      const passed = Object.values(checks).every(Boolean)

      const resultPayload = {
        passed,
        checks,
        ffmpegResult,
        probeResult,
        mediaInformation,
      }
      console.log('MUNIM_FFMPEG_SMOKE_RESULT', JSON.stringify(resultPayload))
      writeResult(resultPayload)
      setOutput(JSON.stringify(resultPayload, null, 2))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('MUNIM_FFMPEG_SMOKE_ERROR', message)
      writeResult({ error: message })
      setOutput(message)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    void runFFmpeg()
  }, [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>NITRO MODULE</Text>
        </View>
        <Text style={styles.title}>Munim FFmpeg</Text>
        <Text style={styles.subtitle}>
          Type-safe FFmpeg and FFprobe for Expo and React Native.
        </Text>

        <Pressable
          disabled={running}
          onPress={runFFmpeg}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            running && styles.buttonDisabled,
          ]}
        >
          {running ? (
            <ActivityIndicator color="#07110b" />
          ) : (
            <Text style={styles.buttonText}>Run Native Smoke Test</Text>
          )}
        </Pressable>

        <View style={styles.outputCard}>
          <Text selectable style={styles.output}>
            {output}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07110b',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 72,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    borderColor: '#72f59b',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eyebrowText: {
    color: '#72f59b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: '#f2fff5',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: 20,
  },
  subtitle: {
    color: '#a8bdad',
    fontSize: 17,
    lineHeight: 25,
    marginTop: 10,
    maxWidth: 360,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#72f59b',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 32,
    minHeight: 54,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#07110b',
    fontSize: 16,
    fontWeight: '800',
  },
  outputCard: {
    backgroundColor: '#0d1d13',
    borderColor: '#1e3926',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    minHeight: 220,
    padding: 18,
  },
  output: {
    color: '#cce8d2',
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
})
