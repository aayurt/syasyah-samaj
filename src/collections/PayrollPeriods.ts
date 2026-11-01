import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const PayrollPeriods: CollectionConfig = {
  slug: 'payroll-periods',
  labels: { singular: 'Payroll Period', plural: 'Payroll Periods' },
  admin: {
    useAsTitle: 'period',
    group: 'Payroll',
    defaultColumns: [
      'period',
      'company',
      'startDate',
      'endDate',
      'payrollFrequency',
      'active',
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
      name: 'period',
      type: 'text',
      required: true,
      admin: { description: 'Payroll period, e.g. 2026-09' },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { description: 'Company this payroll period belongs to' },
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: { description: 'Period start date' },
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: { description: 'Period end date' },
    },
    {
      name: 'payrollFrequency',
      type: 'select',
      defaultValue: 'Monthly',
      options: [
        { label: 'Monthly', value: 'Monthly' },
        { label: 'Fortnightly', value: 'Fortnightly' },
        { label: 'Bimonthly', value: 'Bimonthly' },
        { label: 'Weekly', value: 'Weekly' },
        { label: 'Daily', value: 'Daily' },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Active payroll period' },
    },
    {
      name: 'isDraft',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Is draft' },
    },
    {
      name: 'isSubmit',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Is submitted' },
    },
    {
      name: 'docStatus',
      type: 'select',
      defaultValue: 'Draft',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Submitted', value: 'Submitted' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
      admin: { description: 'Document status' },
    },
    {
      name: 'payroll_entry',
      type: 'relationship',
      relationTo: 'payroll-runs',
      admin: { description: 'Payroll run created for this period' },
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
