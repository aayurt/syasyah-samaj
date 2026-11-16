/**
 * Centralized accounting validation service.
 *
 * Every validation result carries a code, entity, field, message, severity,
 * record reference, and suggested correction. Backend-authoritative; frontend
 * may mirror for UX but must never be the only protection.
 *
 * ponytail: ceiling — severity is informational for now; callers decide
 * whether to throw or collect. Add a hard reject-list by severity when a
 * workflow needs it (e.g. posting gate).
 */

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  code: string
  entity: string
  field: string
  message: string
  severity: ValidationSeverity
  reference?: string
  suggestion?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

const issue = (
  code: string,
  entity: string,
  field: string,
  message: string,
  severity: ValidationSeverity = 'error',
  reference?: string,
  suggestion?: string,
): ValidationIssue => ({
  code,
  entity,
  field,
  message,
  severity,
  reference,
  suggestion,
})

/** Accumulate issues from multiple validation runs. */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const issues = results.flatMap((r) => r.issues)
  return { valid: issues.length === 0, issues }
}

/** ── COA validations ─────────────────────────────────────────────────── */

/** Validate account master data (no DB access beyond what callers pass in). */
export function validateAccountData({
  data,
  existingCodes,
  parentId,
  parentType,
  parentTenant,
  tenant,
  hasChildren,
  hasActivity,
  isSystemAccount,
}: {
  data: { code?: string; name?: string; type?: string; parent?: number | null; normalBalance?: string }
  existingCodes: string[] // codes already taken by other accounts in the same tenant
  parentId?: number | null
  parentType?: string
  parentTenant?: number | null
  tenant?: number | null
  hasChildren?: boolean
  hasActivity?: boolean
  isSystemAccount?: boolean
}): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!data.name || String(data.name).trim() === '') {
    issues.push(
      issue(
        'ACCT-001',
        'gl-account',
        'name',
        'Account name cannot be blank.',
        'error',
        undefined,
        'Enter a name for the account.',
      ),
    )
  }

  if (!data.code || String(data.code).trim() === '') {
    issues.push(
      issue(
        'ACCT-002',
        'gl-account',
        'code',
        'Account code is required.',
        'error',
        undefined,
        'Enter a unique account code.',
      ),
    )
  } else if (existingCodes.includes(String(data.code))) {
    issues.push(
      issue(
        'ACCT-003',
        'gl-account',
        'code',
        `Account code "${data.code}" already exists in this company.`,
        'error',
        undefined,
        'Use a different code.',
      ),
    )
  }

  if (!data.type) {
    issues.push(
      issue(
        'ACCT-004',
        'gl-account',
        'type',
        'Account type is required.',
        'error',
        undefined,
        'Select Asset, Liability, Equity, Income, or Expense.',
      ),
    )
  } else {
    const validTypes = ['asset', 'liability', 'equity', 'income', 'expense']
    if (!validTypes.includes(String(data.type))) {
      issues.push(
        issue(
          'ACCT-005',
          'gl-account',
          'type',
          `Invalid account type "${data.type}".`,
          'error',
          undefined,
          'Choose a valid account type.',
        ),
      )
    }
  }

  // Parent compatibility: child type must be compatible with parent type.
  // Heading accounts (no children) can have children; posting accounts can't.
  if (parentId != null) {
    if (!parentType) {
      issues.push(
        issue(
          'ACCT-006',
          'gl-account',
          'parent',
          'Parent account type could not be resolved.',
          'error',
          String(parentId),
          'Verify the parent account exists.',
        ),
      )
    } else if (
      data.type &&
      parentType !== data.type &&
      !isCompatibleChildType(parentType as string, data.type as string)
    ) {
      issues.push(
        issue(
          'ACCT-007',
          'gl-account',
          'parent',
          `Account type "${data.type}" is not compatible with parent type "${parentType}".`,
          'error',
          String(parentId),
          'Choose a parent with a compatible type, or change the account type.',
        ),
      )
    }
  }

  // Normal balance must match type default unless it's a contra account.
  const defaultNormal = defaultNormalBalance(data.type as string)
  if (data.normalBalance && data.normalBalance !== defaultNormal) {
    issues.push(
      issue(
        'ACCT-008',
        'gl-account',
        'normalBalance',
        `Normal balance "${data.normalBalance}" is unusual for type "${data.type}".`,
        'warning',
        undefined,
        'Confirm this is intended (e.g. contra account).',
      ),
    )
  }

  // Parent-company mismatch.
  if (parentId != null && tenant != null && parentTenant != null && parentTenant !== tenant) {
    issues.push(
      issue(
        'ACCT-009',
        'gl-account',
        'parent',
        'Parent account must belong to the same company.',
        'error',
        String(parentId),
        'Choose a parent account from the same company.',
      ),
    )
  }

  // Deletion restrictions.
  if (hasChildren) {
    issues.push(
      issue(
        'ACCT-010',
        'gl-account',
        'id',
        'Account cannot be deleted — it has child accounts.',
        'error',
        undefined,
        'Delete or reparent children first.',
      ),
    )
  }
  if (hasActivity) {
    issues.push(
      issue(
        'ACCT-011',
        'gl-account',
        'id',
        'Account cannot be physically deleted — it has financial activity.',
        'error',
        undefined,
        'Set status to inactive instead of deleting.',
      ),
    )
  }

  if (isSystemAccount) {
    issues.push(
      issue(
        'ACCT-012',
        'gl-account',
        'id',
        'System-controlled account is protected.',
        'error',
        undefined,
        'Contact an administrator to modify system accounts.',
      ),
    )
  }

  return { valid: issues.length === 0, issues }
}

/** ── Opening balance validations ─────────────────────────────────────── */

export function validateOpeningBatch({
  lines,
  fiscalYearStatus,
  existingBatch,
  postingAllowed,
}: {
  lines: Array<{
    accountCode?: string
    accountName?: string
    debit?: number | string
    credit?: number | string
    accountId?: number | null
    isPosting?: boolean
    isActive?: boolean
  }>
  fiscalYearStatus?: string
  existingBatch?: boolean // true if a batch already exists for this FY+tenant
  postingAllowed?: boolean
}): ValidationResult {
  const issues: ValidationIssue[] = []
  let totalDebit = 0
  let totalCredit = 0
  const seenCodes = new Set<string>()

  if (fiscalYearStatus === 'closed') {
    issues.push(
      issue(
        'OPEN-001',
        'opening-balance',
        'fiscalYear',
        'Cannot write opening balances for a closed fiscal year.',
        'error',
        undefined,
        'Reopen the fiscal year or select an open one.',
      ),
    )
  }

  if (existingBatch) {
    issues.push(
      issue(
        'OPEN-002',
        'opening-balance',
        'batchNumber',
        'An opening balance batch already exists for this fiscal year.',
        'error',
        undefined,
        'Edit the existing batch or create a reversal/adjustment instead.',
      ),
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const ref = `line ${i + 1}`
    const debit = Number(line.debit || 0)
    const credit = Number(line.credit || 0)

    if (!line.accountId && !line.accountCode) {
      issues.push(
        issue(
          'OPEN-003',
          'opening-balance',
          'account',
          `Line ${i + 1}: account is required.`,
          'error',
          ref,
          'Select an account.',
        ),
      )
      continue
    }

    if (line.accountId != null && line.isPosting === false) {
      issues.push(
        issue(
          'OPEN-004',
          'opening-balance',
          'account',
          `Line ${i + 1}: non-posting account cannot receive an opening balance.`,
          'error',
          ref,
          'Choose a posting (ledger) account.',
        ),
      )
    }

    if (line.accountId != null && line.isActive === false) {
      issues.push(
        issue(
          'OPEN-005',
          'opening-balance',
          'account',
          `Line ${i + 1}: inactive account cannot receive an opening balance.`,
          'error',
          ref,
          'Activate the account or choose another.',
        ),
      )
    }

    if (debit < 0 || credit < 0) {
      issues.push(
        issue(
          'OPEN-006',
          'opening-balance',
          'amount',
          `Line ${i + 1}: amounts cannot be negative.`,
          'error',
          ref,
          'Enter a non-negative amount.',
        ),
      )
    }

    if (debit > 0 && credit > 0) {
      issues.push(
        issue(
          'OPEN-007',
          'opening-balance',
          'amount',
          `Line ${i + 1}: debit and credit cannot both be positive.`,
          'error',
          ref,
          'Enter the amount on only one side.',
        ),
      )
    }

    if (debit === 0 && credit === 0) {
      issues.push(
        issue(
          'OPEN-008',
          'opening-balance',
          'amount',
          `Line ${i + 1}: amount must be greater than zero.`,
          'error',
          ref,
          'Enter a debit or credit amount.',
        ),
      )
    }

    totalDebit += debit
    totalCredit += credit

    const key = line.accountCode || String(line.accountId)
    if (key && seenCodes.has(key)) {
      issues.push(
        issue(
          'OPEN-009',
          'opening-balance',
          'account',
          `Line ${i + 1}: duplicate account "${key}" in batch.`,
          'error',
          ref,
          'Consolidate into a single line for this account.',
        ),
      )
    }
    seenCodes.add(key)
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    issues.push(
      issue(
        'OPEN-010',
        'opening-balance',
        'batch',
        `Batch is not balanced: debits ${totalDebit.toFixed(2)} vs credits ${totalCredit.toFixed(2)}.`,
        'error',
        undefined,
        'Adjust lines until debits equal credits.',
      ),
    )
  }

  if (!postingAllowed) {
    issues.push(
      issue(
        'OPEN-011',
        'opening-balance',
        'status',
        'Posting is not authorized for this batch.',
        'error',
        undefined,
        'Obtain approval before posting.',
      ),
    )
  }

  return { valid: issues.length === 0, issues }
}

/** ── Helpers ─────────────────────────────────────────────────────────── */

function isCompatibleChildType(parentType: string, childType: string): boolean {
  // Same type is always compatible. Cross-type children allowed only for
  // contra-style pairings (e.g. accumulated depreciation under fixed assets).
  if (parentType === childType) return true
  const contraPairs: Record<string, string[]> = {
    asset: ['asset'], // accumulated depreciation is asset under asset
  }
  return (contraPairs[parentType] ?? []).includes(childType)
}

function defaultNormalBalance(type: string | undefined): string {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit'
    case 'liability':
    case 'equity':
    case 'income':
      return 'credit'
    default:
      return 'debit'
  }
}
