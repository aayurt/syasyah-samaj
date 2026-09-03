/**
 * billing-seed.mjs — seeds the billing module with demo data.
 *
 * Masters (account groups, chart of accounts, parties, items) are created
 * idempotently (find-or-create by name). Billing settings are wired to the
 * default accounts. Then a coherent month of vouchers is created as drafts
 * and posted through the real /documents/:id/post endpoint — the same engine
 * the UI uses — producing journal entries, stock movements and voucher
 * numbers atomically.
 *
 * Usage: node billing-seed.mjs
 * Env:   BILLING_EMAIL / BILLING_PASSWORD override the login credentials
 *        (defaults to the dev super-admin).
 */

const BASE = process.env.BILLING_API || 'http://localhost:3000/api'
const EMAIL = process.env.BILLING_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.BILLING_PASSWORD || 'SyashaAdmin2026!'

// ---- tiny cookie jar -------------------------------------------------------
const cookies = {}
function jar(res) {
  const set = res.headers.getSetCookie?.() ?? []
  for (const c of set) {
    const pair = c.split(';')[0]
    const i = pair.indexOf('=')
    if (i > 0) cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim()
  }
  return res
}
const cookieHeader = () =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

async function api(path, opts = {}) {
  const headers = {
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    Cookie: cookieHeader(),
    ...(opts.headers || {}),
  }
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  jar(res)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(
      `${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`,
    )
  }
  return data
}

// NOTE: this Payload build silently ignores the JSON `?where={...}` form and
// returns the first row — the bracket form (`where[name][equals]=x`) is the
// only reliable one, so we build the query string from a flat path.
async function findBy(collection, field, value) {
  const q = new URLSearchParams()
  q.set(`where[${field}][equals]`, value)
  q.set('limit', '1')
  q.set('depth', '0')
  const res = await api(`/${collection}?${q}`)
  return res.docs[0] || null
}

const createdCount = {}
async function createIfMissing(collection, field, value, data) {
  const existing = await findBy(collection, field, value)
  if (existing) return existing
  const created = await api(`/${collection}`, { method: 'POST', body: data })
  createdCount[collection] = (createdCount[collection] || 0) + 1
  return created.doc || created
}

const round2 = (n) => Math.round(n * 100) / 100

// ---- 1. auth ---------------------------------------------------------------
console.log(`\n[1] Signing in as ${EMAIL} …`)
await api('/auth/sign-in/email', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
  headers: { Origin: 'http://localhost:3000' },
})
const sess = await api('/auth/get-session')
if (!sess?.user) throw new Error('Login failed — no session.')
console.log(`    ✓ session for ${sess.user.email} (role ${sess.user.role})`)

// ---- 2. masters ------------------------------------------------------------
console.log('\n[2] Masters (idempotent) …')

const GROUPS = [
  { name: 'Current Assets', type: 'asset', code: '1' },
  { name: 'Fixed Assets', type: 'asset', code: '2' },
  { name: 'Current Liabilities', type: 'liability', code: '3' },
  { name: 'Capital & Reserves', type: 'equity', code: '4' },
  { name: 'Income', type: 'income', code: '5' },
  { name: 'Direct Expenses', type: 'expense', code: '6' },
  { name: 'Indirect Expenses', type: 'expense', code: '7' },
]
const groupIds = {}
for (const g of GROUPS) {
  const doc = await createIfMissing('account-groups', 'name', g.name, g)
  groupIds[g.name] = doc.id
}

const ACCOUNTS = [
  { name: 'Cash in Hand', code: '1010', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 0 },
  { name: 'Petty Cash', code: '1020', type: 'asset', class: 'cash', group: 'Current Assets', openingBalance: 0 },
  { name: 'Bank Account', code: '1030', type: 'asset', class: 'bank', group: 'Current Assets', openingBalance: 0 },
  { name: 'Accounts Receivable', code: '1100', type: 'asset', group: 'Current Assets' },
  { name: 'Inventory', code: '1200', type: 'asset', group: 'Current Assets' },
  { name: 'Accounts Payable', code: '2100', type: 'liability', group: 'Current Liabilities' },
  { name: 'Accrued Payables', code: '2200', type: 'liability', group: 'Current Liabilities' },
  { name: 'VAT (Input / Output)', code: '2300', type: 'liability', group: 'Current Liabilities' },
  { name: 'Capital', code: '4000', type: 'equity', group: 'Capital & Reserves' },
  { name: 'Sales Revenue', code: '5000', type: 'income', group: 'Income' },
  { name: 'Service Revenue', code: '5100', type: 'income', group: 'Income' },
  { name: 'Sales & Purchase Returns', code: '5200', type: 'income', group: 'Income' },
  { name: 'Purchases / Operating Expense', code: '6100', type: 'expense', group: 'Direct Expenses' },
  { name: 'Cost of Goods Sold', code: '6200', type: 'expense', group: 'Direct Expenses' },
  { name: 'Rent Expense', code: '7100', type: 'expense', group: 'Indirect Expenses' },
  { name: 'Salaries & Wages', code: '7200', type: 'expense', group: 'Indirect Expenses' },
  { name: 'Utilities', code: '7300', type: 'expense', group: 'Indirect Expenses' },
  { name: 'Office Supplies', code: '7400', type: 'expense', group: 'Indirect Expenses' },
  { name: 'Transportation', code: '7500', type: 'expense', group: 'Indirect Expenses' },
  { name: 'Miscellaneous Expenses', code: '7900', type: 'expense', group: 'Indirect Expenses' },
]
const accountIds = {}
for (const a of ACCOUNTS) {
  const doc = await createIfMissing('gl-accounts', 'name', a.name, {
    ...a,
    group: groupIds[a.group],
  })
  accountIds[a.name] = doc.id
}

// Billing settings → default accounts
const settings = await api('/globals/billing-settings', {
  method: 'POST',
  body: {
    fiscalYearStart: '2026-07-16',
    receivableAccount: accountIds['Accounts Receivable'],
    payableAccount: accountIds['Accounts Payable'],
    revenueAccount: accountIds['Sales Revenue'],
    expenseAccount: accountIds['Purchases / Operating Expense'],
    taxAccount: accountIds['VAT (Input / Output)'],
    cashAccount: accountIds['Cash in Hand'],
    bankAccount: accountIds['Bank Account'],
    pettyCashAccount: accountIds['Petty Cash'],
    inventoryAccount: accountIds['Inventory'],
    cogsAccount: accountIds['Cost of Goods Sold'],
    returnsAccount: accountIds['Sales & Purchase Returns'],
    accruedPayableAccount: accountIds['Accrued Payables'],
  },
})
// Create a working fiscal year (Manager.io-style) and point settings at it.
try {
  const fyRes = await api('/fiscal-years', {
    method: 'POST',
    body: {
      label: '2083-84',
      startDate: '2026-07-16',
      endDate: '2027-07-15',
      status: 'active',
      isActive: true,
    },
  })
  const fyId = fyRes && (fyRes.id || (fyRes.doc && fyRes.doc.id))
  if (fyId) {
    await api('/globals/billing-settings', {
      method: 'POST',
      body: { activeFiscalYear: fyId },
    })
  }
} catch (e) {
  console.log('    ! fiscal year seeding skipped:', e && e.message ? e.message : e)
}
console.log(
  `    ✓ ${createdCount['account-groups'] || 0} new groups, ${createdCount['gl-accounts'] || 0} new accounts, billing-settings wired (fiscal year 2026-07-16)`,
)

const PARTIES = [
  { name: 'Hotel Annapurna', type: 'customer', email: 'accounts@hotelannapurna.com.np', phone: '01-4220000', taxId: '301234567', address: 'Durbar Marg, Kathmandu' },
  { name: 'Boudhanath Stupa Trust', type: 'customer', email: 'office@boudha.org.np', phone: '01-4250001', taxId: '301234568', address: 'Boudhanath, Kathmandu' },
  { name: 'Thamel Tours & Travels', type: 'customer', email: 'info@thameltours.com', phone: '01-4411223', taxId: '301234569', address: 'Thamel, Kathmandu' },
  { name: 'Patan Handicrafts', type: 'both', email: 'sales@patanhandicrafts.com', phone: '01-5533777', taxId: '301234570', address: 'Patan, Lalitpur' },
  { name: 'Kathmandu Traders', type: 'customer', email: 'kt@example.com', phone: '9841555666', taxId: '301234571', address: 'Asan, Kathmandu' },
  { name: 'Nepal Stationery House', type: 'vendor', email: 'orders@nsh.com.np', phone: '01-4244555', taxId: '302345678', address: 'New Road, Kathmandu' },
  { name: 'Kathmandu Wholesale Suppliers', type: 'vendor', email: 'supply@kws.com.np', phone: '01-4499888', taxId: '302345679', address: 'Kalimati, Kathmandu' },
  { name: 'Everest Logistics', type: 'vendor', email: 'ops@everestlogistics.com', phone: '01-4455666', taxId: '302345680', address: 'Balkhu, Kathmandu' },
]
const partyIds = {}
for (const p of PARTIES) {
  const doc = await createIfMissing('parties', 'name', p.name, p)
  partyIds[p.name] = doc.id
}

const ITEMS = [
  { name: 'Prayer Flag (Khada)', code: 'KHA-01', unit: 'pc', openingStock: 200, purchasePrice: 80, salePrice: 120, reorderLevel: 50 },
  { name: 'Incense Sticks (Dhup)', code: 'DHU-01', unit: 'box', openingStock: 300, purchasePrice: 150, salePrice: 220, reorderLevel: 100 },
  { name: 'Ghee (Clarified Butter)', code: 'GHE-01', unit: 'litre', openingStock: 100, purchasePrice: 600, salePrice: 800, reorderLevel: 30 },
  { name: 'Rice (Chaamal)', code: 'RIC-01', unit: 'kg', openingStock: 500, purchasePrice: 70, salePrice: 95, reorderLevel: 200 },
  { name: 'Oil Lamp (Diyo)', code: 'DIY-01', unit: 'pc', openingStock: 250, purchasePrice: 180, salePrice: 260, reorderLevel: 60 },
  { name: 'Pooja Thali Set', code: 'THA-01', unit: 'set', openingStock: 80, purchasePrice: 900, salePrice: 1300, reorderLevel: 20 },
  { name: 'Candles', code: 'CAN-01', unit: 'pc', openingStock: 400, purchasePrice: 25, salePrice: 45, reorderLevel: 150 },
  { name: 'Cotton Wicks (Batti)', code: 'BAT-01', unit: 'pack', openingStock: 600, purchasePrice: 30, salePrice: 50, reorderLevel: 200 },
]
const itemIds = {}
for (const it of ITEMS) {
  const doc = await createIfMissing('items', 'name', it.name, it)
  itemIds[it.name] = doc.id
}
console.log(
  `    ✓ ${createdCount['parties'] || 0} new parties, ${createdCount['items'] || 0} new items`,
)

// ---- 3. documents ----------------------------------------------------------
console.log('\n[3] Vouchers …')

const D = {
  hotel: partyIds['Hotel Annapurna'],
  boudha: partyIds['Boudhanath Stupa Trust'],
  thamel: partyIds['Thamel Tours & Travels'],
  patan: partyIds['Patan Handicrafts'],
  kt: partyIds['Kathmandu Traders'],
  nsh: partyIds['Nepal Stationery House'],
  kws: partyIds['Kathmandu Wholesale Suppliers'],
  everest: partyIds['Everest Logistics'],
}
const I = itemIds

const docs = [
  {
    docType: 'journal-voucher',
    date: '2026-07-16',
    narration: 'Opening capital introduced into the business',
    journalLines: [
      { account: accountIds['Bank Account'], debit: 400000 },
      { account: accountIds['Cash in Hand'], debit: 90000 },
      { account: accountIds['Petty Cash'], debit: 10000 },
      { account: accountIds['Capital'], credit: 500000 },
    ],
  },
  {
    docType: 'grn',
    date: '2026-07-18',
    party: D.kws,
    narration: 'Goods received from Kathmandu Wholesale Suppliers',
    lines: [
      { item: I['Rice (Chaamal)'], description: 'Rice (Chaamal)', qty: 300, rate: 70 },
      { item: I['Ghee (Clarified Butter)'], description: 'Ghee (Clarified Butter)', qty: 50, rate: 600 },
      { item: I['Incense Sticks (Dhup)'], description: 'Incense Sticks (Dhup)', qty: 100, rate: 150 },
    ],
  },
  {
    docType: 'purchase-invoice',
    date: '2026-07-20',
    party: D.nsh,
    narration: 'Office supplies purchased on credit',
    taxRate: 13,
    lines: [{ description: 'Office supplies (stationery)', qty: 1, rate: 12000 }],
  },
  {
    docType: 'payment-voucher',
    date: '2026-07-22',
    party: D.nsh,
    narration: 'Payment to Nepal Stationery House',
    paymentMethod: 'bank',
    taxRate: 0,
    lines: [{ description: 'Settlement of office supplies bill', qty: 1, rate: 13560 }],
  },
  {
    docType: 'sales-invoice',
    date: '2026-07-24',
    party: D.hotel,
    narration: 'Sales to Hotel Annapurna',
    taxRate: 13,
    lines: [
      { item: I['Prayer Flag (Khada)'], description: 'Prayer Flag (Khada)', qty: 50, rate: 120 },
      { item: I['Oil Lamp (Diyo)'], description: 'Oil Lamp (Diyo)', qty: 30, rate: 260 },
      { item: I['Incense Sticks (Dhup)'], description: 'Incense Sticks (Dhup)', qty: 40, rate: 220 },
    ],
  },
  {
    docType: 'sales-invoice',
    date: '2026-07-28',
    party: D.boudha,
    narration: 'Sales to Boudhanath Stupa Trust',
    taxRate: 13,
    lines: [
      { item: I['Ghee (Clarified Butter)'], description: 'Ghee (Clarified Butter)', qty: 20, rate: 800 },
      { item: I['Rice (Chaamal)'], description: 'Rice (Chaamal)', qty: 100, rate: 95 },
    ],
  },
  {
    docType: 'receipt-voucher',
    date: '2026-07-30',
    party: D.hotel,
    narration: 'Cash received from Hotel Annapurna against invoice',
    paymentMethod: 'cash',
    lines: [{ description: 'Settlement of sales invoice', qty: 1, rate: 25538 }],
  },
  {
    docType: 'delivery-challan',
    date: '2026-08-02',
    party: D.patan,
    narration: 'Goods dispatched to Patan Handicrafts on approval',
    lines: [{ item: I['Pooja Thali Set'], description: 'Pooja Thali Set', qty: 25, rate: 900 }],
  },
  {
    docType: 'credit-note',
    date: '2026-08-04',
    party: D.boudha,
    referenceTo: null, // filled after SI-2 posts
    narration: 'Credit note: returned Ghee from July sale',
    taxRate: 13,
    lines: [{ description: 'Returned Ghee (5 litres)', qty: 5, rate: 800 }],
  },
  {
    docType: 'petty-cash-voucher',
    date: '2026-08-06',
    narration: 'Tea and refreshments for office visitors',
    lines: [{ description: 'Tea, milk and refreshments', qty: 1, rate: 2500 }],
  },
  {
    docType: 'sales-invoice',
    date: '2026-08-08',
    party: D.thamel,
    narration: 'Sales to Thamel Tours & Travels',
    taxRate: 13,
    lines: [
      { item: I['Candles'], description: 'Candles', qty: 100, rate: 45 },
      { item: I['Prayer Flag (Khada)'], description: 'Prayer Flag (Khada)', qty: 25, rate: 120 },
    ],
  },
  {
    docType: 'journal-voucher',
    date: '2026-08-10',
    narration: 'Monthly office rent',
    journalLines: [
      { account: accountIds['Rent Expense'], debit: 35000 },
      { account: accountIds['Bank Account'], credit: 35000 },
    ],
  },
  {
    docType: 'journal-voucher',
    date: '2026-08-12',
    narration: 'Monthly salaries',
    journalLines: [
      { account: accountIds['Salaries & Wages'], debit: 60000 },
      { account: accountIds['Bank Account'], credit: 60000 },
    ],
  },
]

// Resumable: find-or-create each voucher by narration; post any that are
// still drafts. Already-posted vouchers are left untouched.
console.log('    posting drafts through the real engine …')
const SI2_NARRATION = 'Sales to Boudhanath Stupa Trust'
for (const d of docs) {
  const existing = await findBy('documents', 'narration', d.narration)
  if (existing) {
    if (existing.status === 'draft') {
      const res = await api(`/documents/${existing.id}/post`, { method: 'POST' })
      console.log(
        `      ${String(existing.docType).padEnd(18)} ${res.number}  gross ${round2(res.doc.grossTotal).toLocaleString()}`,
      )
    } else {
      console.log(
        `      ${String(existing.docType).padEnd(18)} ${existing.number || ''} already ${existing.status}`,
      )
    }
    continue
  }
  // Credit note references SI-2 (must exist before creating the note).
  const { referenceTo, ...body } = d
  if (d.docType === 'credit-note') {
    const si2 = await findBy('documents', 'narration', SI2_NARRATION)
    body.referenceTo = si2 ? si2.id : undefined
  }
  const created = await api('/documents', { method: 'POST', body })
  const id = created.doc?.id || created.id
  const res = await api(`/documents/${id}/post`, { method: 'POST' })
  console.log(
    `      ${String(d.docType).padEnd(18)} ${res.number}  gross ${round2(res.doc.grossTotal).toLocaleString()}`,
  )
}

// In-progress vouchers that stay as drafts (never posted). Useful for
// exercising the draft state, the draft-status filter, and the delete action.
const drafts = [
  {
    docType: 'sales-invoice',
    date: '2026-08-13',
    party: D.kt,
    narration: 'Sales to Kathmandu Traders (draft)',
    taxRate: 13,
    lines: [
      { item: I['Prayer Flag (Khada)'], description: 'Prayer Flag (Khada)', qty: 20, rate: 120 },
      { item: I['Candles'], description: 'Candles', qty: 50, rate: 45 },
      { description: 'Puja room setup service', qty: 1, rate: 5000 },
    ],
  },
  {
    docType: 'purchase-invoice',
    date: '2026-08-13',
    party: D.everest,
    narration: 'Freight charges from Everest Logistics (draft)',
    taxRate: 13,
    lines: [{ description: 'Freight for August goods delivery', qty: 1, rate: 8500 }],
  },
  {
    docType: 'payment-voucher',
    date: '2026-08-14',
    party: D.kws,
    narration: 'Partial payment to Kathmandu Wholesale Suppliers (draft)',
    paymentMethod: 'bank',
    lines: [{ description: 'Partial settlement of GRN-2026-0001', qty: 1, rate: 20000 }],
  },
  {
    docType: 'journal-voucher',
    date: '2026-08-14',
    narration: 'Depreciation provision for August (draft)',
    journalLines: [
      { account: accountIds['Miscellaneous Expenses'], debit: 8000, memo: 'Depreciation on fixed assets' },
      { account: accountIds['Capital'], credit: 8000, memo: 'Accumulated depreciation' },
    ],
  },
  {
    docType: 'grn',
    date: '2026-08-14',
    party: D.kws,
    narration: 'Second goods receipt from Kathmandu Wholesale Suppliers (draft)',
    lines: [
      { item: I['Ghee (Clarified Butter)'], description: 'Ghee (Clarified Butter)', qty: 30, rate: 620 },
      { item: I['Cotton Wicks (Batti)'], description: 'Cotton Wicks (Batti)', qty: 200, rate: 32 },
    ],
  },
]

console.log('    drafts (in progress, not posted) …')
for (const d of drafts) {
  const existing = await findBy('documents', 'narration', d.narration)
  if (existing) {
    console.log(`      ${String(existing.docType).padEnd(18)} already exists (status ${existing.status})`)
    continue
  }
  const created = await api('/documents', { method: 'POST', body: { status: 'draft', ...d } })
  const id = created.doc?.id || created.id
  console.log(`      ${String(d.docType).padEnd(18)} draft created (id ${id})`)
}

// ---- 4. verify -------------------------------------------------------------
console.log('\n[4] Verification …')

const tb = await api('/journal-entries/trial-balance')
console.log(
  `    trial balance  debits ${round2(tb.totals.debit).toLocaleString()}  credits ${round2(tb.totals.credit).toLocaleString()}  balanced: ${tb.balanced}  (${tb.docs.length} accounts)`,
)

const arLedger = await api(`/journal-entries/ledger?account=${accountIds['Accounts Receivable']}`)
console.log(
  `    AR ledger      closing ${round2(arLedger.closingBalance).toLocaleString()}  (${arLedger.docs.length} entries)`,
)

const stock = await api('/items/stock-levels')
for (const s of stock.docs) {
  console.log(
    `    stock          ${s.item.name.padEnd(28)} on-hand ${String(s.onHand).padStart(5)}  avg ${round2(s.avgCost).toLocaleString()}  value ${round2(s.value).toLocaleString()}${s.belowReorder ? '  ⚠ reorder' : ''}`,
  )
}

const aging = await api('/documents/aging?side=ar')
console.log(
  `    AR aging       ${aging.parties.length} parties open  total ${round2(aging.totals.total).toLocaleString()}  buckets ${JSON.stringify(aging.totals.buckets)}`,
)

const pl = await api('/journal-entries/profit-loss')
console.log(
  `    profit & loss  income ${round2(pl.totals.income).toLocaleString()}  expense ${round2(pl.totals.expense).toLocaleString()}  net ${round2(pl.totals.netProfit).toLocaleString()}`,
)

const bs = await api('/journal-entries/balance-sheet')
console.log(
  `    balance sheet  assets ${round2(bs.totals.assets).toLocaleString()}  liabilities+equity ${round2(bs.totals.liabilitiesEquity).toLocaleString()}  balanced: ${bs.balanced}`,
)

const daybook = await api('/journal-entries/daybook?type=cash')
console.log(
  `    cash book      ${daybook.rows.length} rows  closing balance ${round2(daybook.closingBalance).toLocaleString()}`,
)

console.log('\nSeed complete.')
