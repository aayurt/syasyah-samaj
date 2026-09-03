import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { assignTenant } from '@/utilities/tenantScope'
import { extractID } from '@/utilities/extractID'
import { adYearLabel } from './bsYear'

/**
 * Fiscal years for the billing module (Manager.io-style).
 *
 * Each year has a label (e.g. "2083-84"), a start and end date, and a
 * status: `active` (editable) or `closed` (read-only — no new/edited
 * postings). Exactly one year per tenant is flagged `isActive` — that is
 * the "working year" used for voucher numbering and new entries.
 *
 * Selecting a fiscal year in the SPA filters the data shown to that year's
 * date range; closed years are viewable but not editable.
 */

/** Auto-generate a fallback label from the start date when the SPA didn't
 * supply one. The SPA sends the proper BS label (e.g. "2083-84"); this is
 * only used when a year is created from the Payload admin without a label. */
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
      async ({ data, req }) => {
        const d = data as any
        if (!d) return data

        // Auto-generate a fallback label from the start date if not supplied.
        if (!d.label && d.startDate) {
          d.label = fallbackLabel(d.startDate)
        }
        if (d.startDate && d.endDate && new Date(d.endDate) <= new Date(d.startDate)) {
          throw new Error('Fiscal year end date must be after the start date.')
        }
        if (!d.label) {
          throw new Error('Fiscal year needs a label (or a start date to generate one).')
        }

        // Only one active (working) year per tenant: unflag any other years
        // when this one is being set as active. `isActive` marks the year the
        // SPA defaults to; `status` controls editability.
        if (d.isActive) {
          const tenantRef = d.tenant ?? (req as PayloadRequest).user?.tenants?.[0]?.tenant
          const tenantId = tenantRef != null ? extractID(tenantRef) : undefined
          try {
            await req.payload.update({
              collection: 'fiscal-years',
              where: {
                and: [
                  { isActive: { equals: true } },
                  ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
                ],
              },
              data: { isActive: false },
              overrideAccess: true,
              depth: 0,
            } as any)
          } catch {
            // best-effort — the unique-ish invariant is a UX nicety
          }
        }
        return data
      },
    ],
  },
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