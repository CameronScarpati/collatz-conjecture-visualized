/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Workaround for a Vite 8 (rolldown) emit bug. KaTeX's lexer builds its
 * token regex from strings containing lone surrogate escapes (\uD800 to
 * \uDFFF). The bundler decodes them at parse time and then writes raw
 * UTF-8, where lone surrogates are unencodable, so the shipped chunk gets
 * U+FFFD garbage and KaTeX mis-lexes every control sequence. Doubling the
 * backslash keeps the escape textual: the RegExp engine decodes it instead
 * of the JS parser, with identical semantics, and the chunk stays ASCII.
 * Safe to drop once rolldown escapes lone surrogates on output.
 */
function katexSurrogateEscapes(): Plugin {
  return {
    name: 'katex-surrogate-escapes',
    transform(code, id) {
      if (!id.includes('katex')) return null
      const patched = code.replace(/(?<!\\)\\u(d[89a-f][0-9a-f]{2})/gi, '\\\\u$1')
      return patched === code ? null : patched
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [katexSurrogateEscapes(), react()],
  test: {
    // Pure math and theme logic run under node; DOM-dependent suites can
    // opt into jsdom per file if they ever need it.
    environment: 'node',
  },
})
