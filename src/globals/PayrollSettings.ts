import { isAdmin } from '@/access/admin'
import { LWF_STATE_CONFIG, STATE_PT_CONFIG } from '@/utilities/indiaPayroll'
import type { GlobalConfig } from 'payload'

/** Employment states that have Professional Tax and/or LWF rules (India). */
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
      'Statutory payroll configuration. Choose the country scheme — India (EPF/ESIC/PT/LWF/TDS) or Nepal (SSF/PF/CIT) — then enable the statutes that apply.',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'group',
      label: 'Country',
      fields: [
        {
          name: 'country',
          type: 'select',
          defaultValue: 'Nepal',
          options: [
            { label: 'Nepal', value: 'Nepal' },
            { label: 'India', value: 'India' },
          ],
          admin: {
            description:
              'Statutory scheme. Nepal → SSF (11% employee + 11% employer), PF (10% employee), CIT slabs. India → EPF/ESIC/PT/LWF/TDS.',
          },
        },
      ],
    },
    {
      type: 'group',
      label: 'Nepal Statutes (SSF / PF / CIT)',
      fields: [
        {
          name: 'ssfEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              "Social Security Fund — 11 % employee + 11 % employer on basic salary (Nepal Labour Act). Applies when basic ≥ NPR 7,000 (subject to govt cap).",
          },
        },
        {
          name: 'pfEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              "Provident Fund — 10 % employee + 10 % employer on basic salary (Nepal). Falls back to SSF if both are enabled — SSF takes precedence.",
          },
        },
        {
          name: 'citEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Corporate/Individual Tax on salary — monthly instalment of projected annual tax (Nepal slabs: 1%/15%/25% with standard deduction and rebates).',
          },
        },
        {
          name: 'ssfRate',
          type: 'number',
          defaultValue: 11,
          min: 0,
          max: 100,
          admin: { description: 'SSF rate % (employee + employer each). Default 11%.' },
        },
        {
          name: 'pfRate',
          type: 'number',
          defaultValue: 10,
          min: 0,
          max: 100,
          admin: { description: 'PF rate % (employee + employer each). Default 10%.' },
        },
        {
          name: 'ssfMinBasic',
          type: 'number',
          defaultValue: 7000,
          min: 0,
          admin: { description: 'Minimum basic salary for SSF applicability (NPR).' },
        },
        {
          name: 'ssfNumber',
          type: 'text',
          admin: { description: 'SSF registration number (prints on the SSF register).' },
        },
        {
          name: 'pfNumber',
          type: 'text',
          admin: { description: 'PF/PF account number (prints on the PF register).' },
        },
        {
          name: 'panNumber',
          type: 'text',
          admin: { description: 'Company PAN for CIT withholding certificates.' },
        },
      ],
    },
    {
      type: 'group',
      label: 'India Statutes (EPF / ESIC / PT / LWF / TDS)',
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
          name: 'ssfPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr SSF employee + employer shares (falls back to Accrued Payables).' },
        },
        {
          name: 'pfPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr PF employee + employer shares (falls back to Accrued Payables).' },
        },
        {
          name: 'citPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cr CIT withheld (falls back to Accrued Payables).' },
        },
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
              'Dr employer statutory contributions (SSF/PF, EPF/EPS/EDLI/admin, ESI employer, LWF employer). Falls back to the salary expense account.',
          },
        },
      ],
    },
  ],
}
