import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const PayrollComponentAccounts: CollectionConfig = {
  slug: 'payroll-component-accounts',
  labels: { singular: 'Payroll Component Account', plural: 'Payroll Component Accounts' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'label',
      'company',
      'salaryComponent',
      'account',
      'expenseAccount',
      'liabilityAccount',
      'updatedAt',
    ],
  },
  access: {
    create: isAdmin,
    read: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [assignTenant],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'Label, e.g. Basic — Account' },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { description: 'Company this component account belongs to' },
    },
    {
      name: 'salaryComponent',
      type: 'relationship',
      relationTo: 'salary-components',
      required: true,
      admin: { description: 'Salary component this account mapping belongs to' },
    },
    {
      name: 'account',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Earning/deduction GL account' },
    },
    {
      name: 'expenseAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Expense account for employer contributions' },
    },
    {
      name: 'liabilityAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Liability account for employer accrual' },
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
      admin: { description: 'Fiscal year this document belongs to (Frappe HR-style annual payroll period)' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
}
