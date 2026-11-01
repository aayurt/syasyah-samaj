import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const SalaryStructureFlexibleBenefits: CollectionConfig = {
  slug: 'salary-structure-flexible-benefits',
  labels: { singular: 'Salary Structure Flexible Benefit', plural: 'Salary Structure Flexible Benefits' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'label',
      'salaryStructure',
      'component',
      'amount',
      'baseAmount',
      'benefitAmount',
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
      admin: { description: 'Flexible benefit label, e.g. Health Insurance' },
    },
    {
      name: 'salaryStructure',
      type: 'relationship',
      relationTo: 'salary-structures',
      required: true,
      admin: { description: 'Salary structure this flexible benefit belongs to' },
    },
    {
      name: 'component',
      type: 'relationship',
      relationTo: 'salary-components',
      required: true,
      admin: { description: 'Component this flexible benefit belongs to' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Flexible benefit amount' },
    },
    {
      name: 'baseAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Base amount for this flexible benefit' },
    },
    {
      name: 'benefitAmount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Benefit amount for this flexible benefit' },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Flex Benefit', value: 'Flex Benefit' },
        { label: 'Flexible Benefit', value: 'Flexible Benefit' },
      ],
      admin: { description: 'Flexible benefit type' },
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
