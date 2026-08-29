// Media fixtures generated in JavaScript. Keeping them in code makes the device
// suite self-contained: no network, no bundled binary assets, and no reliance on
// FFmpeg input generators (the Android build has `lavfi` disabled).

export const AUDIO_SAMPLE_RATE = 8000

/**
 * A mono 16-bit PCM WAV containing a short tone sweep.
 *
 * Generated at full length rather than looped by FFmpeg: `-stream_loop -1` on an
 * input never terminates, even with `-t` bounding the output.
 */
export function wavFixture(seconds: number) {
  const sampleRate = AUDIO_SAMPLE_RATE
  const sampleCount = Math.round(sampleRate * seconds)
  const dataBytes = sampleCount * 2
  const bytes = new Uint8Array(44 + dataBytes)
  const view = new DataView(bytes.buffer)

  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      bytes[offset + index] = text.charCodeAt(index)
    }
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const frequency = 220 + 160 * Math.sin(time)
    const amplitude = Math.sin(2 * Math.PI * frequency * time)
    view.setInt16(44 + index * 2, Math.round(amplitude * 0x6000), true)
  }

  return bytes
}

const RAW_WIDTH = 160
const RAW_HEIGHT = 120

export const RAW_VIDEO = {
  width: RAW_WIDTH,
  height: RAW_HEIGHT,
  fps: 15,
  frames: 45,
}

/** Raw rgb24 frames, fed to FFmpeg with `-f rawvideo`. */
export function rawVideoFrames() {
  const frameSize = RAW_WIDTH * RAW_HEIGHT * 3
  const bytes = new Uint8Array(frameSize * RAW_VIDEO.frames)

  for (let frame = 0; frame < RAW_VIDEO.frames; frame += 1) {
    for (let y = 0; y < RAW_HEIGHT; y += 1) {
      for (let x = 0; x < RAW_WIDTH; x += 1) {
        const offset = frame * frameSize + (y * RAW_WIDTH + x) * 3
        bytes[offset] = (x * 2 + frame * 12) & 0xff
        bytes[offset + 1] = (y * 2) & 0xff
        bytes[offset + 2] = (x + y) & 0xff
      }
    }
  }

  return bytes
}
