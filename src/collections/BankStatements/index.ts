import {
  isBillingUser,
  resolveScopedTenant,
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { round2, toNum } from '@/utilities/journalValidation'
import { assignTenant } from '@/utilities/tenantScope'
import { parse } from 'csv-parse/sync'

/**
 * Bank reconciliation (P3).
 *
 * A bank statement is an uploaded statement for one bank account over a
 * period. Its rows are matched, one at a time, against the posted journal
 * entries that hit the same bank account. A matched row marks the source
 * journal entry `cleared` (and stamps `clearedAt`) — the balance-sheet
 * "bank cleared vs bank book" view then falls out of the ledger.
 *
 * Matching is amount-and-date based: a statement row is matched to the
 * journal entry with the same signed bank-account amount and the closest
 * date, so long as neither is already matched. The reconcile endpoint
 * reports matched / unmatched on both sides so differences surface for
 * manual review.
 */

type BankLine = {
  entryId: number
  date: string
  amount: number
  narration: string
}

function vErr(message: string): Error {
  return new Error(message)
}

/** Normalizes a CSV row into a statement line. Accepts either signed
 * `amount` or split `credit`/`debit` columns. */
function normalizeRow(row: Record<string, unknown>, idx: number) {
  const pick = (...names: string[]) =>
    names
      .map((n) => row[n])
      .find((v) => v !== undefined && v !== null && String(v).trim() !== '')
  const date = String(pick('date', 'Date', 'Txn Date', 'transaction date') || '')
  const description = String(
    pick('description', 'narration', 'Description', 'Particulars', 'details') || '',
  )
  const reference = String(
    pick('reference', 'ref', 'Reference', 'cheque', 'Cheque No', 'Txn ID', 'voucher') || '',
  )
  const amountStr = String(pick('amount', 'Amount', 'amount (NPR)') || '')
  const creditStr = String(pick('credit', 'Credit', 'deposit', 'Deposit') || '')
  const debitStr = String(pick('debit', 'Debit', 'withdrawal', 'Withdrawal') || '')

  let amount: number
  if (amountStr !== '') {
    amount = toNum(amountStr)
  } else if (creditStr !== '' || debitStr !== '') {
    amount = toNum(creditStr) - toNum(debitStr)
  } else {
    throw vErr(`Row ${idx + 1}: missing amount (use a signed "amount" or "credit"/"debit" columns).`)
  }
  if (!date) {
    throw vErr(`Row ${idx + 1}: missing date.`)
  }
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) {
    throw vErr(`Row ${idx + 1}: invalid date "${date}".`)
  }
  return {
    date: d.toISOString().slice(0, 10),
    description,
    reference,
    amount: round2(amount),
  }
}

export const BankStatements: CollectionConfig = {
  slug: 'bank-statements',
  admin: {
    useAsTitle: 'id',
    group: 'Billing',
    defaultColumns: ['account', 'periodStart', 'periodEnd', 'openingBalance', 'closingBalance', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  endpoints: [
    {
      // Import a bank statement: from CSV text or an array of rows.
      path: '/import',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await req.json!()) as any
          const account = body.account
          if (!account) {
            return Response.json({ error: 'Missing account (bank GL account id)' }, { status: 400 })
          }
          const tenant = resolveScopedTenant(req, body.tenant)

          let rows: any[]
          if (typeof body.csv === 'string' && body.csv.trim()) {
            let parsed: Record<string, unknown>[]
            try {
              parsed = parse(body.csv, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, unknown>[]
            } catch (e: any) {
              return Response.json({ error: `CSV parse failed: ${e?.message}` }, { status: 400 })
            }
            rows = parsed.map((r, i) => normalizeRow(r, i))
          } else if (Array.isArray(body.rows)) {
            rows = body.rows.map((r: any, i: number) => normalizeRow(r || {}, i))
          } else {
            return Response.json(
              { error: 'Provide either "csv" (string) or "rows" (array of {date, description, amount}).' },
              { status: 400 },
            )
          }
          if (!rows.length) {
            return Response.json({ error: 'No usable rows in the statement.' }, { status: 400 })
          }

          const dates = rows.map((r) => r.date).sort()
          const statement = await req.payload.create({
            collection: 'bank-statements',
            data: {
              account,
              periodStart: body.periodStart || dates[0],
              periodEnd: body.periodEnd || dates[dates.length - 1],
              openingBalance: toNum(body.openingBalance),
              closingBalance: toNum(body.closingBalance),
              rows: rows.map((r) => ({
                date: r.date,
                description: r.description,
                reference: r.reference,
                amount: r.amount,
              })),
              ...(tenant ? { tenant } : {}),
            } as any,
          })
          return Response.json({ statement, importedRows: rows.length })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Import failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Reconcile: match unmatched statement rows against posted journal
      // entries on the same bank account. Matching is by signed amount
      // (statement deposit = journal debit, withdrawal = journal credit)
      // and closest date. Matched entries are marked cleared.
      path: '/:id/reconcile',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing statement id' }, { status: 400 })
        }
        try {
          const statement = (await req.payload.findByID({
            collection: 'bank-statements',
            id,
            depth: 0,
          })) as any
          if (!statement) {
            return Response.json({ error: 'Statement not found' }, { status: 404 })
          }
          const bankAccount = Number(
            statement.account && typeof statement.account === 'object'
              ? statement.account.id
              : statement.account,
          )
          const tenant = statement.tenant
            ? typeof statement.tenant === 'object'
              ? statement.tenant.id
              : statement.tenant
            : undefined

          // Bank lines of every posted journal entry (the whole book; the
          // amount + closest-date matching handles the range window).
          const res = await req.payload.find({
            collection: 'journal-entries',
            where: {
              status: { equals: 'posted' },
              cleared: { not_equals: true },
              'lines.account': { equals: bankAccount },
              ...(tenant ? { tenant: { equals: tenant } } : {}),
            },
            limit: 1000,
            depth: 0,
            sort: 'date',
          })

          const bankLines: BankLine[] = []
          for (const entry of res.docs as any[]) {
            for (const line of entry.lines || []) {
              const accId =
                typeof line.account === 'object' && line.account
                  ? line.account.id
                  : line.account
              if (Number(accId) !== bankAccount) continue
              const debit = toNum(line.debit)
              const credit = toNum(line.credit)
              if (debit === 0 && credit === 0) continue
              bankLines.push({
                entryId: entry.id,
                date: entry.date,
                amount: round2(debit - credit),
                narration: entry.narration || '',
              })
            }
          }

          const rows = (statement.rows || []).map((r: any) => ({ ...r }))
          const matchedRows: any[] = []
          const unmatchedRows: any[] = []
          const clearedEntries = new Set<number>()

          for (const row of rows) {
            if (row.matchedEntry) {
              matchedRows.push({ ...row, matched: true })
              continue
            }
            const rowAmount = round2(toNum(row.amount))
            let best: BankLine | null = null
            let bestScore = Infinity
            for (let i = 0; i < bankLines.length; i++) {
              const l = bankLines[i]
              if (!l) continue
              if (Math.abs(l.amount - rowAmount) > 0.001) continue
              const score = Math.abs(
                new Date(l.date).getTime() - new Date(row.date).getTime(),
              )
              if (score < bestScore) {
                bestScore = score
                best = l
              }
            }
            if (best) {
              const li = bankLines.findIndex((l) => l === best)
              bankLines.splice(li, 1)
              row.matchedEntry = best.entryId
              row.matched = true
              matchedRows.push({ ...row, matchedEntryId: best.entryId })
              clearedEntries.add(best.entryId)
            } else {
              unmatchedRows.push({ ...row, matched: false })
            }
          }

          // Mark the matched entries cleared. This is bookkeeping metadata on
          // an otherwise immutable posted entry, so it's written with a raw
          // UPDATE (local-API array re-validation would reject it) — the same
          // pattern the numbering engine uses for doc_sequences.
          const pool = (req.payload.db as any).pool
          for (const entryId of clearedEntries) {
            await pool.query(
              `UPDATE "journal_entries"
               SET "cleared" = true, "cleared_at" = now()
               WHERE "id" = $1`,
              [entryId],
            )
          }

          const updated = await req.payload.update({
            collection: 'bank-statements',
            id: statement.id,
            data: { rows: rows.map((r: any) => ({
              date: r.date,
              description: r.description,
              reference: r.reference,
              amount: r.amount,
              matchedEntry: r.matchedEntry || undefined,
            })) },
          })

          return Response.json({
            statementId: statement.id,
            matchedRows: matchedRows.length,
            unmatchedRows: unmatchedRows.length,
            matchedAmount: round2(matchedRows.reduce((s, r) => s + toNum(r.amount), 0)),
            unmatchedAmount: round2(unmatchedRows.reduce((s, r) => s + toNum(r.amount), 0)),
            clearedEntries: clearedEntries.size,
            unmatched: unmatchedRows.map((r) => ({
              date: r.date,
              description: r.description,
              reference: r.reference,
              amount: r.amount,
            })),
            rows: updated.rows,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Reconciliation failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Create receipt/payment vouchers from unmatched statement rows.
      // Positive amounts become receipt-vouchers, negative become payment-vouchers.
      // Each voucher is auto-posted immediately.
      path: '/:id/create-vouchers',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing statement id' }, { status: 400 })
        }
        try {
          const statement = (await req.payload.findByID({
            collection: 'bank-statements',
            id,
            depth: 0,
          })) as any
          if (!statement) {
            return Response.json({ error: 'Statement not found' }, { status: 404 })
          }
          const bankAccountId = Number(
            statement.account && typeof statement.account === 'object'
              ? statement.account.id
              : statement.account,
          )
          const tenant = statement.tenant
            ? typeof statement.tenant === 'object'
              ? statement.tenant.id
              : statement.tenant
            : undefined

          const body = (await req.json!()) as {
            rows: { date: string; description?: string; reference?: string; amount: number }[]
          }
          if (!Array.isArray(body.rows) || body.rows.length === 0) {
            return Response.json({ error: 'Provide rows to create vouchers for.' }, { status: 400 })
          }

          // Get billing settings for cash/bank account mapping
          const settings = (await req.payload.findGlobal({
            slug: 'billing-settings',
          })) as any

          const pool = (req.payload.db as any).pool
          const created: { id: number; type: string; amount: number; number: string }[] = []

          for (const row of body.rows) {
            const amt = Math.abs(round2(toNum(row.amount)))
            if (amt <= 0) continue

            const isDeposit = row.amount > 0
            const docType = isDeposit ? 'receipt-voucher' : 'payment-voucher'
            const narration = row.description || `${isDeposit ? 'Bank deposit' : 'Bank withdrawal'} - ${row.reference || 'N/A'}`

            // Create document via raw SQL (Payload local API has issues with array fields)
            const docResult = await pool.query(
              `INSERT INTO documents
                 (doc_type, date, narration, status, payment_method, bank_account_id,
                  net_total, tax_total, gross_total, tenant_id, created_at, updated_at)
               VALUES ($1, $2, $3, 'draft', 'bank', $4, $5, 0, $5, $6, now(), now())
               RETURNING id`,
              [docType, row.date, narration, bankAccountId, amt, tenant],
            )
            const docId: number = docResult.rows[0].id

            // Create line item
            await pool.query(
              `INSERT INTO documents_lines
                 (_order, _parent_id, id, description, qty, rate, amount)
               VALUES (0, $1, $2, $3, 1, $4, $4)`,
              [docId, `line-${docId}-0`, narration, amt],
            )

            // Auto-post the voucher using the existing postDocument function
            try {
              // Import postDocument dynamically to avoid circular dependency
              const { postDocument } = await import('@/collections/Documents')
              const posted = await postDocument(req.payload, docId, {
                request: req,
              })
              created.push({
                id: docId,
                type: docType,
                amount: amt,
                number: posted.number || `V-${docId}`,
              })
            } catch (postErr) {
              // If posting fails, still count as created (draft)
              created.push({
                id: docId,
                type: docType,
                amount: amt,
                number: `Draft-${docId}`,
              })
            }
          }

          return Response.json({
            message: `Created ${created.length} voucher(s) from bank statement`,
            vouchers: created,
            totalAmount: round2(created.reduce((s, v) => s + v.amount, 0)),
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to create vouchers'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
  ],
  hooks: {
    beforeValidate: [assignTenant],
  },
  fields: [
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'gl-accounts',
      required: true,
      admin: {
        description: 'The bank account this statement belongs to (GL account with class = bank).',
      },
    },
    {
      name: 'periodStart',
      type: 'date',
    },
    {
      name: 'periodEnd',
      type: 'date',
    },
    {
      name: 'openingBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: "Bank's stated opening balance for the period.",
      },
    },
    {
      name: 'closingBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: "Bank's stated closing balance for the period.",
      },
    },
    {
      name: 'rows',
      type: 'array',
      admin: {
        description:
          'Statement lines. Positive amount = deposit (money in), negative = withdrawal (money out).',
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
        },
        {
          name: 'reference',
          type: 'text',
          admin: { description: 'Cheque no / transaction id / reference.' },
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          admin: {
            description: 'Signed amount: + deposit, − withdrawal.',
          },
        },
        {
          name: 'matchedEntry',
          type: 'relationship',
          relationTo: 'journal-entries',
          admin: {
            readOnly: true,
            description: 'Journal entry this row was matched to by reconciliation.',
          },
          access: {
            create: () => false,
            update: () => false,
          },
        },
      ],
    },
    // Illaka scoping — required; auto-assigned from the user's illaka (or C00).
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
