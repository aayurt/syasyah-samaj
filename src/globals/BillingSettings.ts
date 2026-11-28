import { isAdmin } from '@/access/admin'
import { isSuperAdmin } from '@/access/isSuperAdmin'
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
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Enforce that only super-admin can toggle multiCompanyEnabled
        if (
          data &&
          'multiCompanyEnabled' in data &&
          originalDoc &&
          data.multiCompanyEnabled !== originalDoc.multiCompanyEnabled
        ) {
          if (!isSuperAdmin(req.user)) {
            data.multiCompanyEnabled = originalDoc.multiCompanyEnabled
          }
        }
        return data
      },
    ],
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
      name: 'activeFiscalYear',
      type: 'relationship',
      relationTo: 'fiscal-years',
      admin: {
        description:
          'The working fiscal year — drives voucher numbering and the period freeze. Manage years under Fiscal Years → Billing Settings → Fiscal Years.',
      },
    },
    // Legacy fields — kept for backward compatibility (existing deployments
    // and the pre-fiscal-years code path). New code resolves the fiscal year
    // from activeFiscalYear and falls back to these.
    {
      name: 'fiscalYearStart',
      type: 'date',
      admin: {
        description:
          '[Legacy] Month and day the fiscal year begins (e.g. 2026-07-16). Unset = calendar year.',
      },
    },
    {
      name: 'freezeDate',
      type: 'date',
      admin: {
        description:
          '[Legacy] No entries may be posted with a date before this date (period close). Unset = no freeze.',
      },
    },
    {
      type: 'group',
      label: 'Features',
      fields: [
        {
          name: 'payrollEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Enable the Payroll system (India Payroll). When disabled, payroll is hidden from the header system switcher and sidebar navigation.',
          },
        },
        {
          name: 'bankReconciliationEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Enable the bank reconciliation feature. When disabled, the Bank Reconciliation page is hidden from the sidebar.',
          },
        },
        {
          name: 'simplifiedInvoiceEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Show a simplified VAT-inclusive invoice for totals below the threshold. When off, always show the full tax breakdown.',
          },
        },
        {
          name: 'simplifiedInvoiceThreshold',
          type: 'number',
          defaultValue: 5000,
          admin: {
            description:
              'Amount threshold for simplified invoice (in Rs.). Invoices below this amount show as VAT Inclusive without breakdown.',
          },
        },
        {
          name: 'demoSeedEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Allow the demo-data seeder (Setup wizard / Data Management) to create sample charts, parties, items and draft vouchers. When off, the seed actions are rejected.',
          },
        },
        {
          name: 'nepaliDigitsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Display amounts with Nepali digits (०१२३) using Indian-style grouping (11,55,538) across the app.',
          },
        },
        {
          name: 'nepaliWordsOnPrintEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Show the amount-in-words line in Nepali words (रूपैयाँ/पैसा) on voucher previews and prints. When off, English words are used.',
          },
        },
        {
          name: 'multiCompanyEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Enable Multi-Company / Sub-Companies mode. When enabled, users can switch between companies and manage sub-companies. Only configurable by super-admin.',
          },
        },
        {
          name: 'transactionTypeToggles',
          type: 'group',
          label: 'Transaction Type Toggles',
          fields: [
            {
              name: 'receiptVoucherEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Receipt Voucher in new transaction form',
              },
            },
            {
              name: 'paymentVoucherEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Payment Voucher in new transaction form',
              },
            },
            {
              name: 'journalVoucherEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Journal Voucher in new transaction form',
              },
            },
            {
              name: 'contraVoucherEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Contra Voucher in new transaction form',
              },
            },
            {
              name: 'salesInvoiceEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Sales Invoice in new transaction form',
              },
            },
            {
              name: 'purchaseInvoiceEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Purchase Invoice in new transaction form',
              },
            },
            {
              name: 'creditNoteEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Credit Note in new transaction form',
              },
            },
            {
              name: 'debitNoteEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Debit Note in new transaction form',
              },
            },
            {
              name: 'grnEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Goods Received Note in new transaction form',
              },
            },
            {
              name: 'deliveryChallanEnabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Show/hide Delivery Challan in new transaction form',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'group',
      label: 'Company Profile',
      fields: [
        {
          name: 'companyName',
          type: 'text',
          admin: { description: 'Company or organization name shown on invoices and reports.' },
        },
        {
          name: 'companyPan',
          type: 'text',
          admin: { description: 'PAN (Permanent Account Number) for tax documents.' },
        },
        {
          name: 'companyContact',
          type: 'text',
          admin: { description: 'Primary contact phone number.' },
        },
        {
          name: 'companyEmail',
          type: 'email',
          admin: { description: 'Company email address.' },
        },
        {
          name: 'companyAddress',
          type: 'textarea',
          admin: { description: 'Registered address.' },
        },
        {
          name: 'companyLogo',
          type: 'text',
          admin: { description: 'URL or path to the company logo image.' },
        },
        {
          name: 'isProfitMaking',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Whether the organisation is profit-making (VAT applies to sales/purchase invoices). When off, VAT is excluded from sales & purchase modules.',
          },
        },
        {
          name: 'taxTypeEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            condition: (data: any) => data?.isProfitMaking === true,
            description:
              'Show tax type fields on invoices (only for profit-making organisations).',
          },
          validate: (args: any) => {
            if (args.data?.isProfitMaking === false) {
              return { error: 'Tax type is not applicable for non-profit organisations' }
            }
            return true
          },
        },
      ],
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
          name: 'cogsAccounts',
          type: 'array',
          fields: [
            {
              name: 'account',
              type: 'relationship',
              relationTo: 'gl-accounts',
            },
          ],
          admin: {
            description:
              'COGS accounts (P&L bucket). Falls back to cogsAccount when empty.',
          },
        },
        {
          name: 'interIllakaClearingAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: {
            description:
              'Inter-illaka transfer clearing account (balances transfer legs).',
          },
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
        {
          name: 'fixedAssetCostAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Fixed Asset at Cost control account (credited on disposal).' },
        },
        {
          name: 'disposalGainLossAccount',
          type: 'relationship',
          relationTo: 'gl-accounts',
          admin: { description: 'Gain/Loss on Disposal account (balancing figure on disposal).' },
        },
      ],
    },
    {
      name: 'defAccountOrder',
      type: 'json',
      admin: {
        description: 'User-defined order of default account posting roles in the Settings UI.',
      },
    },
    {
      name: 'dataEpoch',
      type: 'number',
      defaultValue: 0,
      admin: {
        hidden: true,
        description:
          'Bumped on every bulk data operation (cleanup, demo seed). Clients compare it and invalidate offline caches when it changes.',
      },
    },
  ],
}
