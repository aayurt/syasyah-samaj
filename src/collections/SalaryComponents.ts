import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const SalaryComponents: CollectionConfig = {
  slug: 'salary-components',
  labels: { singular: 'Salary Component', plural: 'Salary Components' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: ['label', 'abbr', 'type', 'account', 'expenseAccount', 'liabilityAccount', 'active'],
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
      admin: { description: 'Readable name, e.g. Basic, House Rent Allowance, Provident Fund' },
    },
    {
      name: 'abbr',
      type: 'text',
      required: true,
      admin: { description: 'Abbreviation used in formulas, e.g. BASIC, HRA, PF' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Earning', value: 'Earning' },
        { label: 'Deduction', value: 'Deduction' },
        { label: 'Employer Contribution', value: 'EmployerContribution' },
      ],
      admin: { description: 'Frappe HR doctype type' },
    },
    {
      name: 'condition',
      type: 'text',
      admin: { description: 'Optional Python-style condition string used by frappe; store for parity, evaluate locally if needed' },
    },
    {
      name: 'amount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Default component amount when no formula' },
    },
    {
      name: 'amountBasedOnFormula',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Amount is derived from a formula' },
    },
    {
      name: 'formula',
      type: 'text',
      admin: { description: 'Frappe formula string, e.g. base * 0.4, base + 2000' },
    },
    {
      name: 'dependsOnPaymentDays',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Pro-rate by payment days' },
    },
    {
      name: 'isTaxApplicable',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Include in taxable income' },
    },
    {
      name: 'exemptedFromIncomeTax',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Treat as exempt for income tax' },
    },
    {
      name: 'statisticalComponent',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Statistical only — no GL posting' },
    },
    {
      name: 'doNotIncludeInTotal',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'doNotIncludeInAccounts',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'removeIfZeroValued',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'variableBasedOnTaxableSalary',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'isFlexibleBenefit',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'accrualComponent',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Employer side accrual component' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'accounts',
      type: 'array',
      admin: { description: 'Per-company account mapping (Salary Component Account)' },
      fields: [
        { name: 'company', type: 'relationship', relationTo: 'tenants', required: true },
        {
          name: 'account',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Earning/deduction GL account for this component' },
        },
        {
          name: 'expenseAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Employer expense account (used by employer contributions)' },
        },
        {
          name: 'liabilityAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Employer liability account for accrual' },
        },
      ],
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
