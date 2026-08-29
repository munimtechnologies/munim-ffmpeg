const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const prettierConfig = require('eslint-config-prettier')
const prettierPlugin = require('eslint-plugin-prettier')
const globals = require('globals')

module.exports = tseslint.config(
  {
    ignores: [
      'lib/**',
      'nitrogen/**',
      'node_modules/**',
      'example/ios/**',
      'example/android/**',
      'example/.expo/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs', 'scripts/**'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['example/**/*.ts', 'example/**/*.tsx', 'src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2021 } },
  }
)
