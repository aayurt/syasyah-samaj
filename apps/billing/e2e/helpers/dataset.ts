import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const raw = readFileSync(join(here, '..', 'dataset.json'), 'utf8')

export interface Dataset {
  meta: {
    fiscalYear: { label: string; start: string; end: string }
    tenantDefaults: { calendarType: string; dateFormat: string; timeFormat: string }
  }
  company: { name: string; pan: string; contact: string; email: string; address: string }
  accounts: {
    groups: { name: string; type: string; code?: string }[]
    accounts: {
      name: string; code: string; type: string; class?: string; group: string
    }[]
    defaultRoles: Record<string, string>
  }
  parties: { name: string; type: string; email: string; phone: string; taxId: string; address: string }[]
  items: {
    name: string; code: string; unit: string; openingStock: number
    purchasePrice: number; salePrice: number; reorderLevel: number
  }[]
  vouchers: VoucherSpec[]
  drafts: VoucherSpec[]
  expectedReports: Record<string, number | Record<string, number>>
}

export interface VoucherSpec {
  step: number
  docType: string
  date: string
  party?: string
  narration: string
  referenceNarration?: string
  paymentMethod?: string
  taxRate?: number
  expectedNumber?: string
  expectedNet?: number
  expectedTax?: number
  expectedGross?: number
  /** drive this voucher through the form UI instead of the API */
  ui?: boolean
  lines?: { item?: string; description?: string; qty: number; rate: number }[]
  journalLines?: { account: string; debit?: number; credit?: number }[]
}

export const dataset = JSON.parse(raw) as Dataset
