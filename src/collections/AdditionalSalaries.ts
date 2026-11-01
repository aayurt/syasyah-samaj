import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const AdditionalSalaries: CollectionConfig = {
  slug: 'additional-salaries',
  labels: { singular: 'Additional Salary', plural: 'Additional Salaries' },
  admin: {
    useAsTitle: 'description',
    group: 'Payroll',
    defaultColumns: [
      'description',
      'employee',
      'type',
      'component',
      'amount',
      'payrollFrequency',
      'status',
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
      name: 'description',
      type: 'text',
      required: true,
      admin: { description: 'Description of the additional salary entry' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee this additional salary belongs to' },
    },
    {
      name: 'salaryStructureAssignment',
      type: 'relationship',
      relationTo: 'salary-structure-assignments',
      admin: { description: 'Assignment this additional salary is linked to' },
    },
    {
      name: 'component',
      type: 'relationship',
      relationTo: 'salary-components',
      admin: { description: 'Component used for this entry' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Earning', value: 'Earning' },
        { label: 'Deduction', value: 'Deduction' },
        { label: 'Flex Benefit', value: 'Flex Benefit' },
      ],
      admin: { description: 'Type of additional salary' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Amount for this entry' },
    },
    {
      name: 'payrollFrequency',
      type: 'select',
      defaultValue: 'Once',
      options: [
        { label: 'Once', value: 'Once' },
        { label: 'Monthly', value: 'Monthly' },
        { label: 'Yearly', value: 'Yearly' },
      ],
    },
    {
      name: 'isRecurring',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Recurring additional salary' },
    },
    {
      name: 'repeatEvery',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Repeat every N periods' },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: { description: 'Start date for recurring' },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'End date for recurring' },
    },
    {
      name: 'reference',
      type: 'text',
      admin: { description: 'Reference, e.g. advance/loan reference' },
    },
    {
      name: 'isTaxApplicable',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Include in taxable income' },
    },
    {
      name: 'isPayable',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Include in payable' },
    },
    {
      name: 'isRecoverable',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Recoverable (advance/loan recovery)' },
    },
    {
      name: 'isEffectedThroughPayroll',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Effected through payroll' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Active',
      options: [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who created this entry' },
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
