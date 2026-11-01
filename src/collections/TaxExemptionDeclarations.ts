import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const TaxExemptionDeclarations: CollectionConfig = {
  slug: 'tax-exemption-declarations',
  labels: { singular: 'Tax Exemption Declaration', plural: 'Tax Exemption Declarations' },
  admin: {
    useAsTitle: 'title',
    group: 'Payroll',
    defaultColumns: [
      'title',
      'employee',
      'employeeName',
      'incomeYear',
      'declarationDate',
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
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Declaration title, e.g. EMP-001 — 2026-27 Declaration' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee this declaration belongs to' },
    },
    {
      name: 'employeeName',
      type: 'text',
      admin: { description: 'Snapshot of employee name at declaration time' },
    },
    {
      name: 'incomeYear',
      type: 'text',
      required: true,
      admin: { description: 'Income year, e.g. 2026-27' },
    },
    {
      name: 'declarationDate',
      type: 'date',
      required: true,
      admin: { description: 'Declaration date' },
    },
    {
      name: 'submitDate',
      type: 'date',
      admin: { description: 'Submission date' },
    },
    {
      name: 'submitFor',
      type: 'select',
      options: [
        { label: 'ITR Filing', value: 'ITR Filing' },
        { label: 'Tax Exemption', value: 'Tax Exemption' },
      ],
      admin: { description: 'Submit for' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Draft',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Submitted', value: 'Submitted' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Rejected', value: 'Rejected' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
    },
    {
      name: 'deductions',
      type: 'array',
      admin: { description: 'Deduction declaration lines' },
      fields: [
        {
          name: 'deductionType',
          type: 'select',
          options: [
            { label: 'Section 80C', value: 'Section 80C' },
            { label: 'Section 80D', value: 'Section 80D' },
            { label: 'Section 80E', value: 'Section 80E' },
            { label: 'Section 80G', value: 'Section 80G' },
            { label: 'Section 80GG', value: 'Section 80GG' },
            { label: 'Section 80CCD(1B)', value: 'Section 80CCD(1B)' },
            { label: 'Section 80CCD(2)', value: 'Section 80CCD(2)' },
            { label: 'Section 80TTA', value: 'Section 80TTA' },
            { label: 'Section 80TTB', value: 'Section 80TTB' },
            { label: 'Other', value: 'Other' },
          ],
        },
        { name: 'description', type: 'text' },
        { name: 'amount', type: 'number', defaultValue: 0 },
        { name: 'proofAttached', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'totalDeduction',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total deduction amount' },
    },
    {
      name: 'notes',
      type: 'text',
      admin: { description: 'Notes for this declaration' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who created this declaration' },
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who approved this declaration' },
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
