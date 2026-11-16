import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatArguments, parseArguments } from '../src/arguments.ts'

describe('parseArguments', () => {
  it('splits on any whitespace', () => {
    assert.deepEqual(parseArguments('  -i  in.mp4\t-c:v copy\nout.mp4 '), [
      '-i',
      'in.mp4',
      '-c:v',
      'copy',
      'out.mp4',
    ])
  })

  it('keeps quoted paths together', () => {
    assert.deepEqual(
      parseArguments(`-i "my clip.mov" -vf 'scale=-2:720' "out é.mp4"`),
      ['-i', 'my clip.mov', '-vf', 'scale=-2:720', 'out é.mp4']
    )
  })

  it('nests the quotes FFmpeg filters expect', () => {
    assert.deepEqual(
      parseArguments(`-vf "drawtext=text='Hello world':fontsize=24"`),
      ['-vf', "drawtext=text='Hello world':fontsize=24"]
    )
  })

  it('joins adjacent quoted and unquoted parts', () => {
    assert.deepEqual(parseArguments(`a"b c"'d e'f`), ['ab cd ef'])
  })

  it('keeps empty quoted arguments', () => {
    assert.deepEqual(parseArguments(`-metadata title="" out.mp4`), [
      '-metadata',
      'title=',
      'out.mp4',
    ])
    assert.deepEqual(parseArguments(`-i '' x`), ['-i', '', 'x'])
  })

  it('unescapes backslashes outside single quotes only', () => {
    assert.deepEqual(parseArguments(`a\\ b "c\\"d" 'e\\f'`), [
      'a b',
      'c"d',
      'e\\f',
    ])
  })

  it('returns nothing for a blank command', () => {
    assert.deepEqual(parseArguments('   '), [])
  })

  it('rejects unterminated quotes and trailing backslashes', () => {
    assert.throws(() => parseArguments(`-i "open`), SyntaxError)
    assert.throws(() => parseArguments(`-i 'open`), SyntaxError)
    assert.throws(() => parseArguments('out.mp4 \\'), SyntaxError)
  })
})

describe('formatArguments', () => {
  it('quotes only arguments that need it', () => {
    assert.equal(
      formatArguments(['-i', 'my clip.mov', '-c:v', 'copy', '', "it's"]),
      `-i 'my clip.mov' -c:v copy '' 'it'\\''s'`
    )
  })

  it('round-trips through parseArguments', () => {
    const original = [
      '-y',
      '-i',
      '/path/with spaces/é 漢字.mp4',
      '-vf',
      "subtitles=a\\:b.srt:force_style='FontSize=28'",
      '',
      'out "quoted".mp4',
    ]
    assert.deepEqual(parseArguments(formatArguments(original)), original)
  })
})
