/// <reference types="vitest/config" />
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

const ENGINE_BUILD = 'stockfish-19-lite-single'

/** Copies the Stockfish worker script and its WASM into public/stockfish/, served as-is. */
function stockfishAssets(): Plugin {
  return {
    name: 'stockfish-assets',
    buildStart() {
      const bin = dirname(createRequire(import.meta.url).resolve(`stockfish/bin/${ENGINE_BUILD}.js`))
      mkdirSync('public/stockfish', { recursive: true })
      for (const ext of ['js', 'wasm']) copyFileSync(join(bin, `${ENGINE_BUILD}.${ext}`), `public/stockfish/${ENGINE_BUILD}.${ext}`)
    },
  }
}

// Cross-origin isolation, which the multi-threaded engine builds need (design.md, section 3)
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }

export default defineConfig({
  plugins: [svelte(), svelteTesting(), stockfishAssets()],
  server: { headers: isolation },
  preview: { headers: isolation },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
})
