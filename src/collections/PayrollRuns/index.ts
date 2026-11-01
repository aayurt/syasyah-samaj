import {
  scopedCreate,
  scopedDelete,
  scopedRead,
  scopedUpdate,
} from '@/access/tenantScoped'
import { assignTenant } from '@/utilities/tenantScope'
import { summarizePayroll, type PayrollRunLine } from '@/utilities/payrollCalc'
import type { CollectionConfig } from 'payload'
import { generatePayrollRun, postPayrollRun, voidPayrollRun } from './handlers'

/**
 * Payroll Runs (MVP payroll) — one document per pay period.
 *
 * Workflow: draft → posted → void
 *   - POST /payroll-runs/generate    draft run computed from the active roster
 *   - POST /payroll-runs/:id/post    posts the journal entry (transactional)
 *   - POST /payroll-runs/:id/void    voids run + journal entry
 *
 * `lines` is a per-employee snapshot (basic/allowances/deductions/net) taken
 * at generate time; totals are recomputed from the snapshot by beforeValidate
 * so the stored totals can never drift from the lines.
 */
export const PayrollRuns: CollectionConfig = {
  slug: 'payroll-runs',
  labels: { singular: 'Payroll Run', plural: 'Payroll Runs' },
  admin: {
    useAsTitle: 'runNumber',
    group: 'Billing',
    defaultColumns: ['runNumber', 'period', 'status', 'grossPay', 'netPay', 'payDate', 'updatedAt'],
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
          d.grossPay = totals.grossPay
          d.totalDeductions = totals.totalDeductions
          d.netPay = totals.netPay
        }
        if (!d.runNumber && typeof d.period === 'string' && d.period) {
          d.runNumber = `PR-${d.period}`
        }
        return data
      },
    ],
  },
  endpoints: [
    { path: '/generate', method: 'post', handler: generatePayrollRun },
    { path: '/:id/post', method: 'post', handler: postPayrollRun },
    { path: '/:id/void', method: 'post', handler: voidPayrollRun },
  ],
  fields: [
    {
      name: 'runNumber',
      type: 'text',
      required: true,
      admin: { description: 'PR-YYYY-MM', readOnly: true },
    },
    {
      name: 'period',
      type: 'text',
      required: true,
      admin: { description: 'Pay period (YYYY-MM)' },
    },
    {
      name: 'payDate',
      type: 'text',
      required: true,
      admin: { description: 'Pay date / journal date (YYYY-MM-DD)' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Posted', value: 'posted' },
        { label: 'Void', value: 'void' },
      ],
    },
    {
      name: 'lines',
      type: 'array',
      required: true,
      admin: { description: 'Per-employee snapshot for the period (server-computed)' },
      fields: [
        { name: 'employee', type: 'relationship', relationTo: 'employees' },
        { name: 'empCode', type: 'text', admin: { description: 'Employee code snapshot at run time' } },
        { name: 'name', type: 'text', required: true },
        { name: 'basic', type: 'number', defaultValue: 0 },
        {
          name: 'allowances',
          type: 'array',
          fields: [
            { name: 'label', type: 'text' },
            { name: 'amount', type: 'number', defaultValue: 0 },
          ],
        },
        { name: 'gross', type: 'number', defaultValue: 0 },
        {
          name: 'deductions',
          type: 'array',
          fields: [
            { name: 'label', type: 'text' },
            { name: 'amount', type: 'number', defaultValue: 0 },
            { name: 'account', type: 'relationship', relationTo: 'gl-accounts' },
          ],
        },
        { name: 'net', type: 'number', defaultValue: 0 },
        {
          name: 'statutory',
          type: 'json',
          admin: {
            description:
              'India-payroll snapshot (PF/ESI wages, EPF split, PT, LWF, TDS) — the statutory register reports read this',
          },
        },
      ],
    },
    {
      name: 'grossPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Auto-computed from lines', readOnly: true },
    },
    {
      name: 'totalDeductions',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Auto-computed from lines', readOnly: true },
    },
    {
      name: 'netPay',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Auto-computed from lines', readOnly: true },
    },
    {
      name: 'employerContributions',
      type: 'array',
      admin: {
        description:
          'Employer statutory contributions accrued on post (EPS, EPF, EDLI, ESI employer, LWF employer)',
      },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, defaultValue: 0 },
        { name: 'account', type: 'relationship', relationTo: 'gl-accounts' },
      ],
    },
    {
      name: 'expenseAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Dr Salaries expense (defaulted from global Expense)' },
    },
    {
      name: 'paymentAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Cr Cash/Bank for net pay (defaulted from global Cash)' },
    },
    {
      name: 'statutoryExpenseAccount',
      type: 'relationship',
      relationTo: 'gl-accounts',
      admin: { description: 'Dr employer statutory contributions (defaulted from Payroll Settings)' },
    },
    {
      name: 'journalEntry',
      type: 'number',
      admin: { description: 'Posted journal entry', readOnly: true },
    },
    { name: 'postedAt', type: 'text', admin: { readOnly: true } },
    { name: 'postedBy', type: 'text', admin: { readOnly: true } },
    { name: 'voidedAt', type: 'text', admin: { readOnly: true } },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
}
