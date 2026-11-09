#!/usr/bin/env node
// Weekly UI Regression Sweep — syasyah-samaj billing SPA (Cindy automation)
//
// 1. Scans for `motion.div` usage — framer-motion@11 + @types/react@19 drops
//    className on motion.div. Flags instances and recommends switching to typed
//    MotionDiv alias.
// 2. Checks mobile-first card actions — touch targets must be at least 44px.
//    Flags buttons or interactive elements below that threshold.
//
// Run: node .pi/skills/syasyah-automations/scripts/ui-regression-sweep.mjs

import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

const ROOT = '/Users/aayurtshrestha/Projects/supreme/syasyah-samaj'
const SRC_GLOB = `${ROOT}/apps/billing/src/**/*.{ts,tsx}`

function scanMotionDiv() {
  const files = globSync(SRC_GLOB)
  const hits = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (/<motion\.div\b/.test(l)) {
        hits.push({ file, line: i + 1, text: l.trim() })
      }
    }
  }

  if (hits.length > 0) {
    console.log(`✗ motion.div usage detected (${hits.length}):`)
    console.log('   framer-motion@11 + @types/react@19 drops className on motion.div.')
    console.log('   Switch to typed MotionDiv alias (import { MotionDiv } from "framer-motion").\n')
    for (const h of hits) {
      console.log(`   ${h.file.replace(ROOT + '/', '')}:${h.line}`)
      console.log(`     ${h.text}`)
    }
  }
  return hits
}

function scanTouchTargets() {
  const files = globSync(SRC_GLOB)
  const hits = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]

      const smallHeight = l.match(/h-(?:1[0-9]|[1-9])(?:\/|"|'| |>|\}|\)|\n|$)/)
      if (smallHeight && /button|onClick|onPress|role="button"|type="button"/.test(l)) {
        const size = parseInt(smallHeight[1])
        if (size <= 10) {
          hits.push({
            file, line: i + 1, text: l.trim(),
            issue: `h-${size} = ${size * 4}px touch target (< 44px)`,
          })
        }
      }

      const styleHeight = l.match(/style="[^"]*height:\s*(\d+)px/)
      if (styleHeight && /button|onClick|onPress|role="button"/.test(l)) {
        const h = parseInt(styleHeight[1])
        if (h < 44) {
          hits.push({
            file, line: i + 1, text: l.trim(),
            issue: `height: ${h}px touch target (< 44px)`,
          })
        }
      }

      if (/(onClick|onPress|role="button")/.test(l) && !/(min-h-1[1-9]|min-h-2[0-9]|h-1[1-9]|h-2[0-9]|min-h-\[4[4-9][0-9]px\]|h-\[4[4-9][0-9]px\])/.test(l)) {
        hits.push({
          file, line: i + 1, text: l.trim(),
          issue: 'interactive element without explicit ≥44px touch target',
        })
      }
    }
  }

  const seen = new Set()
  const unique = hits.filter((h) => {
    const key = `${h.file}:${h.line}:${h.issue}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length > 0) {
    console.log(`\n✗ Touch target issues below 44px threshold (${unique.length}):`)
    console.log('   Mobile-first card actions must have touch targets ≥ 44px.\n')
    for (const h of unique.slice(0, 30)) {
      console.log(`   ${h.file.replace(ROOT + '/', '')}:${h.line} — ${h.issue}`)
      console.log(`     ${h.text}`)
    }
    if (unique.length > 30) console.log(`   …and ${unique.length - 30} more`)
  }
  return unique
}

async function main() {
  console.log('═══ Weekly UI Regression Sweep ═══\n')

  const motionHits = scanMotionDiv()
  const touchHits = scanTouchTargets()

  const total = motionHits.length + touchHits.length
  console.log(`\n═══ Total findings: ${total} ═══\n`)

  if (total === 0) {
    console.log('✓ No UI regression issues detected.')
    process.exit(0)
  }

  if (motionHits.length > 0) {
    console.log('🛠 Fix motion.div:')
    console.log('   import { MotionDiv } from "framer-motion"')
    console.log('   Replace <motion.div> with <MotionDiv> for proper className support.')
  }
  if (touchHits.length > 0) {
    console.log('🛠 Fix touch targets:')
    console.log('   Add min-h-11 (44px) or h-11 to all interactive elements.')
    console.log('   Ensure buttons on cards meet the 44px minimum touch target.')
  }

  process.exit(1)
}

main().catch((err) => {
  console.error('✗ UI regression sweep failed:', err.message)
  process.exit(2)
})
