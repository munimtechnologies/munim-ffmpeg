import { useCallback, useEffect, useState } from 'react'
import { File, Paths } from 'expo-file-system'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Playground } from './Playground'
import { runSuite, type CheckResult } from './suite'

type Tab = 'playground' | 'suite'

export default function App() {
  const [tab, setTab] = useState<Tab>('playground')
  const [running, setRunning] = useState(false)
  const [version, setVersion] = useState<string>()
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [error, setError] = useState<string>()

  const runFFmpeg = useCallback(async () => {
    setRunning(true)
    setChecks([])
    setError(undefined)

    try {
      const result = await runSuite((check) =>
        setChecks((previous) => [...previous, check])
      )
      setVersion(result.ffmpegVersion)
      setChecks(result.checks)

      // Written to disk and logged so the suite can be read back from a
      // connected machine without touching the screen.
      const resultFile = new File(Paths.document, 'munim-ffmpeg-suite.json')
      resultFile.create({ overwrite: true })
      resultFile.write(JSON.stringify(result, null, 2))
      console.log('MUNIM_FFMPEG_SUITE_RESULT', JSON.stringify(result))
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : String(thrown)
      console.error('MUNIM_FFMPEG_SUITE_ERROR', message)
      setError(message)
    } finally {
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    void runFFmpeg()
  }, [runFFmpeg])

  const passed = checks.filter((check) => check.passed).length
  const failed = checks.length - passed

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.eyebrow}>
          <Text style={styles.eyebrowText}>EXPO SDK 57 · NITRO MODULE</Text>
        </View>
        <Text style={styles.title}>Munim FFmpeg</Text>
        <Text style={styles.subtitle}>
          Type-safe FFmpeg and FFprobe for Expo and React Native.
        </Text>

        <View style={styles.tabs}>
          {(
            [
              ['playground', 'Playground'],
              [
                'suite',
                `Device suite${checks.length ? ` · ${passed}/${checks.length}` : ''}`,
              ],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'playground' ? (
          <>
            {running ? (
              <Text style={styles.summaryText}>
                Device suite is running in the background; FFmpeg runs one
                command at a time, so actions queue behind it.
              </Text>
            ) : null}
            <Playground />
          </>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                {running
                  ? `Running on ${Platform.OS}…`
                  : `${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`}
              </Text>
              {version ? (
                <Text style={styles.summaryVersion} selectable>
                  {version}
                </Text>
              ) : null}
            </View>

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
                <Text style={styles.buttonText}>Run Device Suite</Text>
              )}
            </Pressable>

            {error ? (
              <View style={[styles.card, styles.cardFailed]}>
                <Text style={styles.checkName}>Suite failed to run</Text>
                <Text selectable style={styles.checkDetail}>
                  {error}
                </Text>
              </View>
            ) : null}

            {checks.map((check) => (
              <View
                key={check.name}
                style={[styles.card, check.passed ? null : styles.cardFailed]}
              >
                <View style={styles.checkHeader}>
                  <Text
                    style={[
                      styles.checkStatus,
                      check.passed ? styles.checkPassed : styles.checkFailed,
                    ]}
                  >
                    {check.passed ? '✓' : '✗'}
                  </Text>
                  <Text style={styles.checkName}>{check.name}</Text>
                  <Text style={styles.checkDuration}>
                    {check.durationMs} ms
                  </Text>
                </View>
                <Text selectable style={styles.checkDetail}>
                  {check.detail}
                </Text>
              </View>
            ))}
          </>
        )}
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
  tabs: {
    backgroundColor: '#0d1d13',
    borderColor: '#1e3926',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 24,
    padding: 4,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: '#1e3926',
  },
  tabText: {
    color: '#a8bdad',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#72f59b',
  },
  summary: {
    marginTop: 20,
  },
  summaryText: {
    color: '#72f59b',
    fontSize: 15,
    fontWeight: '700',
  },
  summaryVersion: {
    color: '#6f8975',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#72f59b',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 20,
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
  card: {
    backgroundColor: '#0d1d13',
    borderColor: '#1e3926',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  cardFailed: {
    borderColor: '#7a2b2b',
  },
  checkHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  checkStatus: {
    fontSize: 15,
    fontWeight: '800',
  },
  checkPassed: {
    color: '#72f59b',
  },
  checkFailed: {
    color: '#ff8080',
  },
  checkName: {
    color: '#f2fff5',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  checkDuration: {
    color: '#6f8975',
    fontSize: 12,
  },
  checkDetail: {
    color: '#cce8d2',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
})
