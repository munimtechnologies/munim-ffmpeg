// A dependency-free 100 ms 8 kHz mono PCM WAV fixture. Keeping it in source keeps
// the device suite self-contained: no network, no bundled binary assets.
export const SMOKE_WAV_BASE64 =
  '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'

export function decodeBase64(value: string) {
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
