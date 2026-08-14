#!/usr/bin/env node
/**
 * Desktop build script — builds the web app first, then the Tauri bundle.
 *
 *   pnpm build            web + current platform's default bundle(s)
 *   pnpm build --dmg      macOS: also make a .dmg (needs create-dmg)
 *   pnpm build --msi      Windows: also make an .msi (needs WiX)
 *   pnpm build --win      force Windows-style bundles (nsis[,msi])
 *   pnpm build --mac      force macOS-style bundles (app[,dmg])
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
const args = new Set(process.argv.slice(2))
const os = platform()

// --- 1. Build the web app first -------------------------------------------
console.log('▶ Building web app (apps/billing → dist)…')
execSync('pnpm build', { cwd: webDir, stdio: 'inherit' })

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
execSync(`pnpm tauri build --bundles ${bundles}`, {
  cwd: here,
  stdio: 'inherit',
})
console.log('✓ Done.')
