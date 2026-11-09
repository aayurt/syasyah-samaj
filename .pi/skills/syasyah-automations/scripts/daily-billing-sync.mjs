#!/usr/bin/env node
// Daily Billing Sync Check — syasyah-samaj (Cindy automation)
//
// 1. Reads IndexedDB outbox + cache from the billing SPA (offline-first cache).
// 2. Compares against remote Postgres at 82.165.181.153 (syasha).
// 3. Surfaces sync conflicts or records stuck in cache that haven't propagated.
// 4. Reports: count of unsynced items, conflicts found, recommended resolution.
// 5. Quiet when everything is in sync — only reports when action is needed.
//
// Run: node .pi/skills/syasyah-automations/scripts/daily-billing-sync.mjs [--app-url http://localhost:5173]

import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PROD_DB_URI = 'postgresql://nepse:nepse_dev@82.165.181.153:5432/syasha'
const PROD_HOST = '82.165.181.153'
const PROD_PORT = '5432'
const PROD_USER = 'nepse'
const PROD_PASSWORD = 'nepse_dev'
const PROD_DB = 'syasha'
const APP_URL = process.env.SYASYA_APP_URL || 'http://localhost:5173'

function psql(sql) {
  try {
    const out = execFileSync('psql', [
      '-h', PROD_HOST, '-p', PROD_PORT, '-U', PROD_USER, '-d', PROD_DB,
      '-t', '-A', '-F', '\t', '-c', sql
    ], {
      env: { ...process.env, PGPASSWORD: PROD_PASSWORD },
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    })
    return out.trim()
  } catch (err) {
    return { error: (err.stderr && err.stderr.toString()) || err.message }
  }
}

async function readIndexedDBOutbox(appUrl) {
  const { chromium } = await import('playwright')
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.waitForTimeout(2000)

    const outbox = await page.evaluate(() => {
      return new Promise((resolve) => {
        const req = indexedDB.open('afno-billing-offline', 2)
        req.onerror = () => resolve({ error: 'IndexedDB open failed' })
        req.onblocked = () => resolve({ error: 'IndexedDB blocked' })
        req.onsuccess = async () => {
          const db = req.result
          if (!db.objectStoreNames.contains('outbox')) {
            db.close()
            resolve({ error: 'outbox store missing' })
            return
          }
          const tx = db.transaction('outbox', 'readonly')
          const store = tx.objectStore('outbox')
          const rows = await new Promise((res) => {
            const r = store.getAll()
            r.onsuccess = () => res(r.result)
            r.onerror = () => res([])
          })
          db.close()
          resolve({ outbox: rows })
        }
      })
    })

    const cache = await page.evaluate(() => {
      return new Promise((resolve) => {
        const req = indexedDB.open('afno-billing-offline', 2)
        req.onsuccess = async () => {
          const db = req.result
          const tx = db.transaction('cache', 'readonly')
          const store = tx.objectStore('cache')
          const rows = await new Promise((res) => {
            const r = store.getAll()
            r.onsuccess = () => res(r.result)
            r.onerror = () => res([])
          })
          db.close()
          resolve({ cache: rows })
        }
        req.onerror = () => resolve({ error: 'IndexedDB open failed' })
      })
    })

    return { outbox, cache }
  } finally {
    if (browser) await browser.close()
  }
}

function analyzeSync(outbox, serverDocs, cacheRows) {
  const unsynced = []
  const conflicts = []
  const stuck = []

  for (const entry of outbox) {
    const { op, collection, id, localId, data, conflict, queuedAt } = entry
    const recordId = localId || id
    const key = `${collection}:${recordId}`

    if (conflict) {
      conflicts.push({ key, op, reason: conflict.message, at: conflict.at, queuedAt })
      continue
    }

    const serverMatch = serverDocs.find(
      (d) => d.collection === collection && (d.id == recordId || d.id == localId)
    )
    if (!serverMatch) {
      unsynced.push({ key, op, queuedAt, data })
    }
  }

  for (const row of (cacheRows || [])) {
    const doc = row.json ? JSON.parse(row.json) : row
    if (doc && doc._pendingSync) {
      const inOutbox = outbox.some((e) => e.localId == doc.id || e.id == doc.id)
      if (!inOutbox) {
        stuck.push({ collection: row.collection, id: doc.id, doc })
      }
    }
  }

  return { unsynced, conflicts, stuck }
}

let cacheRows = []

async function main() {
  const appUrl = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1] || APP_URL

  console.log('═══ Daily Billing Sync Check ═══')

  const serverRows = psql(
    "SELECT 'documents' as collection, id::text as id, doc_type, status, created_at FROM documents " +
    "UNION ALL SELECT 'documents_lines', id::text, '', '', '' FROM documents_lines " +
    "UNION ALL SELECT 'documents_journal_lines', id::text, '', '', '' FROM documents_journal_lines"
  )
  if (serverRows.error) {
    console.log(`✗ Cannot reach remote Postgres at ${PROD_HOST}:${PROD_PORT}`)
    console.log(`  ${serverRows.error}`)
    process.exit(1)
  }
  const serverDocs = serverRows
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [collection, id, docType, status, createdAt] = l.split('\t')
      return { collection, id, docType, status, createdAt }
    })

  console.log(`\n📊 Server records (documents): ${serverDocs.filter((d) => d.collection === 'documents').length}`)

  let indexedDB
  try {
    indexedDB = await readIndexedDBOutbox(appUrl)
  } catch (err) {
    console.log(`\n⚠ Cannot read IndexedDB from ${appUrl} — is the billing SPA running?`)
    console.log(`  ${err.message}`)
    console.log('\n🔕 Silent: cannot complete sync check without local cache access.')
    process.exit(0)
  }

  const outbox = indexedDB.outbox?.outbox || []
  cacheRows = indexedDB.cache?.cache || []

  const pendingCount = outbox.filter((e) => !e.conflict).length
  const conflictCount = outbox.filter((e) => e.conflict).length

  if (pendingCount === 0 && conflictCount === 0) {
    console.log('\n✓ All in sync — no unsynced invoices or payments.')
    process.exit(0)
  }

  console.log(`\n📦 Outbox: ${pendingCount} pending, ${conflictCount} conflicted`)

  const { unsynced, conflicts, stuck } = analyzeSync(outbox, serverDocs, cacheRows)

  if (unsynced.length > 0) {
    console.log(`\n✗ Unsynced items: ${unsynced.length}`)
    for (const u of unsynced.slice(0, 20)) {
      console.log(`   - ${u.key} (${u.op}) queued ${u.queuedAt}`)
    }
    if (unsynced.length > 20) console.log(`   …and ${unsynced.length - 20} more`)
  }

  if (conflicts.length > 0) {
    console.log(`\n✗ Conflicts: ${conflicts.length}`)
    for (const c of conflicts.slice(0, 20)) {
      console.log(`   - ${c.key} (${c.op}): ${c.reason} at ${c.at}`)
    }
    if (conflicts.length > 20) console.log(`   …and ${conflicts.length - 20} more`)
  }

  if (stuck.length > 0) {
    console.log(`\n⚠ Stuck in cache (pendingSync, not in outbox): ${stuck.length}`)
    for (const s of stuck.slice(0, 10)) {
      console.log(`   - ${s.collection}:${s.id}`)
    }
  }

  console.log('\n🛠 Recommended resolution:')
  if (pendingCount > 0) {
    console.log('   - Open the billing SPA and click "Sync now" to flush the outbox.')
  }
  if (conflicts.length > 0) {
    console.log('   - Review conflicts in the SyncStatus drawer → "Needs review".')
    console.log('   - Resolve each conflict: Keep Mine / Keep Server / Edit, then retry.')
  }
  if (stuck.length > 0) {
    console.log('   - Stuck cache rows may need a manual cache invalidation (refresh the page).')
  }
  if (pendingCount === 0 && conflictCount === 0 && unsynced.length === 0) {
    console.log('   - No action needed. Everything is synced.')
  }

  const hasIssues = unsynced.length > 0 || conflicts.length > 0 || stuck.length > 0
  process.exit(hasIssues ? 1 : 0)
}

main().catch((err) => {
  console.error('✗ Sync check failed:', err.message)
  process.exit(2)
})
