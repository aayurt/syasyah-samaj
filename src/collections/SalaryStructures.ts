import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const SalaryStructures: CollectionConfig = {
  slug: 'salary-structures',
  labels: { singular: 'Salary Structure', plural: 'Salary Structures' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'label',
      'company',
      'currency',
      'payrollFrequency',
      'isDefault',
      'isActive',
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
      admin: { description: 'Structure name, e.g. Accountant — Monthly Fixed' },
    },
    {
      name: 'description',
      type: 'text',
      admin: { description: 'Optional notes' },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { description: 'Tenants in this app serve as companies for payroll' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'INR',
      admin: { description: 'Currency code' },
    },
    {
      name: 'letterHead',
      type: 'text',
      admin: { description: 'Letterhead reference (reserved for parity)' },
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
      name: 'salarySlipBasedOnTimesheet',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Use timesheet-based payroll' },
    },
    {
      name: 'timesheetSalaryComponent',
      type: 'relationship',
      relationTo: 'salary-components',
      admin: { description: 'Component used for timesheet-based pay' },
    },
    {
      name: 'hourlyRateComponent',
      type: 'relationship',
      relationTo: 'salary-components',
      admin: { description: 'Hourly-rate component when used' },
    },
    {
      name: 'hourlyRateAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Hourly rate fallback when no component set' },
    },
    {
      name: 'leaveEncashmentAmountPerDay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Encashment rate per day' },
    },
    {
      name: 'maxBenefits',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Maximum benefits amount' },
    },
    {
      name: 'modeOfPayment',
      type: 'text',
      admin: { description: 'Payment mode reference (reserved for parity)' },
    },
    {
      name: 'paymentAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Default payment account used by this structure' },
    },

    // Earnings child table (Salary Detail)
    {
      name: 'earnings',
      type: 'array',
      admin: { description: 'Earning components for this structure' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components', required: true },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'amountBasedOnFormula', type: 'checkbox', defaultValue: false },
        { name: 'formula', type: 'text' },
        { name: 'condition', type: 'text' },
        { name: 'dependsOnPaymentDays', type: 'checkbox', defaultValue: false },
        { name: 'isTaxApplicable', type: 'checkbox', defaultValue: true },
        { name: 'exemptedFromIncomeTax', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInTotal', type: 'checkbox', defaultValue: false },
        { name: 'statisticalComponent', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInAccounts', type: 'checkbox', defaultValue: false },
      ],
    },

    // Deductions child table (Salary Detail)
    {
      name: 'deductions',
      type: 'array',
      admin: { description: 'Deduction components for this structure' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components', required: true },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'amountBasedOnFormula', type: 'checkbox', defaultValue: false },
        { name: 'formula', type: 'text' },
        { name: 'condition', type: 'text' },
        { name: 'dependsOnPaymentDays', type: 'checkbox', defaultValue: false },
        { name: 'isTaxApplicable', type: 'checkbox', defaultValue: true },
        { name: 'doNotIncludeInAccounts', type: 'checkbox', defaultValue: false },
      ],
    },

    // Employer contributions child table (Salary Detail)
    {
      name: 'employerContributions',
      type: 'array',
      admin: { description: 'Employer contribution components for this structure' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components', required: true },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'amountBasedOnFormula', type: 'checkbox', defaultValue: false },
        { name: 'formula', type: 'text' },
        { name: 'condition', type: 'text' },
        { name: 'dependsOnPaymentDays', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInTotal', type: 'checkbox', defaultValue: false },
        { name: 'doNotIncludeInAccounts', type: 'checkbox', defaultValue: false },
      ],
    },

    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Only active structures are assignable' },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Default structure for the company' },
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
