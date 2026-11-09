import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

/**
 * Pay Groups — pay frequency definition (MONTHLY / WEEKLY / FORTNIGHTLY / FOUR_WEEKLY).
 *
 * A pay group ties a frequency to a fiscal year. Periods are auto-generated
 * per month (monthly) or per week block (weekly/fortnightly/four-weekly).
 * Each group exposes a `generate-periods` endpoint that creates
 * `payroll-periods` docs for every month of the fiscal year.
 *
 * Multi-tenant: every pay group carries `tenant`; access is scoped via
 * scopedCreate/Read/Update/Delete (central sees all, illaka sees own).
 */
export const PayGroups: CollectionConfig = {
  slug: 'pay-groups',
  labels: { singular: 'Pay Group', plural: 'Pay Groups' },
  admin: {
    useAsTitle: 'name',
    group: 'Payroll',
    defaultColumns: ['name', 'frequency', 'periodsPerYear', 'active', 'updatedAt'],
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
      ({ data }) => {
        const d = data as Record<string, unknown> | undefined
        if (!d) return data
        // Auto-set periods-per-year from frequency when not provided.
        if (!d.periodsPerYear && d.frequency) {
          const freq = String(d.frequency)
          d.periodsPerYear =
            freq === 'WEEKLY' ? 52 : freq === 'FORTNIGHTLY' ? 26 : freq === 'FOUR_WEEKLY' ? 13 : 12
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Pay group name, e.g. "Monthly Salary", "Weekly Wages"' },
    },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      defaultValue: 'MONTHLY',
      options: [
        { label: 'Monthly', value: 'MONTHLY' },
        { label: 'Weekly', value: 'WEEKLY' },
        { label: 'Fortnightly', value: 'FORTNIGHTLY' },
        { label: 'Four-Weekly', value: 'FOUR_WEEKLY' },
      ],
      admin: { description: 'Pay frequency determines how many periods per fiscal year.' },
    },
    {
      name: 'periodsPerYear',
      type: 'number',
      defaultValue: 12,
      min: 1,
      max: 52,
      admin: { description: 'Auto-derived from frequency; overrides allowed.' },
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
      admin: { description: 'Fiscal year this pay group generates periods for.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Inactive groups are excluded from period generation.' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
  endpoints: [
    {
      // POST /api/pay-groups/:id/generate-periods
      // Creates PayrollPeriods docs for every month of the fiscal year per frequency.
      path: '/:id/generate-periods',
      method: 'post',
      handler: async (req) => {
        if (!req.user || !scopedRead({ req })) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = req.params
        const { tenant, fiscalYearId } = (await req.json?.()) as {
          tenant?: number | string
          fiscalYearId?: number | string
        }

        if (!id || !fiscalYearId) {
          return Response.json({ error: 'id and fiscalYearId required' }, { status: 400 })
        }

        // Resolve the pay group doc to get frequency.
        const group = await req.payload.findByID({
          collection: 'pay-groups',
          id,
          depth: 0,
        })
        if (!group) {
          return Response.json({ error: 'Pay group not found' }, { status: 404 })
        }

        const freq = (group as any).frequency as string
        const periodsPerYear =
          freq === 'WEEKLY' ? 52 : freq === 'FORTNIGHTLY' ? 26 : freq === 'FOUR_WEEKLY' ? 13 : 12

        // Resolve fiscal year start/end.
        const fy = await req.payload.findByID({
          collection: 'fiscal-years',
          id: fiscalYearId,
          depth: 0,
        })
        if (!fy) {
          return Response.json({ error: 'Fiscal year not found' }, { status: 404 })
        }

        const startDate = new Date(String((fy as any).startDate))
        const endDate = new Date(String((fy as any).endDate))
        const tId = tenant ?? (group as any).tenant

        let created = 0
        let skipped = 0

        if (freq === 'MONTHLY') {
          // One period per calendar month within the fiscal year.
          let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
          while (cursor <= endDate) {
            const periodStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1))
            const periodEnd = new Date(
              Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0),
            )
            if (periodEnd > endDate) {
              periodEnd.setTime(endDate.getTime())
            }

            const exists = await req.payload.find({
              collection: 'payroll-periods',
              where: {
                and: [
                  { fiscalYear: { equals: fiscalYearId } },
                  { period: { equals: periodStart.toISOString().slice(0, 7) } },
                  ...(tId ? [{ tenant: { equals: tId } }] : []),
                ],
              },
              limit: 1,
              depth: 0,
            })
            if (exists.docs.length > 0) {
              skipped++
            } else {
              await req.payload.create({
                collection: 'payroll-periods',
                data: {
                  period: periodStart.toISOString().slice(0, 7),
                  startDate: periodStart.toISOString().slice(0, 10),
                  endDate: periodEnd.toISOString().slice(0, 10),
                  fiscalYear: fiscalYearId,
                  tenant: tId,
                },
                overrideAccess: false,
              })
              created++
            }

            cursor.setUTCMonth(cursor.getUTCMonth() + 1)
          }
        } else {
          // Weekly / fortnightly / four-weekly: fixed 7/14/28 day blocks.
          const stepDays = freq === 'WEEKLY' ? 7 : freq === 'FORTNIGHTLY' ? 14 : 28
          let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
          let n = 1
          while (cursor <= endDate && n <= periodsPerYear) {
            const periodStart = new Date(cursor.getTime())
            const periodEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + stepDays - 1))
            if (periodEnd > endDate) {
              periodEnd.setTime(endDate.getTime())
            }

            const periodLabel = `${(fy as any).label ?? ''} - ${freq === 'WEEKLY' ? 'Week' : freq === 'FORTNIGHTLY' ? 'Bi-Week' : 'Period'} ${n}`

            const exists = await req.payload.find({
              collection: 'payroll-periods',
              where: {
                and: [
                  { fiscalYear: { equals: fiscalYearId } },
                  { period: { equals: periodLabel } },
                  ...(tId ? [{ tenant: { equals: tId } }] : []),
                ],
              },
              limit: 1,
              depth: 0,
            })
            if (exists.docs.length > 0) {
              skipped++
            } else {
              await req.payload.create({
                collection: 'payroll-periods',
                data: {
                  period: periodLabel,
                  startDate: periodStart.toISOString().slice(0, 10),
                  endDate: periodEnd.toISOString().slice(0, 10),
                  fiscalYear: fiscalYearId,
                  tenant: tId,
                },
                overrideAccess: false,
              })
              created++
            }

            cursor.setUTCDate(cursor.getUTCDate() + stepDays)
            n++
          }
        }

        return Response.json({
          message: `Generated ${created} periods (skipped ${skipped} existing).`,
          created,
          skipped,
          frequency: freq,
          periodsPerYear,
        })
      },
    },
  ],
}
