/** AI Workspace — pure validation of JSON pasted back from an external LLM.
 *
 * Runs against the registry shape (schemas.ts) plus business rules:
 * unique codes, valid enums, opening-balance FK to existing Chart of Accounts.
 * No network, no writes — safe to run on every keystroke/re-paste.
 */

import type { AIContext, AIModel } from './schemas'
import {
  ACCOUNT_CLASSES,
  ACCOUNT_TYPES,
  GROUP_NATURES,
  TAX_KINDS,
  isBoolean,
  isNonEmptyString,
  isNumber,
} from './schemas'

export interface AIValidationIssue {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface AIValidationResult {
  valid: boolean
  errors: AIValidationIssue[]
  warnings: AIValidationIssue[]
}

function push(
  issues: AIValidationIssue[],
  row: number,
  field: string,
  message: string,
  severity: 'error' | 'warning',
): void {
  issues.push({ row, field, message, severity })
}

export function validateAgainstModel(
  parsed: unknown,
  model: AIModel,
  ctx: AIContext,
): AIValidationResult {
  const errors: AIValidationIssue[] = []
  const warnings: AIValidationIssue[] = []

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    push(errors, 0, 'root', 'Expected a JSON object with a "docs" array', 'error')
    return { valid: false, errors, warnings }
  }

  const docs = (parsed as { docs?: unknown }).docs
  if (!Array.isArray(docs) || docs.length === 0) {
    push(errors, 0, 'docs', 'Expected a non-empty "docs" array', 'error')
    return { valid: false, errors, warnings }
  }

  const seenCodes = new Set<string>()
  const accountCodes = new Set((ctx.accounts ?? []).map((a) => a.code))

  docs.forEach((doc, i) => {
    const row = i + 1
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      push(errors, row, 'row', 'Each entry must be a JSON object', 'error')
      return
    }
    const d = doc as Record<string, unknown>

    const required =
      model === 'gl-accounts'
        ? ['code', 'name', 'type', 'class', 'group', 'openingBalance', 'active']
        : model === 'opening-balances'
          ? ['accountCode', 'accountName', 'fiscalYear', 'amount']
          : model === 'tax-types'
            ? ['name', 'type', 'rate', 'active']
            : ['name', 'type', 'nature', 'active']

    for (const field of required) {
      if (!(field in d) || d[field] === null || d[field] === undefined) {
        push(errors, row, field, `Missing required field "${field}"`, 'error')
      }
    }

    if (model === 'gl-accounts') {
      const code = d.code
      if (isNonEmptyString(code)) {
        if (seenCodes.has(String(code))) push(errors, row, 'code', `Duplicate account code "${code}"`, 'error')
        seenCodes.add(String(code))
      }
      if (!isValidEnum(d.type, ACCOUNT_TYPES)) push(errors, row, 'type', 'type must be asset/liability/equity/income/expense', 'error')
      if (!isValidEnum(d.class, ACCOUNT_CLASSES)) push(errors, row, 'class', 'class must be cash/bank/receivable/payable/other', 'error')
      if (!isNonEmptyString(d.group)) push(errors, row, 'group', 'group name is required', 'error')
      if (!isBoolean(d.active)) push(errors, row, 'active', 'active must be true/false', 'error')
      if (!isNumber(d.openingBalance)) push(warnings, row, 'openingBalance', 'openingBalance should be a number (default 0)', 'warning')
      else if ((['asset', 'liability', 'equity'] as const).includes(d.type as any) && Number(d.openingBalance) === 0) {
        push(warnings, row, 'openingBalance', 'Balance-sheet account with zero opening balance — confirm this is intentional', 'warning')
      }
    } else if (model === 'opening-balances') {
      const code = d.accountCode
      if (isNonEmptyString(code)) {
        if (seenCodes.has(String(code))) push(errors, row, 'accountCode', `Duplicate account code "${code}"`, 'error')
        seenCodes.add(String(code))
        if (!accountCodes.has(String(code))) {
          push(warnings, row, 'accountCode', `Account "${code}" not found in Chart of Accounts — import accounts first`, 'warning')
          push(errors, row, 'accountCode', `Account "${code}" not found in Chart of Accounts`, 'error')
        }
      }
      if (!isNonEmptyString(d.accountName)) push(errors, row, 'accountName', 'accountName is required', 'error')
      if (!isNonEmptyString(d.fiscalYear)) push(errors, row, 'fiscalYear', 'fiscalYear is required', 'error')
      if (!isNumber(d.amount)) push(errors, row, 'amount', 'amount must be a number', 'error')
    } else if (model === 'tax-types') {
      const code = d.name
      if (isNonEmptyString(code)) {
        if (seenCodes.has(String(code))) push(errors, row, 'name', `Duplicate tax name "${code}"`, 'error')
        seenCodes.add(String(code))
      }
      if (!isValidEnum(d.type, TAX_KINDS)) push(errors, row, 'type', 'type must be sales/purchase', 'error')
      if (!isNumber(d.rate)) push(errors, row, 'rate', 'rate must be a number (percent)', 'error')
      if (!isBoolean(d.active)) push(errors, row, 'active', 'active must be true/false', 'error')
    } else {
      // account-groups
      if (!isValidEnum(d.type, ACCOUNT_TYPES)) push(errors, row, 'type', 'type must be asset/liability/equity/income/expense', 'error')
      if (!isValidEnum(d.nature, GROUP_NATURES)) push(errors, row, 'nature', 'nature must be debit/credit', 'error')
      if (!isBoolean(d.active)) push(errors, row, 'active', 'active must be true/false', 'error')
    }
  })

  return { valid: errors.length === 0, errors, warnings }
}

function isValidEnum(value: unknown, allowed: Set<string>): boolean {
  return typeof value === 'string' && allowed.has(value)
}

/** Flatten a validation result into docs keyed by row index, for the preview table. */
export function rowIssues(result: AIValidationResult): Map<number, AIValidationIssue[]> {
  const byRow = new Map<number, AIValidationIssue[]>()
  for (const issue of [...result.errors, ...result.warnings]) {
    const list = byRow.get(issue.row) ?? []
    list.push(issue)
    byRow.set(issue.row, list)
  }
  return byRow
}
