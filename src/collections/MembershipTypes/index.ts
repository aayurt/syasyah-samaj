import { isAdmin } from '@/access/admin'
import type { CollectionConfig } from 'payload'

/**
 * P2 org-wide membership categories. A new illaka clones these when it is
 * created; illakas can add their own types but cannot edit the org-wide
 * definitions. Fees set here apply org-wide unless an illaka overrides.
 */
export const MembershipTypes: CollectionConfig = {
  slug: 'membership-types',
  labels: { singular: 'Membership Type', plural: 'Membership Types' },
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
    read: () => true, // publicly readable so the SPA can list types
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'fee',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'Annual fee in NPR' },
    },
    {
      name: 'periodMonths',
      type: 'number',
      defaultValue: 12,
      min: 1,
      admin: { description: 'Membership period in months (default 12 = annual)' },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
