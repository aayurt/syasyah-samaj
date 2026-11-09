#!/usr/bin/env node
// Per-Push i18n Key Audit — syasyah-samaj billing SPA (Cindy automation)
//
// 1. Reads lib/i18n/en.ts and lib/i18n/ne.ts dictionaries.
// 2. Verifies 1:1 key parity (default UI language is 'ne').
// 3. Flags missing translations in either language.
// 4. Scans apps/billing/src for duplicate `import { useT }` lines (crash Vite).
// 5. Scans for `.map()` loops using variable `t` that shadows useT().
//
// Run: node .pi/skills/syasyah-automations/scripts/per-push-i18n-audit.mjs

import { readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmSync, globSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = '/Users/aayurtshrestha/Projects/supreme/syasyah-samaj'
const EN_PATH = `${ROOT}/apps/billing/src/lib/i18n/en.ts`
const NE_PATH = `${ROOT}/apps/billing/src/lib/i18n/ne.ts`
const SRC_GLOB = `${ROOT}/apps/billing/src/**/*.{ts,tsx}`

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

function extractDictText(path) {
  const text = stripComments(readFileSync(path, 'utf8'))
  const m = text.match(/export const (en|ne) = (\{[\s\S]*?)\n?\} as const/)
  if (!m) throw new Error(`Could not parse dictionary object in ${path}`)
  return m[2].trimEnd() + '}'
}

async function loadDict(path) {
  const dir = mkdtempSync(join(tmpdir(), 'i18n-audit-'))
  const tmpPath = join(dir, 'dict.mjs')
  writeFileSync(tmpPath, `export default ${extractDictText(path)}\n`)
  try {
    const m = await import(tmpPath)
    return m.default
  } finally {
    try { unlinkSync(tmpPath) } catch {}
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
}

function collectKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) collectKeys(v, key, out)
    else out.add(key)
  }
  return out
}

async function auditDictionaries() {
  const en = await loadDict(EN_PATH)
  const ne = await loadDict(NE_PATH)

  const enKeys = collectKeys(en)
  const neKeys = collectKeys(ne)

  const missingInNe = [...enKeys].filter((k) => !neKeys.has(k)).sort()
  const missingInEn = [...neKeys].filter((k) => !enKeys.has(k)).sort()

  console.log('═══ i18n Key Audit ═══')
  console.log(`en keys: ${enKeys.size}`)
  console.log(`ne keys: ${neKeys.size}`)

  let issues = 0

  if (missingInNe.length > 0) {
    issues++
    console.log(`\n✗ Missing in ne (${missingInNe.length}):`)
    for (const k of missingInNe) console.log(`   - ${k}`)
  }
  if (missingInEn.length > 0) {
    issues++
    console.log(`\n✗ Missing in en (${missingInEn.length}):`)
    for (const k of missingInEn) console.log(`   - ${k}`)
  }
  if (issues === 0) console.log('\n✓ 1:1 key parity — en and ne are in sync')
  return { missingInNe, missingInEn, issues }
}

function scanDuplicateUseTImports() {
  const files = globSync(SRC_GLOB)
  const dup = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    const useTLines = lines
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter((l) => /import\s*\{\s*useT\s*\}/.test(l.text))
    if (useTLines.length > 1) {
      dup.push({ file, lines: useTLines.map((l) => l.line) })
    }
  }

  if (dup.length > 0) {
    console.log(`\n✗ Duplicate "import { useT }" (${dup.length} file(s)):`)
    for (const d of dup) {
      console.log(`   ${d.file.replace(ROOT + '/', '')}:${d.lines.join(', ')}`)
    }
  }
  return dup
}

function scanMapShadowingT() {
  const files = globSync(SRC_GLOB)
  const hits = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/\.map\s*\(\s*\(?\s*t\b/.test(l)) {
        hits.push({ file, line: i + 1, text: l.trim() })
      }
    }
  }

  if (hits.length > 0) {
    console.log(`\n✗ .map() loops using variable "t" (shadows useT, ${hits.length}):`)
    for (const h of hits) {
      console.log(`   ${h.file.replace(ROOT + '/', '')}:${h.line} — ${h.text}`)
    }
  }
  return hits
}

async function main() {
  const { issues: dictIssues } = await auditDictionaries()
  const dup = scanDuplicateUseTImports()
  const hits = scanMapShadowingT()

  const total = dictIssues + dup.length + hits.length
  console.log(`\n═══ Total findings: ${total} ═══\n`)
  process.exit(total > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('✗ Audit failed:', err.message)
  process.exit(2)
})
