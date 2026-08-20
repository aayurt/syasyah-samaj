import { isAdmin } from '@/access/admin'
import type { GlobalConfig } from 'payload'

/**
 * Singleton settings for the billing module.
 *
 * The posting engine resolves every leg of a voucher's posting rule through
 * these default accounts. If a needed account is missing the engine refuses
 * to post with a clear message (no silent wrong postings).
 */
export const BillingSettings: GlobalConfig = {
  slug: 'billing-settings',
  label: 'Billing Settings',
  admin: {
    group: 'Billing',
    description:
      'Default accounts used when posting vouchers. Missing accounts block posting until configured.',
  },
  access: {
    // Calendar settings are not sensitive — any logged-in user (or the SPA
    // before session is established) must be able to read them so dates render
    // in the correct calendar type.
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      type: 'group',
      label: 'Calendar',
      fields: [
        {
          name: 'calendarType',
          type: 'select',
          defaultValue: 'BS',
          options: [
            { label: 'AD (Gregorian)', value: 'AD' },
            { label: 'BS (Bikram Sambat)', value: 'BS' },
          ],
          admin: { description: 'Calendar type for date display across the app.' },
        },
        {
          name: 'dateFormat',
          type: 'text',
          defaultValue: 'YYYY-MM-DD',
          admin: {
            description: 'Date format: YYYY-MM-DD, DD/MM/YYYY, YYYY/MM/DD, MMMM DD YYYY, etc.',
          },
        },
        {
          name: 'timeFormat',
          type: 'select',
          defaultValue: '12h',
          options: [
            { label: '12-hour (1:30 PM)', value: '12h' },
            { label: '24-hour (13:30)', value: '24h' },
          ],
          admin: { description: 'Time display format.' },
        },
      ],
    },
    {
      name: 'fiscalYearStart',
      type: 'date',
      admin: {
        description:
          'Month and day the fiscal year begins (e.g. 2026-07-16). Unset = calendar year.',
      },
    },
    {
      name: 'freezeDate',
      type: 'date',
      admin: {
        description:
          'No entries may be posted with a date before this date (period close). Unset = no freeze.',
      },
    },
    {
      type: 'collapsible',
      label: 'Default accounts',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'receivableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Accounts Receivable (sales invoices, receipts).' },
        },
        {
          name: 'payableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Accounts Payable (purchase invoices, payments).' },
        },
        {
          name: 'revenueAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Sales / service revenue.' },
        },
        {
          name: 'expenseAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Purchases / operating expenses.' },
        },
        {
          name: 'taxAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Output (sales) / input (purchase) VAT.' },
        },
        {
          name: 'cashAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cash on hand (payment/receipt vouchers, petty cash).' },
        },
        {
          name: 'bankAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Default bank account (payment/receipt vouchers).' },
        },
        {
          name: 'pettyCashAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Petty cash float (petty cash vouchers).' },
        },
        {
          name: 'membershipFeeAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Membership fee income account (membership receipts).' },
        },
        {
          name: 'donationAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Donation income account (donation receipts).' },
        },
        {
          name: 'inventoryAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Stock on hand (GRN, delivery challans).' },
        },
        {
          name: 'cogsAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Cost of goods sold (delivery challans).' },
        },
        {
          name: 'returnsAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Sales returns / purchase returns (credit & debit notes).' },
        },
        {
          name: 'accruedPayableAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Accrued / unbilled purchases (GRN).' },
        },
        {
          name: 'depreciationAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Depreciation expense (asset management).' },
        },
        {
          name: 'accumulatedDepreciationAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Accumulated depreciation contra-asset (asset management).' },
        },
      ],
    },
  ],
}
