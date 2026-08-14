import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

/**
 * Running sequence counters for voucher numbering, keyed by
 * `${docType}:${fiscalYear}`. The posting endpoint increments the counter
 * atomically (raw SQL upsert) so concurrent posts cannot reuse a number.
 */
export const DocSequences: CollectionConfig = {
  slug: 'doc-sequences',
  admin: {
    group: 'Billing',
    hidden: true,
  },
  access: {
    create: isAdmin,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'lastNumber',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
  ],
}
