import { faker } from '@faker-js/faker'
import type {
  Account,
  AccountGroup,
  Member,
  Party,
  Item,
  Voucher,
  JournalEntry,
  FiscalYear,
  Tenant,
  BillingSettings,
  OpeningBalance,
  MembershipType,
} from '../lib/types'

// Seed faker for reproducible tests
faker.seed(12345)

/**
 * Create a mock Account
 */
export function createMockAccount(overrides: Partial<Account> = {}): Account {
  const types: Account['type'][] = ['asset', 'liability', 'equity', 'income', 'expense']
  const classes: Account['class'][] = ['other', 'cash', 'bank']

  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    code: faker.string.numeric(4),
    name: faker.finance.accountName(),
    type: faker.helpers.arrayElement(types),
    class: faker.helpers.arrayElement(classes),
    group: null,
    openingBalance: faker.number.float({ min: -100000, max: 100000, fractionDigits: 2 }),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Account Group
 */
export function createMockAccountGroup(overrides: Partial<AccountGroup> = {}): AccountGroup {
  const types: AccountGroup['type'][] = ['asset', 'liability', 'equity', 'income', 'expense']

  return {
    id: faker.number.int({ min: 100, max: 9999 }),
    code: faker.string.numeric(3),
    name: faker.finance.accountName(),
    type: faker.helpers.arrayElement(types),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Member
 */
export function createMockMember(overrides: Partial<Member> = {}): Member {
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  const membershipTypes = ['Life', 'Annual', 'Patron', 'Student']

  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    memberId: `MEM${faker.string.numeric(6)}`,
    fullName: faker.person.fullName(),
    phone: `98${faker.string.numeric(8)}`,
    email: faker.internet.email(),
    address: faker.location.streetAddress(),
    ward: faker.string.numeric(2),
    bloodGroup: faker.helpers.arrayElement(bloodGroups),
    membershipType: faker.helpers.arrayElement(membershipTypes),
    appliedDateBs: '2081-06-15',
    appliedDateAd: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
    photo: null,
    familyDetails: [],
    openingBalance: faker.number.float({ min: -50000, max: 50000, fractionDigits: 2 }),
    tenant: 'C00',
    status: 'active',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Party (vendor/customer)
 */
export function createMockParty(overrides: Partial<Party> = {}): Party {
  const types: Party['type'][] = ['customer', 'vendor', 'both']

  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    name: faker.company.name(),
    type: faker.helpers.arrayElement(types),
    phone: `98${faker.string.numeric(8)}`,
    email: faker.internet.email(),
    address: faker.location.streetAddress(),
    gstNumber: faker.string.alphanumeric(15).toUpperCase(),
    panNumber: faker.string.alphanumeric(10).toUpperCase(),
    contactPerson: faker.person.fullName(),
    openingBalance: faker.number.float({ min: -100000, max: 100000, fractionDigits: 2 }),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Item
 */
export function createMockItem(overrides: Partial<Item> = {}): Item {
  const units = ['PCS', 'KG', 'MTR', 'LTR', 'BOX', 'PKT']
  const taxTypes = ['taxable', 'exempt', 'zero-rated']

  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    code: `ITM${faker.string.numeric(4)}`,
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    unit: faker.helpers.arrayElement(units),
    rate: faker.number.float({ min: 10, max: 10000, fractionDigits: 2 }),
    taxType: faker.helpers.arrayElement(taxTypes),
    taxRate: 13,
    hsnCode: faker.string.numeric(8),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Voucher
 */
export function createMockVoucher(overrides: Partial<Voucher> = {}): Voucher {
  const types: Voucher['type'][] = [
    'receipt', 'payment', 'journal', 'contra',
    'sales-invoice', 'purchase-invoice', 'credit-note', 'debit-note',
    'grn', 'delivery-challan', 'membership-receipt', 'donation-receipt', 'petty-cash'
  ]

  const statuses: Voucher['status'][] = ['draft', 'posted', 'cancelled']

  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    voucherNo: `VCH${faker.string.numeric(8)}`,
    type: faker.helpers.arrayElement(types),
    date: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
    narration: faker.lorem.sentence(),
    totalAmount: faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
    status: faker.helpers.arrayElement(statuses),
    lines: [],
    tenant: 'C00',
    fiscalYear: '2081-82',
    createdAt: faker.date.recent({ days: 30 }).toISOString(),
    updatedAt: faker.date.recent({ days: 7 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Journal Entry
 */
export function createMockJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    entryNo: `JE${faker.string.numeric(6)}`,
    date: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
    narration: faker.lorem.sentence(),
    lines: [
      {
        accountId: faker.number.int({ min: 1000, max: 9999 }),
        debit: faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
        credit: 0,
        description: faker.lorem.words(3),
      },
      {
        accountId: faker.number.int({ min: 1000, max: 9999 }),
        debit: 0,
        credit: faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
        description: faker.lorem.words(3),
      },
    ],
    tenant: 'C00',
    fiscalYear: '2081-82',
    createdAt: faker.date.recent({ days: 30 }).toISOString(),
    updatedAt: faker.date.recent({ days: 7 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Fiscal Year
 */
export function createMockFiscalYear(overrides: Partial<FiscalYear> = {}): FiscalYear {
  const startYear = 2081
  const endYear = startYear + 1

  return {
    id: faker.number.int({ min: 1, max: 20 }),
    name: `${startYear}-${endYear}`,
    startDateBs: `${startYear}-04-01`,
    endDateBs: `${endYear}-03-31`,
    startDateAd: `${startYear + 56}-04-14`,
    endDateAd: `${startYear + 57}-04-13`,
    isActive: true,
    isClosed: false,
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Tenant (Illaka)
 */
export function createMockTenant(overrides: Partial<Tenant> = {}): Tenant {
  const illakaNumber = faker.number.int({ min: 1, max: 20 })

  return {
    id: `IL${illakaNumber.toString().padStart(2, '0')}`,
    code: `IL${illakaNumber.toString().padStart(2, '0')}`,
    name: `Illaka ${illakaNumber}`,
    type: 'illaka',
    address: faker.location.streetAddress(),
    phone: `98${faker.string.numeric(8)}`,
    email: faker.internet.email(),
    ward: faker.string.numeric(2),
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create mock Central Tenant
 */
export function createMockCentralTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'C00',
    code: 'C00',
    name: 'Syasha Samaj Central',
    type: 'central',
    address: 'Kathmandu, Nepal',
    phone: '9851000000',
    email: 'central@syasyahsamaj.org',
    ward: '01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Create a mock Billing Settings
 */
export function createMockBillingSettings(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    id: 1,
    tenant: 'C00',
    companyName: 'Syasha Samaj',
    companyAddress: 'Kathmandu, Nepal',
    companyPhone: '9851000000',
    companyEmail: 'info@syasyahsamaj.org',
    companyPan: '123456789',
    vatNumber: '123456789',
    defaultCurrency: 'NPR',
    decimalPlaces: 2,
    useNepaliDigits: false,
    fiscalYearStartMonth: 4,
    ...overrides,
  }
}

/**
 * Create a mock Opening Balance
 */
export function createMockOpeningBalance(overrides: Partial<OpeningBalance> = {}): OpeningBalance {
  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    account: faker.number.int({ min: 1000, max: 9999 }),
    fiscalYear: '2081-82',
    amount: faker.number.float({ min: -1000000, max: 1000000, fractionDigits: 2 }),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create a mock Membership Type
 */
export function createMockMembershipType(overrides: Partial<MembershipType> = {}): MembershipType {
  return {
    id: faker.number.int({ min: 1, max: 20 }),
    name: faker.helpers.arrayElement(['Life', 'Annual', 'Patron', 'Student', 'Senior']),
    fee: faker.number.float({ min: 1000, max: 50000, fractionDigits: 0 }),
    durationMonths: faker.helpers.arrayElement([12, 24, 60, 120, 0]), // 0 = lifetime
    description: faker.lorem.sentence(),
    tenant: 'C00',
    createdAt: faker.date.recent({ days: 365 }).toISOString(),
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
    ...overrides,
  }
}

/**
 * Create multiple mock entities at once
 */
export function createMockDataSet(count: number = 10) {
  return {
    accounts: Array.from({ length: count }, () => createMockAccount()),
    accountGroups: Array.from({ length: Math.max(3, count / 3) }, () => createMockAccountGroup()),
    members: Array.from({ length: count }, () => createMockMember()),
    parties: Array.from({ length: count }, () => createMockParty()),
    items: Array.from({ length: count }, () => createMockItem()),
    vouchers: Array.from({ length: count }, () => createMockVoucher()),
    journalEntries: Array.from({ length: count }, () => createMockJournalEntry()),
    fiscalYears: [createMockFiscalYear()],
    tenants: [createMockCentralTenant(), ...Array.from({ length: 5 }, () => createMockTenant())],
    billingSettings: createMockBillingSettings(),
    openingBalances: Array.from({ length: count }, () => createMockOpeningBalance()),
    membershipTypes: Array.from({ length: 5 }, () => createMockMembershipType()),
  }
}

/**
 * Create a complete Chart of Accounts hierarchy for testing
 */
export function createMockCoAHierarchy() {
  const groups: AccountGroup[] = [
    createMockAccountGroup({ id: 1, code: '1', name: 'Assets', type: 'asset' }),
    createMockAccountGroup({ id: 2, code: '11', name: 'Current Assets', type: 'asset', parentId: 1 }),
    createMockAccountGroup({ id: 3, code: '12', name: 'Fixed Assets', type: 'asset', parentId: 1 }),
    createMockAccountGroup({ id: 4, code: '2', name: 'Liabilities', type: 'liability' }),
    createMockAccountGroup({ id: 5, code: '21', name: 'Current Liabilities', type: 'liability', parentId: 4 }),
    createMockAccountGroup({ id: 6, code: '3', name: 'Equity', type: 'equity' }),
    createMockAccountGroup({ id: 7, code: '4', name: 'Income', type: 'income' }),
    createMockAccountGroup({ id: 8, code: '5', name: 'Expenses', type: 'expense' }),
  ]

  const accounts: Account[] = [
    // Current Assets
    createMockAccount({ id: 101, code: '1110', name: 'Cash', type: 'asset', class: 'cash', group: 2, openingBalance: 50000 }),
    createMockAccount({ id: 102, code: '1120', name: 'Bank - Nabil', type: 'asset', class: 'bank', group: 2, openingBalance: 250000 }),
    createMockAccount({ id: 103, code: '1130', name: 'Accounts Receivable', type: 'asset', class: 'receivable', group: 2, openingBalance: 150000 }),
    // Fixed Assets
    createMockAccount({ id: 104, code: '1210', name: 'Office Equipment', type: 'asset', class: 'other', group: 3, openingBalance: 100000 }),
    createMockAccount({ id: 105, code: '1220', name: 'Furniture & Fixtures', type: 'asset', class: 'other', group: 3, openingBalance: 75000 }),
    // Current Liabilities
    createMockAccount({ id: 201, code: '2110', name: 'Accounts Payable', type: 'liability', class: 'payable', group: 5, openingBalance: -80000 }),
    createMockAccount({ id: 202, code: '2120', name: 'VAT Payable', type: 'liability', class: 'other', group: 5, openingBalance: -25000 }),
    // Equity
    createMockAccount({ id: 301, code: '3100', name: 'Capital Fund', type: 'equity', class: 'other', group: 6, openingBalance: -400000 }),
    createMockAccount({ id: 302, code: '3200', name: 'Retained Earnings', type: 'equity', class: 'other', group: 6, openingBalance: -50000 }),
    // Income
    createMockAccount({ id: 401, code: '4100', name: 'Membership Fees', type: 'income', class: 'other', group: 7, openingBalance: 0 }),
    createMockAccount({ id: 402, code: '4200', name: 'Donations', type: 'income', class: 'other', group: 7, openingBalance: 0 }),
    // Expenses
    createMockAccount({ id: 501, code: '5100', name: 'Office Rent', type: 'expense', class: 'other', group: 8, openingBalance: 0 }),
    createMockAccount({ id: 502, code: '5200', name: 'Utilities', type: 'expense', class: 'other', group: 8, openingBalance: 0 }),
    createMockAccount({ id: 503, code: '5300', name: 'Salaries', type: 'expense', class: 'other', group: 8, openingBalance: 0 }),
  ]

  return { groups, accounts }
}
