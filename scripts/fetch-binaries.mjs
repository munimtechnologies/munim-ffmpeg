#!/usr/bin/env node
/*
 * Downloads the prebuilt FFmpeg binaries for this version of munim-ffmpeg.
 *
 * They are not published to npm: the bundle is ~200 MB of static libraries and
 * shared objects, which does not belong in a registry tarball. It ships as a
 * GitHub release asset instead, pinned by the checksum in scripts/binaries.json
 * so a build cannot silently pick up different bytes.
 *
 * Runs from postinstall, and can be re-run by hand:
 *   npx munim-ffmpeg-fetch-binaries
 */
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const REPOSITORY = 'munimtechnologies/munim-ffmpeg'
const MARKERS = [
  'ios/MunimFFmpeg.xcframework',
  'android/src/main/jniLibs/arm64-v8a/libmunimffmpeg9.so',
]

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

async function alreadyInstalled() {
  for (const marker of MARKERS) {
    if (!(await exists(path.join(root, marker)))) return false
  }
  return true
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  await pipeline(response.body, createWriteStream(destination))
}

async function checksum(file) {
  const hash = createHash('sha256')
  hash.update(await readFile(file))
  return hash.digest('hex')
}

async function main() {
  const manifest = require(path.join(root, 'scripts', 'binaries.json'))
  const { version } = require(path.join(root, 'package.json'))

  if (await alreadyInstalled()) {
    console.log(
      `munim-ffmpeg: FFmpeg ${manifest.ffmpeg} binaries already present`
    )
    return
  }

  const url =
    process.env.MUNIM_FFMPEG_BINARIES_URL ??
    `https://github.com/${REPOSITORY}/releases/download/v${version}/${manifest.archive}`

  const cache = path.join(root, '.binaries-cache')
  await mkdir(cache, { recursive: true })
  const archive = path.join(cache, manifest.archive)

  console.log(`munim-ffmpeg: downloading FFmpeg ${manifest.ffmpeg} binaries…`)
  await download(url, archive)

  const actual = await checksum(archive)
  if (actual !== manifest.sha256) {
    await rm(cache, { force: true, recursive: true })
    throw new Error(
      `checksum mismatch for ${manifest.archive}\n  expected ${manifest.sha256}\n  received ${actual}`
    )
  }

  await run('tar', ['xzf', archive, '-C', root])
  await rm(cache, { force: true, recursive: true })

  if (!(await alreadyInstalled())) {
    throw new Error('the archive did not contain the expected binaries')
  }

  console.log(`munim-ffmpeg: FFmpeg ${manifest.ffmpeg} binaries installed`)
}

main().catch((error) => {
  console.error(`
munim-ffmpeg: could not install the native FFmpeg binaries.

  ${error.message}

The package cannot build without them. Options:
  • re-run:            npx munim-ffmpeg-fetch-binaries
  • use a mirror:      MUNIM_FFMPEG_BINARIES_URL=<url> npx munim-ffmpeg-fetch-binaries
  • build them:        see scripts/ffmpeg/README.md
`)
  process.exitCode = 1
})
