/**
 * Splits a command line into the argument array `execute()` and `probe()`
 * take, so a command can be written the way it is typed in a terminal:
 *
 * ```ts
 * parseArguments(`-i "my clip.mov" -vf "scale=-2:720" out.mp4`)
 * // ['-i', 'my clip.mov', '-vf', 'scale=-2:720', 'out.mp4']
 * ```
 *
 * The rules are a small subset of a POSIX shell, enough for FFmpeg commands:
 *
 * - whitespace (spaces, tabs, newlines) separates arguments;
 * - `'single quotes'` keep everything inside literally;
 * - `"double quotes"` keep everything inside, except that `\"` and `\\`
 *   are unescaped;
 * - outside quotes, a backslash makes the next character literal;
 * - quoted and unquoted parts next to each other join into one argument, and
 *   `""` on its own is an empty argument.
 *
 * Nothing else is interpreted: no variables, globs, or `~`. Filter graphs keep
 * their own escaping, so the quotes FFmpeg itself expects inside a filter
 * (`drawtext=text='Hello'`) must be nested in the other kind of quote.
 *
 * Throws a `SyntaxError` for an unterminated quote or a trailing backslash,
 * rather than guessing what was meant.
 */
export function parseArguments(command: string): string[] {
  const result: string[] = []
  let current = ''
  // An argument can be empty (`""`), so "something was started" is tracked
  // separately from the text collected so far.
  let started = false
  let index = 0

  const push = () => {
    if (started) result.push(current)
    current = ''
    started = false
  }

  while (index < command.length) {
    const character = command[index]!

    if (/\s/.test(character)) {
      push()
      index += 1
      continue
    }

    if (character === "'") {
      const end = command.indexOf("'", index + 1)
      if (end < 0) {
        throw new SyntaxError(
          `Unterminated single quote at position ${index} in: ${command}`
        )
      }
      current += command.slice(index + 1, end)
      started = true
      index = end + 1
      continue
    }

    if (character === '"') {
      index += 1
      started = true
      let closed = false
      while (index < command.length) {
        const inner = command[index]!
        if (inner === '"') {
          closed = true
          index += 1
          break
        }
        if (inner === '\\') {
          const next = command[index + 1]
          if (next === '"' || next === '\\') {
            current += next
            index += 2
            continue
          }
        }
        current += inner
        index += 1
      }
      if (!closed) {
        throw new SyntaxError(`Unterminated double quote in: ${command}`)
      }
      continue
    }

    if (character === '\\') {
      const next = command[index + 1]
      if (next === undefined) {
        throw new SyntaxError(`Trailing backslash in: ${command}`)
      }
      current += next
      started = true
      index += 2
      continue
    }

    current += character
    started = true
    index += 1
  }

  push()
  return result
}

/**
 * The inverse of {@link parseArguments}: quotes each argument only when it
 * needs it, for logging a command or showing it to a user. Feeding the result
 * back through `parseArguments()` gives the same array.
 */
export function formatArguments(arguments_: readonly string[]): string {
  return arguments_
    .map((argument) =>
      argument !== '' && /^[\w@%+=:,./-]+$/.test(argument)
        ? argument
        : `'${argument.replace(/'/g, `'\\''`)}'`
    )
    .join(' ')
}
