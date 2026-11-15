#!/usr/bin/env node
/**
 * Temporary end-to-end check of the order flow against a running server.
 * Exercises exactly what the SPA now does: create a draft order, confirm it
 * (not post it), then read it back and check the order status.
 */
const BASE = process.env.API_BASE || 'http://localhost:3100'
const EMAIL = process.env.ADMIN_EMAIL || 'aayurtshrestha@gmail.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'SyashaAdmin2026!'

let cookie = ''

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      // Better Auth rejects requests without an Origin header.
      Origin: BASE,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return res
}

/** Read a response body exactly once — a Response body can only be consumed once. */
async function readBody(res) {
  const text = await res.text()
  try {
    return { text, json: JSON.parse(text) }
  } catch {
    return { text, json: null }
  }
}

function log(m) { process.stdout.write(m + '\n') }
function fail(m) { console.error('FAIL:', m); process.exitCode = 1 }

// 1. Sign in.
const signIn = await req('/api/auth/sign-in/email', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
})
if (!signIn.ok) {
  const b = await readBody(signIn)
  fail(`sign-in ${signIn.status}: ${b.text.slice(0, 300)}`)
  log('\nORDER FLOW: FAILED')
  process.exit(1)
}
log('✓ sign-in')

// 2. Make sure the tenant has a chart of accounts (a customer party requires
//    an AR control account), then make sure a party and a fiscal year exist.
const tenantsRes = await req('/api/tenants?limit=5')
const tenants = (await tenantsRes.json()).docs ?? []
const tenantId = tenants[0]?.id
if (!tenantId) {
  fail('no tenant available')
  log('\nORDER FLOW: FAILED')
  process.exit(1)
}

const accountsRes = await req('/api/gl-accounts?limit=200')
const accounts = (await accountsRes.json()).docs ?? []
let arAccount = accounts.find((a) => a.code === '1201')
if (!arAccount) {
  const seeded = await req('/api/gl-accounts/seed-defaults', {
    method: 'POST',
    body: { tenant: tenantId },
  })
  if (!seeded.ok) {
    const b = await readBody(seeded)
    fail(`seed accounts: ${b.text.slice(0, 300)}`)
    log('\nORDER FLOW: FAILED')
    process.exit(1)
  }
  const again = await (await req('/api/gl-accounts?limit=200')).json()
  arAccount = (again.docs ?? []).find((a) => a.code === '1201')
}
if (!arAccount) {
  fail('Accounts Receivable (1201) still missing after seeding')
  log('\nORDER FLOW: FAILED')
  process.exit(1)
}
log(`✓ AR account ${arAccount.code} (id ${arAccount.id})`)

let parties = await (await req('/api/parties?limit=5')).json()
let partyId = parties.docs?.[0]?.id
if (!partyId) {
  const created = await req('/api/parties', {
    method: 'POST',
    body: {
      name: 'E2E Test Customer',
      type: 'customer',
      receivableAccount: arAccount.id,
    },
  })
  if (!created.ok) {
    const b = await readBody(created)
    fail(`party create: ${b.text.slice(0, 300)}`)
    log('\nORDER FLOW: FAILED')
    process.exit(1)
  }
  partyId = (await created.json()).id
}
log(`✓ party ${partyId}`)

let fys = await (await req('/api/fiscal-years?limit=5')).json()
if (!fys.docs?.length) {
  const created = await req('/api/fiscal-years', {
    method: 'POST',
    body: { label: '2083-84 E2E', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true, status: 'active' },
  })
  if (!created.ok) {
    const b = await readBody(created)
    log(`! fiscal-year create skipped: ${b.text.slice(0, 160)}`)
  } else {
    log('✓ fiscal year created')
  }
}

// 3. Create a sales order as a DRAFT — exactly what the SPA sends.
const orderBody = {
  docType: 'sales-order',
  date: '2026-11-15',
  party: partyId,
  status: 'draft',
  narration: 'E2E order flow check',
  lines: [{ description: 'Steel rods 100kg', qty: 100, rate: 95, amount: 9500 }],
  netTotal: 9500,
  grossTotal: 9500,
  taxTotal: 0,
  taxRate: 0,
}
const createRes = await req('/api/documents', { method: 'POST', body: orderBody })
if (!createRes.ok) {
  const b = await readBody(createRes)
  fail(`order create: ${b.text.slice(0, 400)}`)
  log('\nORDER FLOW: FAILED')
  process.exit(1)
}
const order = await createRes.json()
const orderId = order.id ?? order.doc?.id
log(`✓ sales order created (id ${orderId})`)

// 4. The server must REFUSE to post an order.
const postRes = await req(`/api/documents/${orderId}/post`, { method: 'POST' })
if (postRes.ok) {
  fail('server POSTed an order — it must refuse (status-only document)')
} else {
  const b = await readBody(postRes)
  log(`✓ server refuses to post an order (${postRes.status}): ${b.text.slice(0, 120)}`)
}

// 5. Confirm it — what the SPA now calls.
const confirmRes = await req(`/api/documents/${orderId}/confirm`, { method: 'POST' })
if (!confirmRes.ok) {
  const b = await readBody(confirmRes)
  fail(`order confirm: ${b.text.slice(0, 400)}`)
  log('\nORDER FLOW: FAILED')
  process.exit(1)
}
const confirmed = await confirmRes.json()
const doc = confirmed.doc ?? confirmed
if (doc.orderStatus !== 'confirmed') {
  fail(`orderStatus is "${doc.orderStatus}", expected "confirmed"`)
} else {
  log(`✓ order confirmed — number ${doc.number}, orderStatus ${doc.orderStatus}`)
}

// 6. Read it back.
const getRes = await req(`/api/documents/${orderId}`)
if (!getRes.ok) {
  const b = await readBody(getRes)
  fail(`order read-back: ${b.text.slice(0, 300)}`)
} else {
  const stored = await getRes.json()
  if (stored.orderStatus !== 'confirmed') fail(`read-back orderStatus is "${stored.orderStatus}"`)
  else log(`✓ read-back orderStatus ${stored.orderStatus}, status ${stored.status}`)
}

// 7. The open-orders register must list it.
const ordersRes = await req('/api/documents/orders?side=sell')
if (!ordersRes.ok) {
  const b = await readBody(ordersRes)
  fail(`orders register: ${b.text.slice(0, 300)}`)
} else {
  const reg = await ordersRes.json()
  const rows = reg.rows ?? reg.docs ?? reg.orders ?? []
  const found = rows.find((o) => o.id === orderId)
  if (!found) fail('confirmed order is missing from GET /documents/orders')
  else log(`✓ open-orders register lists it (${rows.length} order(s), gross ${found.grossTotal})`)
}

// 8. A purchase order must behave the same way.
const poBody = { ...orderBody, docType: 'purchase-order', narration: 'E2E purchase order check' }
const poCreate = await req('/api/documents', { method: 'POST', body: poBody })
if (!poCreate.ok) {
  const b = await readBody(poCreate)
  fail(`purchase order create: ${b.text.slice(0, 300)}`)
} else {
  const po = await poCreate.json()
  const poId = po.id ?? po.doc?.id
  const poConfirm = await req(`/api/documents/${poId}/confirm`, { method: 'POST' })
  if (!poConfirm.ok) {
    const b = await readBody(poConfirm)
    fail(`purchase order confirm: ${b.text.slice(0, 300)}`)
  } else {
    const poDoc = (await poConfirm.json())
    const d = poDoc.doc ?? poDoc
    if (d.orderStatus !== 'confirmed') fail(`purchase orderStatus is "${d.orderStatus}"`)
    else log(`✓ purchase order confirmed — number ${d.number}`)
  }
  const poList = await req('/api/documents/orders?side=buy')
  if (poList.ok) {
    const reg = await poList.json()
    const rows = reg.rows ?? []
    if (!rows.find((o) => o.id === poId)) fail('purchase order missing from side=buy register')
    else log(`✓ side=buy register lists it (${rows.length} order(s))`)
  }
  const delPo = await req(`/api/documents/${poId}`, { method: 'DELETE' })
  log(delPo.ok ? '✓ purchase order deleted' : `! cleanup: ${delPo.status}`)
}

// 9. A contra voucher must be able to get a number too. The sequence enum
//    used to carry 'contra-voucher' while documents use 'contra', which made
//    posting a contra voucher fail with an enum violation.
const accountsRes2 = await req('/api/gl-accounts?limit=200')
const accounts2 = (await accountsRes2.json()).docs ?? []
// A contra transfer must be between two cash/bank accounts.
const cashAccounts = accounts2.filter((a) => a.class === 'cash' || a.class === 'bank')
const contraAcct = cashAccounts[0]
const cashAcct = cashAccounts[1]
if (contraAcct && cashAcct) {
  const contraBody = {
    docType: 'contra',
    date: '2026-11-15',
    status: 'draft',
    narration: 'E2E contra voucher check',
    fromAccount: contraAcct.id,
    toAccount: cashAcct.id,
    netTotal: 5000,
    grossTotal: 5000,
    taxTotal: 0,
    taxRate: 0,
  }
  const contraCreate = await req('/api/documents', { method: 'POST', body: contraBody })
  if (!contraCreate.ok) {
    const b = await readBody(contraCreate)
    log(`! contra create failed: ${b.text.slice(0, 200)}`)
  } else {
    const cv = await contraCreate.json()
    const cvId = cv.id ?? cv.doc?.id
    const contraPost = await req(`/api/documents/${cvId}/post`, { method: 'POST' })
    if (!contraPost.ok) {
      const b = await readBody(contraPost)
      fail(`contra post: ${b.text.slice(0, 300)}`)
    } else {
      const cd = (await contraPost.json())
      const d = cd.doc ?? cd
      log(`✓ contra voucher posted — number ${d.number}`)
    }
    const delCv = await req(`/api/documents/${cvId}`, { method: 'DELETE' })
    log(delCv.ok ? '✓ contra voucher deleted' : `! cleanup: ${delCv.status}`)
  }
} else {
  log('! contra check skipped — no two accounts available')
}

// 10. Clean up so the local DB stays tidy.
const del = await req(`/api/documents/${orderId}`, { method: 'DELETE' })
log(del.ok ? '✓ order deleted' : `! cleanup: ${del.status}`)

log(process.exitCode ? '\nORDER FLOW: FAILED' : '\nORDER FLOW: PASSED')
