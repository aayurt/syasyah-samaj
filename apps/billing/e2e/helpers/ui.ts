import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Shared UI helpers, written against current VoucherForm/Vouchers markup.
 * Keep selectors stable: prefer role/name and text over CSS.
 */

/** Open the create-voucher form for a docType (route /vouchers/new/:docType). */
export async function openVoucherForm(page: Page, docType: string) {
  await page.goto(`/vouchers/new/${docType}`)
  await expect(page.getByRole('button', { name: 'Save & post' })).toBeVisible({ timeout: 15_000 })
}

/**
 * Set the voucher date through the NepaliDateInput. The input opens in the
 * tenant calendar mode (BS → three selects, AD → <input type=date>). Toggle
 * to AD when needed and fill the native date input.
 */
export async function setVoucherDate(page: Page, isoDate: string) {
  const dateBlock = page.locator('div', { has: page.locator('input[type="date"]') }).first()
  // The mode toggle is the small button inside the date widget labelled AD/BS.
  const adInput = dateBlock.locator('input[type="date"]')
  if (await adInput.count()) {
    await adInput.fill(isoDate)
    return
  }
  // BS mode: click the mode toggle (button text 'BS'/'AD') until a date input appears.
  const toggle = page.getByRole('button', { name: /^(AD|BS)$/ }).first()
  for (let i = 0; i < 2; i++) {
    await toggle.click()
    if (await page.locator('input[type="date"]').count()) break
  }
  await page.locator('input[type="date"]').fill(isoDate)
}

/** Fill the Notes / Remarks textarea if the section exists and is open. */
export async function setNarration(page: Page, narration: string) {
  const notesTitle = page.getByRole('button', { name: /Notes \/ Remarks/ })
  if (await notesTitle.count()) {
    const textarea = page.getByPlaceholder('Enter note or description...')
    if (!(await textarea.isVisible().catch(() => false))) await notesTitle.click()
    await textarea.fill(narration)
  }
}

/** Add N empty rows to the item-lines table via "+ Add Item". */
export async function addItemLines(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Add Item' }).click()
  }
}

/** Fill one item-line row (description, qty, rate) by row index. */
export async function fillItemLine(
  page: Page,
  row: number,
  opts: { description?: string; qty?: number | string; rate?: number | string },
) {
  const rows = page.locator('table tbody tr')
  const r = rows.nth(row)
  if (opts.description) {
    // Non-inventory types render a plain text input in the Name column.
    await r.locator('input[type="text"]').first().fill(opts.description)
  }
  if (opts.qty !== undefined) {
    await r.locator('input[type="number"]').nth(0).fill(String(opts.qty))
  }
  if (opts.rate !== undefined) {
    await r.locator('input[type="number"]').nth(1).fill(String(opts.rate))
  }
}

/**
 * Fill a journal line row (select account + debit or credit). The form always
 * starts with 2 empty journal lines; call addJournalLines first for more.
 */
export async function fillJournalLine(
  page: Page,
  row: number,
  opts: { accountLabel: string; debit?: number; credit?: number; memo?: string },
) {
  const rows = page.locator('table tbody tr')
  const r = rows.nth(row)
  await r.locator('select').selectOption({ label: opts.accountLabel })
  if (opts.debit !== undefined) {
    await r.locator('input[type="number"]').nth(0).fill(String(opts.debit))
  }
  if (opts.credit !== undefined) {
    await r.locator('input[type="number"]').nth(1).fill(String(opts.credit))
  }
  if (opts.memo) {
    await r.locator('input[type="text"]').fill(opts.memo)
  }
}

export async function addJournalLines(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Add line' }).click()
  }
}

/** Submit the form (Save & post = true, Save draft = false) and await navigation. */
export async function submitVoucher(page: Page, post: boolean) {
  await page.getByRole('button', { name: post ? 'Save & post' : 'Save draft' }).click()
  await page.waitForURL('**/vouchers', { timeout: 20_000 })
}

/** Wait until the vouchers list shows a row whose Number cell equals `number`. */
export async function expectVoucherRow(page: Page, number: string) {
  await page.goto('/vouchers')
  await expect(page.getByText(number, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
}

/** Count occurrences of a voucher number in the list (1 = no duplicate). */
export async function voucherRowCount(page: Page, number: string): Promise<number> {
  await page.goto('/vouchers')
  const loc = page.getByText(number, { exact: true })
  // count() does not auto-wait — give the list time to render after the
  // navigation before counting, or a fresh page returns 0 spuriously.
  await loc.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
  return loc.count()
}

export type { Locator }
