/** AI Workspace — prompt generation + model registry (§Phase 2).
 *
 * Zero AI provider lives in this app. These helpers only build the prompt the
 * user pastes into their external LLM (ChatGPT / Claude / Gemini) and describe
 * the expected JSON shape. All writes go through the existing API layer
 * (importExport.executeImport) — never auto-executed, never tenant-bypassing.
 */

export type AIModel = 'gl-accounts' | 'opening-balances' | 'tax-types' | 'account-groups' | 'company-profile' | 'sub-companies' | 'fiscal-year'

export interface AIModelDef {
  value: AIModel
  label: string
  hint: string
  required: readonly string[]
  prompt: (ctx: AIContext) => string
}

export interface AIContext {
  tenantName: string
  currency?: string
  fiscalYear?: string
  accounts?: { code: string; name: string }[]
}

const REQUIRED: Record<AIModel, readonly string[]> = {
  'gl-accounts': ['code', 'name', 'type', 'class', 'group', 'openingBalance', 'active'],
  'opening-balances': ['accountCode', 'accountName', 'fiscalYear', 'amount'],
  'tax-types': ['name', 'type', 'rate', 'active'],
  'account-groups': ['name', 'type', 'nature', 'active'],
  'company-profile': ['companyName'],
  'sub-companies': ['name', 'code'],
  'fiscal-year': ['label', 'startDate', 'endDate'],
}

export const ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'income', 'expense'])
export const ACCOUNT_CLASSES = new Set(['cash', 'bank', 'receivable', 'payable', 'other'])
export const TAX_KINDS = new Set(['sales', 'purchase'])
export const GROUP_NATURES = new Set(['debit', 'credit'])

export const AI_MODELS: readonly AIModelDef[] = [
  {
    value: 'gl-accounts',
    label: 'Chart of Accounts',
    hint: 'Account codes, types, groups, opening balances',
    required: REQUIRED['gl-accounts'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant helping build the Chart of Accounts for "${tenantName}", a Nepali community organization.

Generate a Chart of Accounts as JSON. Each account must have exactly these fields:
- code: string — account code, e.g. "1101"
- name: string — account name
- type: one of "asset", "liability", "equity", "income", "expense"
- class: one of "cash", "bank", "receivable", "payable", "other"
- group: string — account group name
- openingBalance: number — 0 if none
- active: boolean

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation, no text before or after the JSON.`,
  },
  {
    value: 'opening-balances',
    label: 'Opening Balances',
    hint: 'Per-account opening balances for the fiscal year',
    required: REQUIRED['opening-balances'],
    prompt: ({ tenantName, fiscalYear, accounts }) =>
      `You are an accounting assistant for "${tenantName}" (fiscal year ${fiscalYear ?? 'not set'}).

Chart of accounts to balance against:
${(accounts ?? []).map((a) => `- ${a.code} — ${a.name}`).join('\n') || '(none yet — import the Chart of Accounts first)'}

Generate opening balances as JSON. Each balance must have:
- accountCode: string — must match an account code from the chart above
- accountName: string — matching account name
- fiscalYear: string — e.g. "2026-27"
- amount: number — debit-positive, credit-negative

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
  {
    value: 'tax-types',
    label: 'Tax Types',
    hint: 'Sales/purchase tax rates (VAT etc.)',
    required: REQUIRED['tax-types'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant for "${tenantName}", a Nepali community organization.

Generate tax types as JSON. Each tax type must have:
- name: string — tax name, e.g. "VAT 13%"
- type: one of "sales", "purchase"
- rate: number — percent, e.g. 13
- active: boolean

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
  {
    value: 'account-groups',
    label: 'Account Groups',
    hint: 'Account group names with debit/credit nature',
    required: REQUIRED['account-groups'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant for "${tenantName}", a Nepali community organization.

Generate account groups as JSON. Each group must have:
- name: string — group name, e.g. "Bank Accounts"
- type: one of "asset", "liability", "equity", "income", "expense"
- nature: one of "debit", "credit"
- active: boolean

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
  {
    value: 'company-profile',
    label: 'Company Profile',
    hint: 'Organization name, PAN, contact details',
    required: REQUIRED['company-profile'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant for "${tenantName}", a Nepali community organization.

Generate company profile details as JSON. Each profile must have:
- companyName: string — legal organization name
- companyPan: string — Nepali PAN number (optional)
- companyContact: string — phone/contact number (optional)
- companyEmail: string — email address (optional)
- companyAddress: string — physical address (optional)

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
  {
    value: 'sub-companies',
    label: 'Sub-companies',
    hint: 'Sub-companies / illakas under this company',
    required: REQUIRED['sub-companies'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant for "${tenantName}", a Nepali community organization.

Generate sub-companies (illakas) as JSON. Each sub-company must have:
- name: string — sub-company name
- code: string — sub-company code (used to match an existing illaka — new ones are not created)
- slug: string — URL slug (optional)
- active: boolean — whether active (default true)

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
  {
    value: 'fiscal-year',
    label: 'Fiscal Year',
    hint: 'Accounting period start/end dates',
    required: REQUIRED['fiscal-year'],
    prompt: ({ tenantName }) =>
      `You are an accounting assistant for "${tenantName}", a Nepali community organization.

Generate a fiscal year as JSON. Each fiscal year must have:
- label: string — e.g. "2026-27"
- startDate: string — ISO date, e.g. "2026-04-01"
- endDate: string — ISO date, e.g. "2027-03-31"
- status: one of "active", "inactive" (default active)

Output ONLY a JSON object: { "docs": [ {...} ] }. No markdown code fences, no explanation.`,
  },
]

export function modelDef(value: AIModel): AIModelDef {
  return AI_MODELS.find((m) => m.value === value) ?? AI_MODELS[0]
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
}

export const ACCOUNT_CLASS_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  receivable: 'Receivable',
  payable: 'Payable',
  other: 'Other',
}

export const TAX_KIND_LABELS: Record<string, string> = { sales: 'Sales', purchase: 'Purchase' }

export const GROUP_NATURE_LABELS: Record<string, string> = { debit: 'Debit nature', credit: 'Credit nature' }

export function isValidEnum(value: unknown, allowed: Set<string>): boolean {
  return typeof value === 'string' && allowed.has(value)
}

export function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean'
}

export function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}
