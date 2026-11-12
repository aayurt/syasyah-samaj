import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { isBillingUser } from '@/access/tenantScoped'
import type { CollectionConfig } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'
import { extractID } from '@/utilities/extractID'
import { sumPostedByAccount } from '@/utilities/journalSums'
import { round2, toNum } from '@/utilities/journalValidation'
import { adYearLabel } from './bsYear'

/**
 * Fiscal years for the billing module.
 *
 * Each year has a label (e.g. "2083-84"), a start and end date, and a
 * status: `active` (editable) or `closed` (read-only). Exactly one year
 * per tenant is flagged `isActive` — the "working year" used for voucher
 * numbering and new entries.
 *
 * Defect fixes applied:
 * - [BUG-1] Date validation rejects invalid dates (e.g. 2082-03-32)
 * - [BUG-3] Only open fiscal years may be set as working year
 * - [BUG-4] Only one fiscal year can be active; clear user-facing messages
 * - [NEW]   Overlap detection prevents overlapping years per tenant
 * - [NEW]   Span validation warns if year is not ~365 days
 */

function fallbackLabel(adStart: string | Date): string {
  return adYearLabel(adStart)
}

export const FiscalYears: CollectionConfig = {
  slug: 'fiscal-years',
  labels: { singular: 'Fiscal Year', plural: 'Fiscal Years' },
  admin: {
    useAsTitle: 'label',
    group: 'Billing',
    defaultColumns: ['label', 'startDate', 'endDate', 'status', 'isActive', 'updatedAt'],
    description:
      'Accounting periods. Active years are editable; closed years are read-only.',
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [
      assignTenant,
      async ({ data, req, operation }) => {
        const d = data as any
        if (!d) return data

        // ── 1. Date validation (BUG-2 fix) ────────────────────────────
        // Reject invalid dates like 2082-03-32.
        if (d.startDate) {
          const sd = new Date(d.startDate)
          if (isNaN(sd.getTime())) {
            throw new Error(`Invalid start date "${d.startDate}". Please enter a valid date.`)
          }
          // Cross-check: the parsed date must round-trip to the same day
          const roundTrip = sd.toISOString().slice(0, 10)
          if (roundTrip !== String(d.startDate).slice(0, 10)) {
            throw new Error(`Invalid start date "${d.startDate}". Please enter a valid date.`)
          }
        }
        if (d.endDate) {
          const ed = new Date(d.endDate)
          if (isNaN(ed.getTime())) {
            throw new Error(`Invalid end date "${d.endDate}". Please enter a valid date.`)
          }
          const roundTrip = ed.toISOString().slice(0, 10)
          if (roundTrip !== String(d.endDate).slice(0, 10)) {
            throw new Error(`Invalid end date "${d.endDate}". Please enter a valid date.`)
          }
        }
        if (d.startDate && d.endDate) {
          const sd = new Date(d.startDate)
          const ed = new Date(d.endDate)
          if (ed <= sd) {
            throw new Error('Fiscal year end date must be after the start date.')
          }
          // Warn if the year span is outside the normal 12-month range
          const dayDiff = (ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)
          if (dayDiff < 300 || dayDiff > 400) {
            throw new Error(
              `Fiscal year span is ${Math.round(dayDiff)} days (expected ~365). Please verify the dates.`,
            )
          }
        }

        // ── 2. Auto-generate label ─────────────────────────────────────
        if (!d.label && d.startDate) {
          d.label = fallbackLabel(d.startDate)
        }
        if (!d.label) {
          throw new Error('Fiscal year needs a label (or a start date to generate one).')
        }

        // Resolve tenant
        const tenantRef = d.tenant ?? (req as any).user?.tenants?.[0]?.tenant
        const tenantId = tenantRef != null ? extractID(tenantRef) : undefined
        const tenantFilter = tenantId ? { tenant: { equals: tenantId } } : null

        // ── 3. BUG-3: Only open years may be the working year ─────────
        if (d.isActive && d.status === 'closed') {
          throw new Error(
            'Cannot set a closed fiscal year as the working year. ' +
            'Open the year first (set status to Active), then mark it as working.',
          )
        }

        // ── 4. BUG-4: Only one isActive per tenant ────────────────────
        if (d.isActive) {
          try {
            await req.payload.update({
              collection: 'fiscal-years',
              where: {
                and: [
                  { isActive: { equals: true } },
                  ...(tenantFilter ? [tenantFilter] : []),
                ],
              },
              data: { isActive: false },
              overrideAccess: true,
              depth: 0,
            } as any)
          } catch {
            // best-effort
          }
        }

        // ── 5. Only one open year per tenant ───────────────────────────
        if (d.status === 'active') {
          try {
            await req.payload.update({
              collection: 'fiscal-years',
              where: {
                and: [
                  { status: { equals: 'active' } },
                  ...(tenantFilter ? [tenantFilter] : []),
                ],
              },
              data: { status: 'closed' },
              overrideAccess: true,
              depth: 0,
            } as any)
          } catch {
            // best-effort
          }
        }

        // ── 6. Overlap detection ───────────────────────────────────────
        if (d.startDate && d.endDate && tenantId) {
          try {
            const overlaps = await req.payload.find({
              collection: 'fiscal-years',
              where: {
                and: [
                  { tenant: { equals: tenantId } },
                  { startDate: { less_than_equal: d.endDate } },
                  { endDate: { greater_than_equal: d.startDate } },
                ],
              },
              limit: 10,
              depth: 0,
            } as any)
            const existing = (overlaps.docs as any[]).filter(
              (fy) => String(fy.id) !== String(d.id),
            )
            if (existing.length > 0) {
              const labels = existing.map((fy) => fy.label).join(', ')
              throw new Error(
                `This fiscal year overlaps with existing year(s): ${labels}. ` +
                'Fiscal years cannot overlap within the same tenant.',
              )
            }
          } catch (err: any) {
            if (err?.message?.includes('overlaps')) throw err
          }
        }

        return data
      },
    ],
  },
  endpoints: [
    {
      // POST /api/fiscal-years/:id/close — close an open year and carry each
      // balance-sheet account's year-end balance forward as an opening
      // balance of the next year. Income/expense accounts are closed to zero.
      path: '/:id/close',
      method: 'post',
      handler: async (req) => {
        if (!isBillingUser(req.user)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const id = Number((req as any).params.id)
        const fy = await req.payload.findByID({
          collection: 'fiscal-years',
          id,
          depth: 0,
          overrideAccess: true,
        })
        if (!fy) {
          return Response.json({ error: 'Fiscal year not found.' }, { status: 404 })
        }
        if (fy.status === 'closed') {
          return Response.json({ error: 'This fiscal year is already closed.' }, { status: 400 })
        }
        const tenantId = typeof fy.tenant === 'object' ? fy.tenant.id : fy.tenant

        // The next period must exist to receive the carried balances.
        const dayAfter = new Date(new Date(fy.endDate).getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10)
        const nextRes = await req.payload.find({
          collection: 'fiscal-years',
          where: {
            and: [
              { tenant: { equals: tenantId } },
              { startDate: { equals: dayAfter } },
            ],
          },
          limit: 1,
          depth: 0,
        })
        const nextYear = nextRes.docs?.[0] as any
        if (!nextYear) {
          return Response.json(
            {
              error: `Create the next fiscal year first — it must start on ${dayAfter} (the day after ${fy.label || ''} ends).`,
            },
            { status: 400 },
          )
        }

        // Year-end position per account: opening balance for the closed year
        // (falling back to the account's one-time opening balance) plus
        // posted movements inside the period.
        const sums = await sumPostedByAccount(req.payload, {
          tenant: { equals: tenantId },
          date: { greater_than_equal: fy.startDate, less_than_equal: fy.endDate },
        })
        const obRes = await req.payload.find({
          collection: 'opening-balances',
          where: {
            and: [
              { fiscalYear: { equals: id } },
              { tenant: { equals: tenantId } },
            ],
          },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        const openingByAccount = new Map(
          (obRes.docs as any[]).map((d) => [Number(d.account), toNum(d.amount)]),
        )

        const acctRes = await req.payload.find({
          collection: 'gl-accounts',
          where: { tenant: { equals: tenantId } },
          limit: 1000,
          depth: 0,
        })
        const accounts = acctRes.docs as any[]

        const carry: { account: number; amount: number }[] = []
        for (const a of accounts) {
          // Nominal accounts are closed to zero — they start the new year empty.
          if (a.type === 'income' || a.type === 'expense') continue
          const s = sums.get(Number(a.id)) || { debit: 0, credit: 0 }
          // amount is debit-positive for every account type (universal
          // convention: liability/equity credit balances are negative).
          const balance = round2(
            (openingByAccount.get(Number(a.id)) ?? toNum(a.openingBalance)) +
              s.debit - s.credit,
          )
          if (Math.abs(balance) >= 0.01) {
            carry.push({ account: Number(a.id), amount: balance })
          }
        }

        // Replace the target year's opening balances (re-close is idempotent).
        const existing = await req.payload.find({
          collection: 'opening-balances',
          where: {
            and: [
              { fiscalYear: { equals: nextYear.id } },
              { tenant: { equals: tenantId } },
            ],
          },
          limit: 1000,
          depth: 0,
          overrideAccess: true,
        })
        for (const doc of existing.docs as any[]) {
          await req.payload.delete({
            collection: 'opening-balances',
            id: doc.id,
            overrideAccess: true,
          })
        }
        let saved = 0
        for (const c of carry) {
          await req.payload.create({
            collection: 'opening-balances',
            data: {
              account: c.account,
              fiscalYear: nextYear.id,
              amount: c.amount,
              tenant: tenantId,
            } as any,
            overrideAccess: true,
          })
          saved++
        }

        await req.payload.update({
          collection: 'fiscal-years',
          id,
          data: { status: 'closed' },
          overrideAccess: true,
        })

        return Response.json({
          message: `Year closed. ${saved} opening balance(s) carried forward to “${nextYear.label || nextYear.id}”.`,
          closed: { id: fy.id, label: fy.label, status: 'closed' },
          targetYear: { id: nextYear.id, label: nextYear.label },
          carriedForward: saved,
        })
      },
    },
  ],
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'Display label, e.g. "2083-84". Auto-generated from the start date if left empty.',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: { description: 'First day of the fiscal year (AD). Entered as BS in the SPA.' },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: { description: 'Last day of the fiscal year (AD).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active (editable)', value: 'active' },
        { label: 'Closed (read-only)', value: 'closed' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Active = entries may be posted. Closed = read-only; the posting engine refuses new entries in this period.',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description:
          'The working year for new entries and voucher numbering. Only one year can be active per tenant.',
      },
    },
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
