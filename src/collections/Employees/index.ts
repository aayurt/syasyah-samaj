import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import { LWF_STATE_CONFIG, STATE_PT_CONFIG } from '@/utilities/indiaPayroll'
import type { CollectionConfig } from 'payload'

/** States with PT and/or LWF rules (union of both config tables). */
const EMPLOYMENT_STATES = Array.from(
  new Set([...Object.keys(STATE_PT_CONFIG), ...Object.keys(LWF_STATE_CONFIG)]),
)
  .sort()
  .map((name) => ({ label: name, value: name }))

/**
 * Employees — payroll roster master (MVP payroll).
 *
 * An employee carries the salary structure payroll runs compute from:
 *   gross = basicSalary + Σ allowances
 *   net   = gross − Σ deductions   (each deduction head may post to its own
 *                                   GL account — PF, TDS — falling back to
 *                                   Accrued Payables at posting time)
 *
 * Payroll runs snapshot these values per period; changing an employee here
 * never rewrites history of posted runs.
 */
export const Employees: CollectionConfig = {
  slug: 'employees',
  labels: { singular: 'Employee', plural: 'Employees' },
  admin: {
    useAsTitle: 'name',
    group: 'Billing',
    defaultColumns: ['employeeId', 'name', 'position', 'basicSalary', 'active', 'updatedAt'],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [assignTenant],
  },
  fields: [
    {
      name: 'employeeId',
      type: 'text',
      required: true,
      admin: { description: 'Payroll code, e.g. EMP-001' },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'position',
      type: 'text',
      admin: { description: 'Job title / role' },
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'pan',
      type: 'text',
      admin: { description: 'Tax PAN (for TDS withholding)' },
    },
    {
      name: 'bankName',
      type: 'text',
      admin: { description: 'Bank name for salary transfer' },
    },
    {
      name: 'bankAccountNumber',
      type: 'text',
      admin: { description: 'Bank account number (masked as needed)' },
    },
    {
      name: 'annualSalary',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Annual salary — per-period basic is derived from annual ÷ frequency divisor' },
    },
    {
      name: 'joiningDate',
      type: 'date',
      admin: { description: 'Date of joining — used for proration and completed-months calculations' },
    },
    {
      name: 'terminationDate',
      type: 'date',
      admin: { description: 'Date of leaving — employees with a termination date are excluded from runs after it' },
    },
    {
      name: 'employmentState',
      type: 'select',
      options: EMPLOYMENT_STATES,
      admin: {
        description:
          'Work state — drives Professional Tax slabs and LWF frequency (india-payroll). Falls back to the payroll setting default.',
      },
    },
    {
      name: 'uan',
      type: 'text',
      admin: { description: 'Universal Account Number (EPF member ID)' },
    },
    {
      name: 'esicNumber',
      type: 'text',
      admin: { description: 'ESIC IP number' },
    },
    {
      name: 'gender',
      type: 'select',
      options: [
        { label: 'Female', value: 'Female' },
        { label: 'Male', value: 'Male' },
        { label: 'Other', value: 'Other' },
      ],
      admin: { description: 'Needed for the Maharashtra women’s PT exemption' },
    },
    {
      name: 'taxRegime',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New regime', value: 'new' },
        { label: 'Old regime', value: 'old' },
      ],
      admin: { description: 'Income-tax regime used for the TDS projection' },
    },
    {
      name: 'epfApplicable',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Deduct employee EPF (12 % of PF wage) when EPF is enabled' },
    },
    {
      name: 'lwfExempt',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Manual exemption from LWF deduction' },
    },
    {
      name: 'vpfAmount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Voluntary Provident Fund — extra monthly employee contribution (₹)' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Inactive employees are excluded from payroll runs' },
    },
    {
      name: 'basicSalary',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Monthly basic salary' },
    },
    {
      name: 'allowances',
      type: 'array',
      admin: { description: 'Earnings added to basic (house, transport, …)' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, defaultValue: 0 },
      ],
    },
    {
      name: 'deductions',
      type: 'array',
      admin: { description: 'Deductions from gross (PF, TDS, advances, …)' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, defaultValue: 0 },
        {
          name: 'account',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Payable GL account; defaults to Accrued Payables when empty' },
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
