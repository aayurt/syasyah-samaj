import { expect, test } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Api } from '../helpers/api'
import { dataset } from '../helpers/dataset'
import {
  fillJournalLine,
  openVoucherForm,
  setNarration,
  setVoucherDate,
  submitVoucher,
} from '../helpers/ui'

/**
 * 09 — The browser SPA running against the SQLite backend.
 *
 * The app picks its local storage via pickAdapter(): IndexedDB on the plain
 * web, SqliteAdapter inside Tauri. This project forces the SQLite path in a
 * plain browser: an init script sets window.__SYNC_STORAGE__='sqlite' and
 * points at the sql.js UMD loader (served by the Vite dev server over /@fs),
 * so SqliteAdapter's driverFactory builds a real WASM sql.js database.
 *
 * The sql.js database is in-memory, so this spec deliberately avoids full
 * reloads after data is written — the whole offline → reconnect → flush arc
 * happens in one page session (client-side navigation only).
 */
const here = dirname(fileURLToPath(import.meta.url))
const SQLJS_LOADER = join(here, '../../node_modules/sql.js/dist/sql-wasm.js')
const WEB = `http://localhost:${process.env.E2E_WEB_PORT || 5174}`

test.describe.serial('09 — SPA forced onto the SQLite backend', () => {
  test('offline queue and reconnect flush work end-to-end on sql.js', async ({ page, request }) => {
    // Force the sqlite backend before any app module runs.
    const sqlJsUrl = `${WEB}/@fs${SQLJS_LOADER}`
    await page.addInitScript((url) => {
      const w = window as Window & { __SYNC_STORAGE__?: string; __SYNC_SQLITE_JS__?: string }
      w.__SYNC_STORAGE__ = 'sqlite'
      w.__SYNC_SQLITE_JS__ = url
    }, sqlJsUrl)

    const api = new Api(request)
    const narration = `E2E sqlite spa ${Date.now()}`
    const jv = dataset.vouchers.find((v) => v.docType === 'journal-voucher')!
    const account = (name: string) => dataset.accounts.accounts.find((a) => a.name === name)!
    const cash = account('Cash in Hand')
    const capital = account('Capital')

    // 1. Online: load the journal form so the account list populates the
    //    sql.js cache (cache-first reads land in SQLite, not IndexedDB).
    await openVoucherForm(page, 'journal-voucher')
    await expect
      .poll(() => page.locator('table tbody tr').first().locator('select option').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(5)

    // 2. Baseline: the journey ran through 03-masters only — no vouchers yet
    //    (the list renders an empty-state row, not a data row).
    await page.goto('/vouchers')
    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible()
    await expect(page.getByText('No vouchers yet.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/^JV-2083-84-/)).toHaveCount(0)

    // 3. Offline: Save & post a balanced journal — both ops queue to the
    //    sqlite outbox and the optimistic row replaces the empty state.
    await page.goto('/vouchers/new/journal-voucher')
    await expect(page.getByRole('button', { name: 'Save & post' })).toBeVisible({ timeout: 20_000 })
    // Wait for the account list to finish loading into the fresh (reloaded)
    // sql.js cache before dropping offline — the fetch must complete online.
    await expect
      .poll(() => page.locator('table tbody tr').first().locator('select option').count(), {
        timeout: 20_000,
      })
      .toBeGreaterThan(5)
    await page.context().setOffline(true)
    await setVoucherDate(page, jv.date)
    await fillJournalLine(page, 0, { accountLabel: `${cash.code} · ${cash.name}`, debit: 4444 })
    await fillJournalLine(page, 1, { accountLabel: `${capital.code} · ${capital.name}`, credit: 4444 })
    await setNarration(page, narration)
    await submitVoucher(page, true)
    // The optimistic draft row shows a Draft pill; the empty-state row is gone.
    await expect(page.getByText('No vouchers yet.')).toBeHidden({ timeout: 15_000 })
    const draftPill = page.getByRole('table').getByText('Draft', { exact: true })
    await expect(draftPill).toBeVisible({ timeout: 15_000 })

    // 4. Reconnect: the flush maps the local id, posts, and the server
    //    assigns the fiscal-year number. The /vouchers page refreshes itself
    //    (cacheVersion) — no reload, which would reset the in-memory sqlite.
    await page.context().setOffline(false)
    await expect
      .poll(
        async () => {
          const d = await api.findOne('documents', 'narration', narration)
          return !!(d && d.status === 'posted')
        },
        { timeout: 60_000 },
      )
      .toBe(true)
    const posted = await api.findOne('documents', 'narration', narration)
    expect(posted, 'flush should post the offline journal').toBeTruthy()
    const number = String(posted!.number)
    expect(number).toMatch(/^JV-2083-84-\d{4}$/)

    await expect(page.getByText(number, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    // Exactly one row — the empty state is gone and nothing was duplicated.
    await expect(page.getByText('No vouchers yet.')).toBeHidden({ timeout: 10_000 })
    await expect(page.getByText(number, { exact: true })).toHaveCount(1)
  })

  test('cold start: a queued offline write survives a reload via the persisted sql.js db', async ({ page, request }) => {
    // Force the sqlite backend before any app module runs.
    const sqlJsUrl = `${WEB}/@fs${SQLJS_LOADER}`
    await page.addInitScript((url) => {
      const w = window as Window & { __SYNC_STORAGE__?: string; __SYNC_SQLITE_JS__?: string }
      w.__SYNC_STORAGE__ = 'sqlite'
      w.__SYNC_SQLITE_JS__ = url
    }, sqlJsUrl)

    const api = new Api(request)
    const narration = `E2E sqlite cold start ${Date.now()}`
    const jv = dataset.vouchers.find((v) => v.docType === 'journal-voucher')!
    const account = (name: string) => dataset.accounts.accounts.find((a) => a.name === name)!
    const cash = account('Cash in Hand')
    const capital = account('Capital')

    // 1. Online: load the journal form and let the account list populate the
    //    sql.js cache before the API is cut.
    await openVoucherForm(page, 'journal-voucher')
    await expect
      .poll(() => page.locator('table tbody tr').first().locator('select option').count(), {
        timeout: 20_000,
      })
      .toBeGreaterThan(5)

    // 2. Simulate the server being unreachable (assets still served): abort
    //    every /api request so nothing can flush, then Save & post — both ops
    //    queue to the sqlite outbox and the optimistic row appears locally.
    await page.route('**/api/**', (route) => route.abort())
    await setVoucherDate(page, jv.date)
    await fillJournalLine(page, 0, { accountLabel: `${cash.code} · ${cash.name}`, debit: 5555 })
    await fillJournalLine(page, 1, { accountLabel: `${capital.code} · ${capital.name}`, credit: 5555 })
    await setNarration(page, narration)
    await submitVoucher(page, true)
    const draftPill = page.getByRole('table').getByText('Draft', { exact: true })
    await expect(draftPill).toBeVisible({ timeout: 15_000 })

    // 3. Cold start: reload while the API is still unreachable. The engine
    //    boots a fresh sql.js database re-imported from localStorage — the
    //    queued op must survive (nothing could have flushed in step 2).
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible({ timeout: 20_000 })

    // 4. Connectivity returns; reload once more so init() re-queues the
    //    persisted op and flushes it automatically — no manual resync.
    await page.unroute('**/api/**')
    await page.reload()
    await expect
      .poll(
        async () => {
          const d = await api.findOne('documents', 'narration', narration)
          return !!(d && d.status === 'posted')
        },
        { timeout: 60_000 },
      )
      .toBe(true)
    const posted = await api.findOne('documents', 'narration', narration)
    expect(posted, 'cold-start flush should post the offline journal').toBeTruthy()
    const number = String(posted!.number)
    expect(number).toMatch(/^JV-2083-84-\d{4}$/)

    // The reloaded list refreshes itself after the flush (cacheVersion) and
    // shows exactly one numbered row.
    await expect(page.getByText(number, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(number, { exact: true })).toHaveCount(1)
  })
})
