/*
 * Parsers for the capability reports FFmpeg prints (`-encoders`, `-muxers`,
 * `-filters`, `-protocols`). Codecs, formats and filters each print with a
 * different flag column, and protocols use indented sections instead of a
 * table, so each report gets its own parser. Kept free of native imports so
 * they can be unit-tested against captured output.
 */

/** Everything below the line of dashes that ends a report's legend. */
function reportBody(output: string): string {
  return output.split(/^\s*-+\s*$/m).pop() ?? ''
}

function rows(text: string): string[][] {
  return text.split('\n').map((line) => line.trim().split(/\s+/))
}

// `-encoders`/`-decoders` entries are printed as
// `<capability flags> <name> <description>` below a line of dashes.
export function parseCodecs(output: string): string[] {
  return rows(reportBody(output))
    .filter((columns) => columns.length >= 2 && /^[A-Z.]{6}$/.test(columns[0]!))
    .map((columns) => columns[1]!)
}

// `-muxers`/`-demuxers` entries look like ` E  mp4  MP4 (MPEG-4 Part 14)`
// below a `--` separator line.
export function parseFormats(output: string): string[] {
  return rows(reportBody(output))
    .filter(
      (columns) => columns.length >= 2 && /^[DE.]{1,2}$/.test(columns[0]!)
    )
    .flatMap((columns) => columns[1]!.split(','))
}

// `-filters` entries look like ` TS scale  V->V  Scale the input video.`
// The flag column has held two or three characters across FFmpeg releases.
export function parseFilters(output: string): string[] {
  return rows(output)
    .filter(
      (columns) =>
        columns.length >= 3 &&
        /^[TSC.]{2,3}$/.test(columns[0]!) &&
        /->/.test(columns[2]!)
    )
    .map((columns) => columns[1]!)
}

// `-protocols` prints `Input:` and `Output:` sections of indented names.
export function parseProtocols(output: string): string[] {
  const names = new Set<string>()
  let inSection = false
  for (const line of output.split('\n')) {
    if (/^(Input|Output):/.test(line.trim())) {
      inSection = true
      continue
    }
    const name = line.trim()
    if (inSection && /^[a-z0-9_]+$/.test(name)) names.add(name)
  }
  return [...names]
}
