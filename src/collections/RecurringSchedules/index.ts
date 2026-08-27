import { isAdmin } from '@/access/admin'
import type { CollectionConfig, PayloadRequest } from 'payload'

const FREQUENCIES = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
]

const DOC_TYPES_FOR_RECURRING = [
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Membership Receipt', value: 'membership-receipt' },
  { label: 'Donation Receipt', value: 'donation-receipt' },
]

function isBillingUser(user: any): boolean {
  if (!user) return false
  const role = user.role || ''
  return ['admin', 'super-admin', 'illaka-chair', 'illaka-treasurer',
    'illaka-secretary', 'illaka-accountant', 'illaka-member-officer', 'viewer'].includes(role)
}

function isBillingReq(req: PayloadRequest): boolean {
  return Boolean(req.user && isBillingUser(req.user))
}

/** Advance a date by the given frequency. */
function advanceDate(dateStr: string, frequency: string, dayOfMonth?: number | null): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7)
      break
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14)
      break
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1)
      if (dayOfMonth && dayOfMonth > 0) {
        d.setUTCDate(Math.min(dayOfMonth, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())))
      }
      break
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3)
      if (dayOfMonth && dayOfMonth > 0) {
        d.setUTCDate(Math.min(dayOfMonth, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())))
      }
      break
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1)
      if (dayOfMonth && dayOfMonth > 0) {
        d.setUTCDate(Math.min(dayOfMonth, daysInMonth(d.getUTCFullYear(), d.getUTCMonth())))
      }
      break
  }
  return d.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Get today in YYYY-MM-DD (UTC). */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export const RecurringSchedules: CollectionConfig = {
  slug: 'recurring-schedules',
  labels: { singular: 'Recurring Schedule', plural: 'Recurring Schedules' },
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    hidden: ({ user }) => {
      if (!user) return true
      if (user.role === 'super-admin' || user.role === 'admin') return false
      return true
    },
  },
  access: {
    create: isAdmin,
    read: ({ req }) => isBillingReq(req),
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'A descriptive name for this schedule (e.g. "Monthly rent invoice")' },
    },
    {
      name: 'docType',
      type: 'select',
      required: true,
      options: DOC_TYPES_FOR_RECURRING,
      defaultValue: 'sales-invoice',
    },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      options: FREQUENCIES,
      defaultValue: 'monthly',
    },
    {
      name: 'dayOfMonth',
      type: 'number',
      min: 1,
      max: 31,
      admin: {
        description: 'Day of month to generate (1-31). For monthly/quarterly/yearly. If the month has fewer days, uses the last day.',
        condition: (_, siblingData) => ['monthly', 'quarterly', 'yearly'].includes(siblingData?.frequency),
      },
    },
    {
      name: 'party',
      type: 'relationship',
      relationTo: 'parties',
      required: true,
    },
    {
      name: 'lines',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'qty', type: 'number', defaultValue: 1, min: 0 },
        { name: 'rate', type: 'number', required: true, min: 0 },
        { name: 'amount', type: 'number', min: 0 },
        { name: 'item', type: 'relationship', relationTo: 'items' },
      ],
    },
    {
      name: 'taxRate',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
      admin: { description: 'Tax rate in % (e.g. 13 for 13% VAT)' },
    },
    {
      name: 'narration',
      type: 'textarea',
    },
    {
      name: 'startDate',
      type: 'text',
      required: true,
      admin: { description: 'First possible generation date (YYYY-MM-DD)' },
    },
    {
      name: 'endDate',
      type: 'text',
      admin: { description: 'Stop generating after this date (optional)' },
    },
    {
      name: 'nextRunDate',
      type: 'text',
      required: true,
      admin: { description: 'When the next invoice will be generated' },
    },
    {
      name: 'lastRunDate',
      type: 'text',
      admin: { description: 'When the last invoice was generated' },
    },
    {
      name: 'lastDocId',
      type: 'number',
      admin: { description: 'ID of the last generated document' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'active',
    },
    {
      name: 'generatedCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    },
  ],
  endpoints: [
    {
      // Generate a document NOW from a schedule (manual run).
      path: '/:id/run-now',
      method: 'post',
      handler: async (req) => {
        if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = req.routeParams?.id as string
        if (!id) {
          return Response.json({ error: 'Missing schedule id' }, { status: 400 })
        }
        try {
          const result = await generateFromSchedule(req, id)
          return Response.json(result)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed'
          return Response.json({ error: message }, { status: 400 })
        }
      },
    },
    {
      // Cron tick: find all active schedules due today and generate.
      // Protected by CRON_SECRET header for server-side cron jobs.
      path: '/tick',
      method: 'post',
      handler: async (req) => {
        // Check for cron secret or admin user
        const authHeader = req.headers?.get?.('authorization') || ''
        const cronSecret = process.env.CRON_SECRET
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
          // cron auth — proceed
        } else if (!isBillingReq(req)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const t = today()
          const due = await req.payload.find({
            collection: 'recurring-schedules',
            where: {
              and: [
                { status: { equals: 'active' } },
                { nextRunDate: { less_than_equal: t } },
              ],
            },
            limit: 100,
            depth: 0,
          })
          const results: { id: string; name: string; docId: number | null; error?: string }[] = []
          for (const schedule of due.docs as any[]) {
            try {
              const gen = await generateFromSchedule(req, String(schedule.id))
              results.push({ id: String(schedule.id), name: schedule.name, docId: gen.docId })
            } catch (err) {
              results.push({
                id: String(schedule.id),
                name: schedule.name,
                docId: null,
                error: err instanceof Error ? err.message : 'Failed',
              })
            }
          }
          return Response.json({
            tickedAt: new Date().toISOString(),
            dueCount: due.docs.length,
            results,
          })
        } catch (err) {
          return Response.json({ error: (err as Error).message || 'Tick failed' }, { status: 500 })
        }
      },
    },
  ],
}

/** Core logic: generate a document from a recurring schedule. */
async function generateFromSchedule(
  req: PayloadRequest,
  scheduleId: string,
): Promise<{ docId: number; number: string; netTotal: number; grossTotal: number }> {
  const schedule = (await req.payload.findByID({
    collection: 'recurring-schedules',
    id: scheduleId,
    depth: 1,
  })) as any
  if (!schedule) throw new Error('Schedule not found')
  if (schedule.status !== 'active') throw new Error('Schedule is not active')

  const t = today()
  if (schedule.endDate && t > schedule.endDate) {
    // Past end date — mark completed
    await req.payload.update({
      collection: 'recurring-schedules',
      id: schedule.id,
      data: { status: 'completed' },
    })
    throw new Error('Schedule has ended')
  }
  if (t < schedule.startDate) {
    throw new Error(`Schedule starts on ${schedule.startDate}`)
  }

  const pool = (req.payload.db as any).pool
  const tenantId = schedule.tenant
    ? (typeof schedule.tenant === 'object' ? schedule.tenant.id : schedule.tenant)
    : null

  // Resolve party ID
  const partyId = schedule.party
    ? (typeof schedule.party === 'object' ? schedule.party.id : schedule.party)
    : null

  // Compute totals from template lines
  const lines = Array.isArray(schedule.lines) ? schedule.lines : []
  let netTotal = 0
  for (const l of lines) {
    const qty = Number(l.qty) || 1
    const rate = Number(l.rate) || 0
    const amount = l.amount != null ? Number(l.amount) : qty * rate
    netTotal += amount
  }
  netTotal = Math.round(netTotal * 100) / 100
  const taxRate = Number(schedule.taxRate) || 0
  const taxTotal = Math.round((netTotal * taxRate) / 100 * 100) / 100
  const grossTotal = Math.round((netTotal + taxTotal) * 100) / 100

  // Create document via raw SQL
  const docType = schedule.docType || 'sales-invoice'
  const txn = await req.payload.db.beginTransaction()
  const txId = txn ?? undefined
  try {
    const inserted = await pool.query(
      `INSERT INTO documents
         (doc_type, date, party_id, narration, status, tax_rate,
          net_total, tax_total, gross_total, tenant_id,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, now(), now())
       RETURNING id`,
      [
        docType,
        t,
        partyId,
        schedule.narration || `Recurring: ${schedule.name}`,
        taxRate,
        netTotal,
        taxTotal,
        grossTotal,
        tenantId,
      ],
    )
    const docId: number = inserted.rows[0].id
    let order = 0
    for (const l of lines) {
      const qty = Number(l.qty) || 1
      const rate = Number(l.rate) || 0
      const amount = l.amount != null ? Number(l.amount) : qty * rate
      const itemId = l.item
        ? (typeof l.item === 'object' ? l.item.id : l.item)
        : null
      await pool.query(
        `INSERT INTO documents_lines
           (_order, _parent_id, id, description, qty, rate, amount, item_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [order++, docId, `line-${docId}-${order}`, l.description || null, qty, rate, amount, itemId],
      )
    }
    if (txId) await req.payload.db.commitTransaction(txId)

    // Update schedule
    const nextDate = advanceDate(t, schedule.frequency, schedule.dayOfMonth)
    await req.payload.update({
      collection: 'recurring-schedules',
      id: schedule.id,
      data: {
        lastRunDate: t,
        lastDocId: docId,
        nextRunDate: nextDate,
        generatedCount: (schedule.generatedCount || 0) + 1,
      },
    })

    return { docId, number: `${docType}-${docId}`, netTotal, grossTotal }
  } catch (err) {
    try { if (txId) await req.payload.db.rollbackTransaction(txId) } catch { /* */ }
    throw err
  }
}
