import { isAdmin } from '@/access/admin'
import { LWF_STATE_CONFIG, STATE_PT_CONFIG } from '@/utilities/indiaPayroll'
import type { GlobalConfig } from 'payload'

/** Employment states that have Professional Tax and/or LWF rules. */
const STATES = Array.from(
  new Set([...Object.keys(STATE_PT_CONFIG), ...Object.keys(LWF_STATE_CONFIG)]),
)
  .sort()
  .map((name) => ({ label: name, value: name }))

export const PayrollSettings: GlobalConfig = {
  slug: 'payroll-settings',
  label: 'Payroll Settings',
  admin: {
    group: 'Billing',
    description:
      'Indian statutory payroll (EPF, ESIC, Professional Tax, LWF, TDS). Enable a scheme to apply it when generating payroll runs.',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'group',
      label: 'Statutes',
      fields: [
        {
          name: 'epfEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Employees’ Provident Fund — 12 % of PF wage (Basic + DA), capped at the statutory ceiling (₹15,000 → ₹25,000 from 17 Sep 2026). Employer EPF/EPS/EDLI/admin are accrued as employer contributions.',
          },
        },
        {
          name: 'esicEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Employee State Insurance — 0.75 % employee / 3.25 % employer on ESI wage when gross ≤ ₹21,000 (₹25,000 for PwD).',
          },
        },
        {
          name: 'professionalTaxEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'State Professional Tax — deducted per the employment state’s slabs (monthly, half-yearly or yearly with cumulative adjustment).',
          },
        },
        {
          name: 'lwfEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Labour Welfare Fund — employee + employer amounts per the employment state’s frequency (monthly, June+December, or December only).',
          },
        },
        {
          name: 'tdsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'TDS on salary — monthly instalment of the projected annual tax (new or old regime, standard deduction, 87A rebate, surcharge + marginal relief, 4 % cess).',
          },
        },
      ],
    },
    {
      type: 'group',
      label: 'Registration & defaults',
      fields: [
        {
          name: 'pfNumber',
          type: 'text',
          admin: { description: 'EPF establishment account number (prints on the PF register / ECR).' },
        },
        {
          name: 'esiNumber',
          type: 'text',
          admin: { description: 'ESIC registration number (prints on the ESIC register).' },
        },
        {
          name: 'lwfNumber',
          type: 'text',
          admin: { description: 'Labour Welfare Fund number (prints on the LWF register).' },
        },
        {
          name: 'defaultEmploymentState',
          type: 'select',
          options: STATES,
          admin: {
            description:
              'Used for employees without an employment state — PT slabs and LWF frequency follow it.',
          },
        },
      ],
    },
    {
      type: 'group',
      label: 'Accounts',
      fields: [
        {
          name: 'epfPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr employee + employer EPF share (falls back to Accrued Payables).' },
        },
        {
          name: 'epsPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr employer EPS (pension) 8.33 % (falls back to EPF payable).' },
        },
        {
          name: 'edliPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr EDLI 0.5 % + EPF admin 0.5 % (falls back to EPF payable).' },
        },
        {
          name: 'esicPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr ESI employee + employer shares (falls back to Accrued Payables).' },
        },
        {
          name: 'ptPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr Professional Tax deducted (falls back to Accrued Payables).' },
        },
        {
          name: 'lwfPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr LWF employee + employer shares (falls back to Accrued Payables).' },
        },
        {
          name: 'tdsPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr TDS withheld (falls back to Accrued Payables).' },
        },
        {
          name: 'statutoryExpenseAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: {
            description:
              'Dr employer statutory contributions (EPF/EPS/EDLI/admin, ESI employer, LWF employer). Falls back to the salary expense account.',
          },
        },
      ],
    },
  ],
}
