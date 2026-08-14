#!/usr/bin/env node
/**
 * Desktop build script — builds the web app first, then the Tauri bundle.
 *
 *   pnpm build                     web + current platform's default bundle(s)
 *   pnpm build --dmg               macOS: also make a .dmg (needs create-dmg)
 *   pnpm build --msi               Windows: also make an .msi (needs WiX)
 *   pnpm build --win               force Windows-style bundles (nsis[,msi])
 *   pnpm build --mac               force macOS-style bundles (app[,dmg])
 *   pnpm build --remote <url>      window loads a HOSTED web build (Path A):
 *                                  e.g. https://syasyahsamaj.com/app/
 *                                  — UI updates ship via web deploy, no
 *                                  desktop rebuild needed; offline shell is
 *                                  served by the app's service worker.
 *
 * Tauri cannot cross-compile bundles: macOS bundles must be built on macOS,
 * Windows bundles on Windows (use a CI matrix for both). The script detects
 * the current OS and picks sensible defaults:
 *   macOS  → .app (DMG is opt-in via --dmg; it needs create-dmg installed)
 *   Windows → .nsis (MSI is opt-in via --msi; it needs WiX)
 *   Linux  → .appimage, .deb
 */
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webDir = resolve(here, '../billing')
const argv = process.argv.slice(2)
const args = new Set(argv)
const os = platform()

const remoteIdx = argv.indexOf('--remote')
const remoteUrl = remoteIdx >= 0 ? argv[remoteIdx + 1] : null

// --- 1. Build the web app first -------------------------------------------
// Absolute base `/` — the desktop bundles the dist and loads it at the
// protocol root (tauri://localhost or file://). The hosted deploy keeps the
// default `/app/` base (deploy.sh builds it without this env).
console.log('▶ Building web app (apps/billing → dist, base /)…')
execSync('pnpm build', {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: '/' },
})

// --- 2. Pick the bundles for this OS --------------------------------------
let bundles
if (args.has('--win') || os === 'win32') {
  bundles = 'nsis' + (args.has('--msi') ? ',msi' : '')
} else if (args.has('--mac') || os === 'darwin') {
  bundles = 'app' + (args.has('--dmg') ? ',dmg' : '')
} else {
  bundles = 'appimage,deb'
}

console.log(`▶ Packaging desktop app for ${os} (bundles: ${bundles})…`)

// --- 3. Patch the window URL for Path A (hosted web build) -----------------
// Point the app window at the deployed SPA. The Rust shell stays bundled;
// the UI comes from the hosted build and updates on web deploys.
let patched = false
const confPath = resolve(here, 'src-tauri/tauri.conf.json')
const origConf = await import('node:fs/promises').then(({ readFile }) =>
  readFile(confPath, 'utf8'),
)
let conf = JSON.parse(origConf)

if (remoteUrl) {
  console.log(`▶ Window → hosted web build: ${remoteUrl}`)
  if (!conf.app) conf.app = {}
  conf.app.windows = conf.app.windows ?? []
  if (conf.app.windows.length === 0) conf.app.windows.push({})
  conf.app.windows[0].url = remoteUrl
  patched = true
}

if (patched) {
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(confPath, JSON.stringify(conf, null, 2) + '\n'),
  )
}

try {
  execSync(`pnpm tauri build --bundles ${bundles}`, {
    cwd: here,
    stdio: 'inherit',
  })
} finally {
  // Always restore the original config so a plain `pnpm build` goes back to
  // bundling the local dist.
  if (patched) {
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(confPath, origConf),
    )
  }
}
console.log('✓ Done.')
