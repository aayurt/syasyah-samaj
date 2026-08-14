import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')

/**
 * Build id: git short sha + build timestamp. Used for:
 *   - `__APP_VERSION__` define → the running app knows its own build
 *   - `version.json` on the server → clients compare and prompt to reload
 *   - the service-worker cache name → a new build invalidates the old shell
 */
function buildVersion(): string {
  let sha = 'dev'
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim()
  } catch {
    // not a git checkout — fall back to timestamp only
  }
  return `${sha}-${Date.now().toString(36)}`
}

const VERSION = buildVersion()

function versionPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'syasya-version',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir ?? 'dist'
    },
    closeBundle() {
      // version.json — the server-side source of truth clients poll.
      writeFileSync(
        join(outDir, 'version.json'),
        JSON.stringify({ version: VERSION, builtAt: new Date().toISOString() }, null, 2),
      )

      // sw.js — generated (not copied from public/) so each build's bytes
      // differ, which is what makes the browser notice the SW update.
      const template = join(here, 'sw.template.js')
      if (existsSync(template)) {
        mkdirSync(outDir, { recursive: true })
        writeFileSync(
          join(outDir, 'sw.js'),
          readFileSync(template, 'utf8').replaceAll('__VERSION__', VERSION),
        )
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  // Dev server stays at the root. Production builds use an absolute base so
  // asset URLs resolve regardless of the page path:
  //   - hosted under Payload → /app/ (set via VITE_BASE_PATH or the default)
  //   - bundled into Tauri   → /   (build.mjs sets VITE_BASE_PATH=/)
  base: command === 'serve' ? '/' : process.env.VITE_BASE_PATH || '/app/',
  plugins: [react(), tailwindcss(), versionPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
  },
  server: {
    port: 5173,
  },
}))
