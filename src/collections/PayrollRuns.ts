import { scopedCreate, scopedDelete, scopedRead, scopedUpdate } from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import { summarizePayroll, type PayrollRunLine } from '@/utilities/payrollCalc'
import type { CollectionConfig } from 'payload'

export const PayrollRuns: CollectionConfig = {
  slug: 'payroll-runs',
  labels: { singular: 'Payroll Run', plural: 'Payroll Runs' },
  admin: {
    useAsTitle: 'name',
    group: 'Payroll',
    defaultColumns: [
      'name',
      'fiscalYear',
      'period',
      'postingDate',
      'status',
      'grossPay',
      'netPay',
      'updatedAt',
    ],
  },
  access: {
    create: scopedCreate,
    read: scopedRead,
    update: scopedUpdate,
    delete: scopedDelete,
  },
  hooks: {
    beforeValidate: [
      assignTenant,
      ({ data }) => {
        const d = data as Record<string, unknown> | undefined
        if (!d) return data
        if (Array.isArray(d.lines)) {
          const totals = summarizePayroll(d.lines as PayrollRunLine[])
          ;(d as any).grossPay = totals.grossPay
          ;(d as any).totalDeductions = totals.totalDeductions
          ;(d as any).netPay = totals.netPay
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Human-readable run name, e.g. September 2083 Payroll' },
    },
    {
      name: 'fiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      required: true,
      admin: { description: 'Fiscal year this payroll run belongs to (Frappe HR-style annual payroll period)' },
    },
    {
      name: 'period',
      type: 'text',
      required: true,
      admin: { description: 'Pay period, e.g. 2026-09' },
    },
    {
      name: 'postingDate',
      type: 'date',
      required: true,
      admin: { description: 'Posting date for the journal entry' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Draft',
      options: [
        { label: 'Draft', value: 'Draft' },
        { label: 'Submitted', value: 'Submitted' },
        { label: 'Paid', value: 'Paid' },
        { label: 'Cancelled', value: 'Cancelled' },
      ],
      admin: { description: 'Draft → Submitted (accrual) → Paid (payment) → Cancelled' },
    },
    {
      name: 'grossPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total gross pay (auto-computed from lines)' },
    },
    {
      name: 'totalDeductions',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total deductions (auto-computed from lines)' },
    },
    {
      name: 'netPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total net pay (auto-computed from lines)' },
    },
    {
      name: 'totalEmployerContributions',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total employer contributions (auto-computed)' },
    },
    {
      name: 'lines',
      type: 'array',
      admin: { description: 'Employees included in this payroll run (Frappe HR-style salary slip lines)' },
      fields: [
        {
          name: 'employee',
          type: 'relationship',
          relationTo: 'employees',
          required: true,
        },
        {
          name: 'employeeName',
          type: 'text',
          admin: { description: 'Snapshot of employee name at run time' },
        },
        {
          name: 'designation',
          type: 'text',
        },
        {
          name: 'department',
          type: 'text',
        },
        {
          name: 'base',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Basic salary for the period' },
        },
        {
          name: 'grossPay',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Gross pay for this employee' },
        },
        {
          name: 'totalDeductions',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Total deductions for this employee' },
        },
        {
          name: 'netPay',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Net pay for this employee' },
        },
        {
          name: 'salarySlip',
          type: 'relationship',
          relationTo: 'payroll-slips',
          admin: { description: 'Salary slip created for this employee in this run' },
        },
      ],
    },
    {
      name: 'salarySlips',
      type: 'array',
      admin: { description: 'Salary slips created from this payroll run' },
      fields: [
        {
          name: 'salarySlip',
          type: 'relationship',
          relationTo: 'payroll-slips',
          required: true,
        },
        {
          name: 'employee',
          type: 'relationship',
          relationTo: 'employees',
        },
        {
          name: 'netPay',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'Draft' },
            { label: 'Submitted', value: 'Submitted' },
            { label: 'Paid', value: 'Paid' },
            { label: 'Cancelled', value: 'Cancelled' },
          ],
        },
      ],
    },
    {
      name: 'journalEntry',
      type: 'relationship',
      relationTo: 'journal-entries',
      admin: { description: 'Journal entry created for accrual/payment' },
    },
    {
      name: 'paymentJournalEntry',
      type: 'relationship',
      relationTo: 'journal-entries',
      admin: { description: 'Journal entry created for payment' },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: { description: 'Date when payment was made' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who created this payroll run' },
    },
    {
      name: 'notes',
      type: 'text',
      admin: { description: 'Notes for this payroll run' },
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
