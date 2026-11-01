import { isAdmin } from '@/access/admin'
import { assignTenant } from '@/utilities/tenantScope'
import type { CollectionConfig } from 'payload'

export const PayrollRunEmployees: CollectionConfig = {
  slug: 'payroll-run-employees',
  labels: { singular: 'Payroll Run Employee', plural: 'Payroll Run Employees' },
  admin: {
    useAsTitle: 'label',
    group: 'Payroll',
    defaultColumns: [
      'label',
      'payrollRun',
      'employee',
      'employeeName',
      'base',
      'variable',
      'createPayrollSlip',
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
      name: 'label',
      type: 'text',
      required: true,
      admin: { description: 'Payroll run employee label' },
    },
    {
      name: 'payrollRun',
      type: 'relationship',
      relationTo: 'payroll-runs',
      required: true,
      admin: { description: 'Payroll run this employee detail belongs to' },
    },
    {
      name: 'employee',
      type: 'relationship',
      relationTo: 'employees',
      required: true,
      admin: { description: 'Employee this detail belongs to' },
    },
    {
      name: 'employeeName',
      type: 'text',
      admin: { description: 'Snapshot of employee name at detail time' },
    },
    {
      name: 'salaryStructureAssignment',
      type: 'relationship',
      relationTo: 'salary-structure-assignments',
      admin: { description: 'Assignment this detail is linked to' },
    },
    {
      name: 'base',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Base pay for this employee' },
    },
    {
      name: 'variable',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Variable pay for this employee' },
    },
    {
      name: 'createPayrollSlip',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Create payroll slip for this employee' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Active',
      options: [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' },
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
