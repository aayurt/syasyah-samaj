/** Shared AI workspace helpers — used by AIWorkspaceModal and the /ai page.
 * Pure functions only: field registration, enum options, example JSON, row labels.
 * No network, no AI provider.
 */

import type { AIModel } from './schemas'

export const NUMERIC_FIELDS = new Set(['openingBalance', 'amount', 'rate'])

export function fieldInputs(model: AIModel): string[] {
  switch (model) {
    case 'gl-accounts':
      return ['code', 'name', 'type', 'class', 'group', 'openingBalance', 'active']
    case 'opening-balances':
      return ['accountCode', 'accountName', 'fiscalYear', 'amount']
    case 'tax-types':
      return ['name', 'type', 'rate', 'active']
    case 'account-groups':
      return ['name', 'type', 'nature', 'active']
    case 'company-profile':
      return ['companyName', 'companyPan', 'companyContact', 'companyEmail', 'companyAddress']
    case 'sub-companies':
      return ['name', 'code', 'slug', 'active']
    case 'fiscal-year':
      return ['label', 'startDate', 'endDate', 'status']
    case 'members':
      return ['fullName', 'email', 'role', 'status']
    case 'parties':
      return ['name', 'type', 'email', 'phone']
    case 'items':
      return ['code', 'name', 'unit', 'salePrice', 'active']
    default:
      return ['name']
  }
}

export function enumOptions(model: AIModel, field: string): { label: string; value: string }[] {
  if (model === 'tax-types' && field === 'type') {
    return [
      { label: 'Sales', value: 'sales' },
      { label: 'Purchase', value: 'purchase' },
    ]
  }
  if (model === 'fiscal-year' && field === 'status') {
    return [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ]
  }
  if (model === 'members' && field === 'status') {
    return [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ]
  }
  if (model === 'members' && field === 'role') {
    return [
      { label: 'Admin', value: 'admin' },
      { label: 'Moderator', value: 'moderator' },
      { label: 'Member', value: 'member' },
      { label: 'VIP', value: 'vip' },
    ]
  }
  if (model === 'parties' && field === 'type') {
    return [
      { label: 'Customer', value: 'customer' },
      { label: 'Vendor', value: 'vendor' },
      { label: 'Both', value: 'both' },
    ]
  }
  if (field === 'type') {
    return ['asset', 'liability', 'equity', 'income', 'expense'].map((v) => ({
      label: v.charAt(0).toUpperCase() + v.slice(1),
      value: v,
    }))
  }
  if (field === 'class') {
    return ['cash', 'bank', 'receivable', 'payable', 'other'].map((v) => ({
      label: v.charAt(0).toUpperCase() + v.slice(1),
      value: v,
    }))
  }
  if (field === 'nature') {
    return [
      { label: 'Debit', value: 'debit' },
      { label: 'Credit', value: 'credit' },
    ]
  }
  if (field === 'active') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ]
  }
  return []
}

export function exampleJson(model: AIModel): string {
  switch (model) {
    case 'gl-accounts':
      return JSON.stringify(
        {
          docs: [
            {
              code: '1101',
              name: 'Cash on Hand',
              type: 'asset',
              class: 'cash',
              group: 'Bank & Cash',
              openingBalance: 50000,
              active: true,
            },
          ],
        },
        null,
        2,
      )
    case 'opening-balances':
      return JSON.stringify(
        { docs: [{ accountCode: '1101', accountName: 'Cash on Hand', fiscalYear: '2026-27', amount: 50000 }] },
        null,
        2,
      )
    case 'tax-types':
      return JSON.stringify({ docs: [{ name: 'VAT 13%', type: 'sales', rate: 13, active: true }] }, null, 2)
    case 'account-groups':
      return JSON.stringify(
        { docs: [{ name: 'Bank Accounts', type: 'asset', nature: 'debit', active: true }] },
        null,
        2,
      )
    case 'company-profile':
      return JSON.stringify(
        {
          docs: [
            {
              companyName: 'Syasyah Samaj',
              companyPan: '603774469',
              companyContact: '9851012345',
              companyEmail: 'info@syasyahsamaj.com.np',
              companyAddress: 'Yala, Lalitpur',
            },
          ],
        },
        null,
        2,
      )
    case 'sub-companies':
      return JSON.stringify(
        {
          docs: [
            { name: 'Kathmandu Illaka', code: 'KTM01', slug: 'kathmandu', active: true },
            { name: 'Lalitpur Illaka', code: 'LAL02', slug: 'lalitpur', active: true },
          ],
        },
        null,
        2,
      )
    case 'fiscal-year':
      return JSON.stringify(
        { docs: [{ label: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', status: 'active' }] },
        null,
        2,
      )
    case 'parties':
      return JSON.stringify(
        {
          docs: [
            { name: 'Example Customer', type: 'customer', email: 'customer@example.com', phone: '9841000001' },
            { name: 'Example Vendor', type: 'vendor', email: 'vendor@example.com', phone: '9841000002' },
          ],
        },
        null,
        2,
      )
    case 'items':
      return JSON.stringify(
        {
          docs: [
            { code: 'ITEM-001', name: 'Rice 25kg', unit: 'kg', salePrice: 1200, active: true },
            { code: 'ITEM-002', name: 'Lentils 1kg', unit: 'kg', salePrice: 180, active: true },
          ],
        },
        null,
        2,
      )
    case 'members':
      return JSON.stringify(
        {
          docs: [
            { fullName: 'Karma Shrestha', email: 'karma.shrestha@syasyahsamaj.com', role: 'moderator', status: 'active' },
            { fullName: 'Pema Shrestha', email: 'pema.shrestha@syasyahsamaj.com', role: 'member', status: 'active' },
          ],
        },
        null,
        2,
      )
    default:
      return JSON.stringify({ docs: [{ name: 'Bank Accounts', type: 'asset', nature: 'debit', active: true }] }, null, 2)
  }
}

export function docLabel(doc: Record<string, unknown>, model: AIModel): string {
  switch (model) {
    case 'company-profile':
      return String(doc.companyName ?? doc.name ?? '')
    case 'sub-companies':
      return String(doc.name ?? doc.code ?? '')
    case 'fiscal-year':
      return String(doc.label ?? doc.name ?? '')
    case 'tax-types':
      return String(doc.taxName ?? doc.name ?? '')
    case 'account-groups':
      return String(doc.groupName ?? doc.name ?? '')
    case 'members':
      return String(doc.fullName ?? doc.name ?? '')
    case 'opening-balances':
      return String(doc.accountCode ?? doc.code ?? '')
    default:
      return String(doc.accountCode ?? doc.name ?? doc.code ?? '')
  }
}
