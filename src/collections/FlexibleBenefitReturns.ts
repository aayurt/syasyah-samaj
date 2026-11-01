import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const FlexibleBenefitReturns: CollectionConfig = {
  slug: 'flexible-benefit-returns',
  labels: { singular: 'Flexible Benefit Return', plural: 'Flexible Benefit Returns' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'label',
      'employee',
      'salaryStructureAssignment',
      'component',
      'amount',
      'returnType',
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
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'Flexible benefit return label' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee this flexible benefit return belongs to' },
    },
    {
      name: 'employeeName',
      type: 'text',
      admin: { description: 'Snapshot of employee name at return time' },
    },
    {
      name: 'salaryStructureAssignment',
      type: 'relationship',
      relationTo: 'salary-structure-assignments',
      admin: { description: 'Assignment this flexible benefit return is linked to' },
    },
    {
      name: 'component',
      type: 'relationship',
      relationTo: 'salary-components',
      admin: { description: 'Component this flexible benefit return belongs to' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Amount for this flexible benefit return' },
    },
    {
      name: 'returnType',
      type: 'select',
      options: [
        { label: 'Cash', value: 'Cash' },
        { label: 'Non-Cash', value: 'Non-Cash' },
      ],
      admin: { description: 'Return type' },
    },
    {
      name: 'description',
      type: 'text',
      admin: { description: 'Description of the flexible benefit return' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Active flexible benefit return' },
    },
    {
      name: 'retireOnDeclaration',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Retire on declaration' },
    },
    {
      name: 'declaration',
      type: 'relationship',
      relationTo: 'tax-exemption-declarations',
      admin: { description: 'Declaration this flexible benefit return is linked to' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who created this return' },
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
