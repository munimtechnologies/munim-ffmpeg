import { useState } from 'react'
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
import { execute, getFFmpegVersion } from 'munim-ffmpeg'

export default function App() {
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('Tap “Run FFmpeg” to verify the native module.')

  const runFFmpeg = async () => {
    setRunning(true)
    setOutput('Starting FFmpeg…')

    try {
      const logs: string[] = []
      const result = await execute(['-version'], (message) => {
        logs.push(message)
      })
      setOutput(
        JSON.stringify(
          {
            ffmpegVersion: getFFmpegVersion(),
            ...result,
            logs: logs.join(''),
          },
          null,
          2
        )
      )
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

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
            <Text style={styles.buttonText}>Run FFmpeg</Text>
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
