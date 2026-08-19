/* End-to-end verification for the Tally voucher + tax engine.
 * Boots Payload, creates draft documents via the local API, and posts them
 * through the real postDocument engine, then checks each journal entry
 * balances and the voucher numbers/prefixes are correct.
 *
 * Run: npx tsx --env-file=.env scripts/verify-tally.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { postDocument } from '../src/collections/Documents'

async function main() {
  const payload = await getPayload({ config })

  const C00 = await payload.find({ collection: 'tenants', where: { code: { equals: 'C00' } }, limit: 1, depth: 0 })
  const tenant = C00.docs[0].id

  const gl = await payload.find({ collection: 'gl-accounts', limit: 1000, depth: 0 })
  const byName = (name) => gl.docs.find((a) => a.name === name)
  const cash = byName('Cash in Hand')
  const bank = byName('Bank Account')
  const vat = byName('VAT (Input / Output)')

  // Wire the VAT tax type to its ledger and create a TDS type with accounts.
  const vatType = await payload.find({ collection: 'tax-types', where: { code: { equals: 'VAT' } }, limit: 1, depth: 0 })
  if (vatType.docs[0]) {
    await payload.update({ collection: 'tax-types', id: vatType.docs[0].id, overrideAccess: true, data: { salesAccount: vat.id, purchaseAccount: vat.id } })
  }
  let tdsPayable = byName('TDS Payable')
  let tdsReceivable = byName('TDS Receivable')
  if (!tdsPayable) {
    tdsPayable = await payload.create({ collection: 'gl-accounts', overrideAccess: true, data: { name: 'TDS Payable', code: '2310', group: 3, type: 'liability', class: 'other', tenant } })
  }
  if (!tdsReceivable) {
    tdsReceivable = await payload.create({ collection: 'gl-accounts', overrideAccess: true, data: { name: 'TDS Receivable', code: '1110', group: 1, type: 'asset', class: 'other', tenant } })
  }
  let tdsType = await payload.find({ collection: 'tax-types', where: { code: { equals: 'TDS' } }, limit: 1, depth: 0 })
  if (!tdsType.docs[0]) {
    await payload.create({ collection: 'tax-types', overrideAccess: true, data: { code: 'TDS', name: 'TDS', nature: 'withholding', rate: 2, salesAccount: tdsReceivable.id, purchaseAccount: tdsPayable.id, tenant } })
    tdsType = await payload.find({ collection: 'tax-types', where: { code: { equals: 'TDS' } }, limit: 1, depth: 0 })
  }
  const tdsTypeId = tdsType.docs[0].id
  const vatTypeId = vatType.docs[0].id

  const bal = (lines) => {
    let dr = 0, cr = 0
    for (const l of lines) { dr += Number(l.debit) || 0; cr += Number(l.credit) || 0 }
    return { dr: Math.round(dr * 100) / 100, cr: Math.round(cr * 100) / 100 }
  }
  const check = (label, e, p, expectPrefix) => {
    const { dr, cr } = bal(e.lines)
    const okBal = Math.abs(dr - cr) < 0.01
    const okNum = !expectPrefix || (p.number && p.number.startsWith(expectPrefix))
    const ok = okBal && okNum
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: Dr ${dr} / Cr ${cr}${okNum ? '' : '  NUMBER WRONG'}  [${p.number || p.id}]`)
    return ok
  }

  let allOk = true

  // 1. Contra voucher: Cash -> Bank 5000
  const contra = await payload.create({
    collection: 'documents', overrideAccess: true,
    data: { docType: 'contra', date: '2026-08-18', status: 'draft', fromAccount: cash.id, toAccount: bank.id, grossTotal: 5000, netTotal: 5000, taxTotal: 0, taxRate: 0, tenant },
  })
  const p1 = await postDocument(payload, contra.id)
  const e1 = await payload.findByID({ collection: 'journal-entries', id: p1.journalEntry, depth: 0 })
  allOk = check('Contra 5000 Cash->Bank', e1, p1, 'CT') && allOk

  // 2. Sales invoice: 1000 + 13% VAT (additive) => gross 1130
  const sales = await payload.create({
    collection: 'documents', overrideAccess: true,
    data: {
      docType: 'sales-invoice', date: '2026-08-18', status: 'draft', tenant,
      lines: [{ description: 'Services', amount: 1000 }],
      taxLines: [{ taxType: vatTypeId, nature: 'additive', rate: 13 }],
    },
  })
  const p2 = await postDocument(payload, sales.id)
  const e2 = await payload.findByID({ collection: 'journal-entries', id: p2.journalEntry, depth: 0 })
  allOk = check('Sales invoice +13% VAT', e2, p2, 'SI') && allOk
  console.log(`   net=${p2.doc.netTotal} gross=${p2.doc.grossTotal}`)

  // 3. Purchase invoice: 1000 + 13% VAT + 2% TDS => AP 1110, TDS payable 20
  const purch = await payload.create({
    collection: 'documents', overrideAccess: true,
    data: {
      docType: 'purchase-invoice', date: '2026-08-18', status: 'draft', tenant,
      lines: [{ description: 'Goods', amount: 1000 }],
      taxLines: [
        { taxType: vatTypeId, nature: 'additive', rate: 13 },
        { taxType: tdsTypeId, nature: 'withholding', rate: 2 },
      ],
    },
  })
  const p3 = await postDocument(payload, purch.id)
  const e3 = await payload.findByID({ collection: 'journal-entries', id: p3.journalEntry, depth: 0 })
  allOk = check('Purchase +13% VAT +2% TDS', e3, p3, 'PI') && allOk
  console.log(`   net=${p3.doc.netTotal} gross=${p3.doc.grossTotal}`)

  // 4. Payment voucher: settle 1110 with 2% TDS => cash 1087.80, TDS 22.20
  const pay = await payload.create({
    collection: 'documents', overrideAccess: true,
    data: {
      docType: 'payment-voucher', date: '2026-08-18', status: 'draft', tenant,
      paymentMethod: 'bank', bankAccount: bank.id,
      lines: [{ description: 'Settle purchase', amount: 1110 }],
      taxLines: [{ taxType: tdsTypeId, nature: 'withholding', rate: 2 }],
    },
  })
  const p4 = await postDocument(payload, pay.id)
  const e4 = await payload.findByID({ collection: 'journal-entries', id: p4.journalEntry, depth: 0 })
  allOk = check('Payment 1110 + 2% TDS', e4, p4, 'PV') && allOk

  // 5. Daybook 'all' linkage (via the endpoint handler path is auth-gated, so
  //    verify the daybook rows logic against the actual journal entries here).
  const allEntries = await payload.find({ collection: 'journal-entries', where: { status: { equals: 'posted' } }, limit: 1000, depth: 0 })
  const linked = allEntries.docs.filter((en) => en.referenceDoc)
  console.log(`${linked.length >= 4 ? 'PASS' : 'FAIL'} ${linked.length} posted entries reference their source voucher`)
  allOk = linked.length >= 4 && allOk

  console.log(allOk ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED')
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })