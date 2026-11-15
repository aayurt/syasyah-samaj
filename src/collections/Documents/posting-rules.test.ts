/**
 * Regression tests for the document posting rules.
 *
 * The bug this pins
 * -----------------
 * `buildPostingLines()` (src/collections/Documents/index.ts) resolved the AR
 * and AP control accounts unconditionally, before the switch on the document
 * type. That meant every document type demanded both accounts — including
 * `contra` (a cash <-> bank transfer) and `journal-voucher`, which post no
 * receivable or payable leg at all.
 *
 * The result: a contra voucher could never be posted unless the organisation
 * had configured Accounts Receivable and Accounts Payable in Billing Settings
 * -> Default accounts, even though a contra needs neither. The error the user
 * saw was:
 *
 *   Posting a "contra" requires a "Accounts Receivable" account.
 *   Set it in Billing Settings -> Default accounts.
 *
 * The fix resolves each account lazily, so only the document types that
 * actually post an AR/AP leg demand it.
 *
 * These tests read the source rather than the DOM: the posting rules live in
 * a private function, so the source is the contract that can be asserted.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const DOCS_INDEX = path.resolve(
  __dirname,
  '..',
  'Documents',
  'index.ts',
)
const source = readFileSync(DOCS_INDEX, 'utf8')

/** The document types that post an AR (receivable) leg. */
const AR_TYPES = [
  'sales-invoice',
  'receipt-voucher',
  'credit-note',
]

/** The document types that post an AP (payable) leg. */
const AP_TYPES = [
  'purchase-invoice',
  'payment-voucher',
  'credit-note',
  'debit-note',
]

/**
 * The document types that post neither an AR nor an AP leg. These must be
 * postable without Accounts Receivable / Accounts Payable configured.
 */
const NEITHER_TYPES = [
  'membership-receipt',
  'donation-receipt',
  'petty-cash-voucher',
  'grn',
  'delivery-challan',
  'journal-voucher',
  'contra',
]

describe('Documents posting rules — AR/AP account resolution', () => {
  it('resolves the AR account lazily instead of up front', () => {
    // The account must be produced by a function that is awaited at the use
    // site, not by an eager `await resolveControlAccount(...)` at the top.
    expect(source).toContain('const arAccount = (): Promise<number> =>')
    expect(source).toContain('const apAccount = (): Promise<number> =>')
  })

  it('does not eagerly resolve the control accounts before the type switch', () => {
    // The old form was:
    //   const arAccount = await resolveControlAccount(payload, doc, 'receivableAccount', ...)
    // A regression here would reintroduce the bug for every doc type.
    const eagerAr = /const arAccount\s*=\s*await resolveControlAccount/.test(source)
    const eagerAp = /const apAccount\s*=\s*await resolveControlAccount/.test(source)
    expect(eagerAr).toBe(false)
    expect(eagerAp).toBe(false)
  })

  it('awaits the AR account at every AR use site', () => {
    const uses = source.match(/account:\s*arAccount[,}]/g) ?? []
    expect(uses.length).toBe(0)
    const awaited = source.match(/account:\s*await arAccount\(\)[,}]/g) ?? []
    expect(awaited.length).toBeGreaterThan(0)
  })

  it('awaits the AP account at every AP use site', () => {
    const uses = source.match(/account:\s*apAccount[,}]/g) ?? []
    expect(uses.length).toBe(0)
    const awaited = source.match(/account:\s*await apAccount\(\)[,}]/g) ?? []
    expect(awaited.length).toBeGreaterThan(0)
  })

  it('has a posting rule for every document type that does not need AR or AP', () => {
    // Each of these must appear as a `case` in the posting switch.
    for (const type of NEITHER_TYPES) {
      expect(source).toContain(`case '${type}':`)
    }
  })

  it('never resolves an AR account inside a case that does not post one', () => {
    // Split the switch into cases and check the AR/AP calls per case.
    const cases = source.split(/case '/).slice(1)
    for (const chunk of cases) {
      const type = chunk.slice(0, chunk.indexOf("':"))
      const body = chunk.slice(0, chunk.indexOf('break'))
      const usesAr = body.includes('arAccount()')
      const usesAp = body.includes('apAccount()')
      if (AR_TYPES.includes(type)) {
        expect(usesAr).toBe(true)
      }
      if (AP_TYPES.includes(type)) {
        expect(usesAp).toBe(true)
      }
      if (!AR_TYPES.includes(type) && !AP_TYPES.includes(type)) {
        // The account must not even be *requested* for these types.
        expect(usesAr).toBe(false)
        expect(usesAp).toBe(false)
      }
    }
  })
})
