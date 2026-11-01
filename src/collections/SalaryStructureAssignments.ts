import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const SalaryStructureAssignments: CollectionConfig = {
  slug: 'salary-structure-assignments',
  labels: { singular: 'Salary Structure Assignment', plural: 'Salary Structure Assignments' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'employee',
      'salaryStructure',
      'fromDate',
      'base',
      'payrollPayableAccount',
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
      admin: { description: 'Readable assignment label, e.g. EMP-001 — Accountant — from 2026-01-01' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee receiving this pay structure' },
    },
    {
      name: 'salaryStructure',
      type: 'relationship',
      relationTo: 'salary-structures',
      required: true,
      admin: { description: 'Reused pay template' },
    },
    {
      name: 'fromDate',
      type: 'date',
      required: true,
      admin: { description: 'Effective start date; use a new assignment to change pay later' },
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { description: 'Company this assignment belongs to' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'INR',
    },
    {
      name: 'base',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Base pay used by the structure formulas' },
    },
    {
      name: 'variable',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Variable pay component' },
    },
    {
      name: 'annualGrossEarning',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Annual gross earning (computed in frappe)' },
    },
    {
      name: 'ctc',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Cost to company (computed in frappe)' },
    },
    {
      name: 'incomeTaxSlab',
      type: 'text',
      admin: { description: 'Income tax slab reference; this app uses taxRegime on Employee instead' },
    },
    {
      name: 'payrollPayableAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Payroll payable account for this assignment' },
    },
    {
      name: 'taxableEarningsTillDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Year-to-date taxable earnings for tax calculation' },
    },
    {
      name: 'taxDeductedTillDate',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Year-to-date tax deducted for tax calculation' },
    },
    {
      name: 'leaveEncashmentAmountPerDay',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'maxBenefits',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'employeeBenefits',
      type: 'array',
      admin: { description: 'Employee benefit details (parity with frappe)' },
      fields: [
        { name: 'component', type: 'relationship', relationTo: 'salary-components' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'description', type: 'text' },
      ],
    },

    // Cost center splits
    {
      name: 'costCenters',
      type: 'array',
      admin: { description: 'Cost center allocation rows' },
      fields: [
        { name: 'costCenter', type: 'text', admin: { description: 'Cost center code/name' } },
        { name: 'percentage', type: 'number', defaultValue: 100, min: 0, max: 100 },
      ],
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
