/**
 * Temporary: verify the doc_sequences enum migration against a database whose
 * enum has been rolled back to the pre-fix state.
 */
import { up, down } from '../src/migrations/20261115_doc_sequences_order_types.ts'
import { readFileSync, writeFileSync } from 'node:fs'

// Dump the generated SQL for inspection.
const src = readFileSync(
  new URL('../src/migrations/20261115_doc_sequences_order_types.ts', import.meta.url),
  'utf8',
)
const mod = await import('../src/migrations/20261115_doc_sequences_order_types.ts')
console.log('EXPORTS:', Object.keys(mod))

process.env.RESEND_API_KEY ||= 're_test'
process.env.PAYLOAD_SECRET ||= 'test-secret-key-for-ci'

const { default: config } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })
const pool = payload.db.pool

/** Roll the enum back to exactly what the pre-fix schema had. */
async function restoreOldEnum() {
  await pool.query(`ALTER TABLE doc_sequences ALTER COLUMN doc_type DROP DEFAULT`)
  await pool.query(
    `ALTER TABLE doc_sequences ALTER COLUMN doc_type TYPE text USING doc_type::text`,
  )
  await pool.query(`DROP TYPE IF EXISTS public.enum_doc_sequences_doc_type`)
  await pool.query(
    `CREATE TYPE public.enum_doc_sequences_doc_type AS ENUM(
       'sales-invoice','purchase-invoice','receipt-voucher','payment-voucher',
       'journal-voucher','contra-voucher','credit-note','debit-note','grn','delivery-challan'
     )`,
  )
  await pool.query(
    `ALTER TABLE doc_sequences ALTER COLUMN doc_type TYPE public.enum_doc_sequences_doc_type
       USING doc_type::public.enum_doc_sequences_doc_type`,
  )
}

const enumValues = async () => {
  const r = await pool.query(
    `SELECT unnest(enum_range(NULL::enum_doc_sequences_doc_type))::text AS v`,
  )
  return r.rows.map((x) => x.v)
}

await restoreOldEnum()
console.log('BEFORE:', (await enumValues()).join(' '))

await up({ db: payload.db.drizzle, payload, req: {} })
const afterUp = await enumValues()
console.log('AFTER UP:', afterUp.join(' '))

for (const required of ['sales-order', 'purchase-order']) {
  if (!afterUp.includes(required)) {
    console.error(`MISSING after up: ${required}`)
    process.exitCode = 1
  }
}

// The column must accept an order row.
const ins = await pool.query(
  `INSERT INTO doc_sequences (key, name, doc_type, last_number, created_at, updated_at)
   VALUES ('test:sales-order:1','Sales Order','sales-order',1,now(),now())
   ON CONFLICT (key) DO NOTHING RETURNING doc_type`,
)
console.log('INSERT sales-order ->', ins.rows[0]?.doc_type ?? '(conflict)')
await pool.query(`DELETE FROM doc_sequences WHERE key = 'test:sales-order:1'`)

// Running up twice must be a no-op.
await up({ db: payload.db.drizzle, payload, req: {} })
console.log('AFTER 2nd UP:', (await enumValues()).join(' '))

// Roll back.
await down({ db: payload.db.drizzle, payload, req: {} })
console.log('AFTER DOWN:', (await enumValues()).join(' '))

process.exit(process.exitCode || 0)
