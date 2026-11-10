# AI Workspace — Reusable AI-Assisted Data Entry & JSON Import Portal

**Status:** planning  
**Owner:** aayurtshrestha  
**Module:** `apps/billing` (React Router + Vite SPA, Payload CMS backend, Postgres)  
**First integration:** Chart of Accounts (CoA) — `gl-accounts` collection  
**Second integration:** Opening Balances — `opening-balances` collection  

---

## 1. Existing architecture assessment

### Stack conventions (all verified against source)

- **Framework:** React 19, React Router, Vite, Tailwind, TypeScript (strict).
- **HTTP layer:** `apps/billing/src/lib/api.ts` exports `api<T>(path, options)` and `list<T>(slug, opts)`. All calls go to `${API_BASE}/api{path}` with `credentials: 'include'`. Tenant-scoped reads emit `where[tenant][equals]`. Collections are Payload CMS slugs (`gl-accounts`, `account-groups`, `opening-balances`, `tenants`, `items`, `parties`, `journal-entries`, …).
- **Offline:** `lib/offline/` queues writes to an outbox and flushes on reconnect. `api(..., { immediate: true })` bypasses the outbox for atomic server-side transactions. `useSyncState()` exposes `cacheVersion` for reload triggers.
- **Auth/tenancy:** `lib/tenant.tsx` — `TenantProvider` holds `tenantId`, `isCentral`, `isIllaka`, `tenants: TenantOption[]`. Roles in `CENTRAL_ROLES` / `ILLAKA_ROLES`. `useTenant()` / `useTenantQuery()`.
- **Types:** `lib/types.ts` — `Account { id, code, name, description, group, type, class, openingBalance, active, allowManualPosting, tenant }`, `AccountGroup`, `JournalEntry`, `TaxType`, etc.
- **Existing import/export:** `lib/importExport.ts` + `lib/excel/entities.ts` — `ENTITY_REGISTRY` maps collection slug → Excel config (columns, dedup keys, fkLinks, importOrder). `classifyRecords`, `executeImport` live there. `ImportPreviewModal` is the existing classify/review/execute modal.
- **Modals:** `components/CoaSetupModal.tsx`, `ImportPreviewModal.tsx`, `ExportModal.tsx`, `VoucherViewModal.tsx`, `LedgerModal.tsx`, `MemberViewModal.tsx`, `ConflictResolutionModal.tsx`. No shared Dialog/backdrop primitive — each modal is self-contained (absolute-positioned panel + optional backdrop div).
- **Notifications:** `lib/toast.ts` `pushToast(level, title, message)`.
- **i18n:** `lib/i18n.tsx` `useT(key, fallback)`, dicts `lib/i18n/{en,ne}.ts`.
- **Table/list primitives:** `useSortSearch` (sort/search state), `useCachedList` (cache-first reads), `AccountsTable`, data-driven rows.

### What already exists that this feature reuses

| Capability | Location | How AI Workspace reuses it |
|---|---|---|
| HTTP CRUD to Payload collections | `lib/api.ts` `api()`, `list()` | Execution engine calls existing `/gl-accounts`, `/account-groups`, `/opening-balances/*` endpoints |
| Offline outbox + sync | `lib/offline/` | Import execution can use `immediate: true` for atomicity |
| Tenant isolation + RBAC | `lib/tenant.tsx` | Workspace reads tenant via `useTenant()`; gated to central roles where required |
| Import classify/review/execute modal | `components/ImportPreviewModal.tsx` | Reuse the step flow (classify → review → executing → done) |
| Entity registry (columns, dedup, fkLinks) | `lib/excel/entities.ts` | Schema registry borrows the per-collection config shape |
| Toast notifications | `lib/toast.ts` | Copy/validate/execute feedback |
| i18n dictionaries | `lib/i18n/{en,ne}.ts` | All UI strings added under `aiWorkspace.*` |

### What does NOT exist (must be created)

- No shared Dialog/backdrop primitive → build `AIWorkspaceModal` self-contained (pattern used by existing modals).
- No prompt generator → new `lib/ai/prompt.ts` + `lib/ai/registry.ts`.
- No JSON validation framework beyond Excel import → new `lib/ai/validate.ts`.
- No adapter registration mechanism → new `lib/ai/adapter.ts`.
- No AI strings in i18n → add `aiWorkspace.*` keys to `en.ts`/`ne.ts`.

---

## 2. Component architecture

```
AIWorkspaceModal (self-contained backdrop modal)
├── Step 1: PromptGenerator
│   ├── task selector (dropdown of registered adapters)
│   ├── contextual prompt display (read-only textarea)
│   └── Copy Prompt button (+ toast feedback)
├── Step 2: JsonInput
│   ├── JSON textarea
│   ├── Paste from clipboard
│   ├── Upload .json file
│   ├── Clear input
│   └── Validate JSON button
├── Step 3: ValidationTable
│   ├── dynamic columns from schema
│   ├── inline edit / add / remove rows
│   ├── per-cell status: valid / warning / error
│   ├── filter invalid records
│   └── revalidate on edit
├── Step 4: ChangePreview
│   ├── CREATE / UPDATE / SKIP / DELETE / ERROR classification
│   ├── before/after diff for updates
│   └── confirmation
└── Step 5: Executing / Done
    ├── progress bar
    └── result summary (created/updated/skipped/errors)
```

Shared primitives live under `lib/ai/`:
- `prompt.ts` — builds the contextual prompt string for a task.
- `registry.ts` — `registerAdapter(taskId, adapter)` / `getAdapter(taskId)` / `listAdapters()`.
- `validate.ts` — schema + business validation returning `ValidationResult`.
- `adapter.ts` — the `AIWorkspaceAdapter` interface.
- `types.ts` — shared types (`WorkspaceContext`, `ValidationResult`, `ChangePreview`, `ExecutionResult`, `ImportAction`).

---

## 3. Adapter interface (adapted to existing architecture)

```typescript
// lib/ai/types.ts
export type AiTaskStatus = 'valid' | 'warning' | 'error'

export interface AiFieldError {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: AiFieldError[]
}

export interface ChangePreview {
  creates: number
  updates: number
  skips: number
  deletes: number
  errors: number
  diffs: Record<number, { before: unknown; after: unknown }>[]
}

export interface ExecutionResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface WorkspaceContext {
  tenantId: string
  tenantQuery: Record<string, unknown>
  userRole: string
  existingData?: Record<string, unknown>[]
}

export interface AIWorkspaceAdapter {
  taskId: string                      // e.g. 'coa.import'
  module: string                      // e.g. 'chart_of_accounts'
  label: string                       // human label for dropdown
  schemaVersion: string               // e.g. '1.0'

  getPromptContext(ctx: WorkspaceContext): Promise<Record<string, unknown>>
  getSchema(): JSONSchema7            // for validation + table columns
  validate(data: unknown[], ctx: WorkspaceContext): Promise<ValidationResult>
  preview(data: unknown[], ctx: WorkspaceContext): Promise<ChangePreview>
  execute(data: unknown[], ctx: WorkspaceContext): Promise<ExecutionResult>
  requiredRole?: string[]             // RBAC gate
}
```

**Design note:** keep `getSchema()` returning a plain JSON-schema-ish object (no new dependency — reuse a minimal in-house validator). Do not add `ajv`/`zod` unless validation complexity demands it.

---

## 4. JSON schema strategy

For CoA (first end-to-end), the import schema mirrors `lib/types.ts` `Account` but flattened for AI:

```json
{
  "type": "object",
  "properties": {
    "metadata": { "type": "object", "properties": { "module": {}, "task": {}, "schema_version": {} } },
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "type": { "enum": ["asset","liability","equity","income","expense"] },
          "class": { "enum": ["cash","bank","other"] },
          "parent_code": { "type": ["string","null"] },
          "is_group": { "type": "boolean" },
          "active": { "type": "boolean" }
        },
        "required": ["code","name","type"]
      }
    }
  }
}
```

Adapter maps `parent_code` → `group` id at execute time by resolving existing + same-batch parents (dependency resolution: parents before children).

Opening Balances schema (second module) reuses the same `AIWorkspaceModal` with its own adapter (`opening-balances.import`) and schema (`accountId`, `fiscalYearId`, `amount`).

---

## 5. Validation & execution strategy

**Stage 1 — JSON parse:** `JSON.parse` with line/column from `SyntaxError.message`. Surface in UI, block progression.

**Stage 2 — Schema validation:** adapter `validate()` checks required fields, enums, types, schema version. Returns `AiFieldError[]` mapped to table rows.

**Stage 3 — Business validation (server-enforced at execute):**
- Duplicate account codes within batch and vs existing.
- Parent accounts exist (in batch or already in DB); parents must be groups.
- No circular parent chains.
- Tenant ownership: `tenant` field set from `useTenant()`, never trusted from payload.
- RBAC: `requiredRole` checked before execute.

**Execution:** `adapter.execute()` calls existing `api()` endpoints:
- POST `/gl-accounts` / PATCH `/gl-accounts/{id}` / DELETE `/gl-accounts/{id}` (only for explicitly supported tasks).
- Use `immediate: true` for atomic batch where supported; otherwise sequential with per-record error reporting.
- Record audit via existing toast + return `ExecutionResult`.
- Idempotency: re-running the same import classifies exact duplicates as SKIP (reuse `classifyRecords` from `importExport.ts`).

**Never:** write directly to DB, trust AI-generated IDs/tenant, auto-execute after validation, bypass existing APIs.

---

## 6. Integration points

### Chart of Accounts (Phase 3)
- Entry: `Accounts.tsx` — add "Import with AI" button next to existing Add/Export.
- Opens `AIWorkspaceModal` with task `coa.import`.
- Adapter `coaImportAdapter` registered in `lib/ai/registry.ts`, wired to `/gl-accounts` CRUD.
- After successful import, `cacheVersion` bump / `load()` refreshes the accounts list.

### Opening Balances (Phase 4)
- Entry: `SetupOpeningBalances.tsx` — "Import with AI" button.
- Adapter `openingBalancesImportAdapter`, schema + validation for `{ account, fiscalYear, amount }`.
- Same `AIWorkspaceModal`, no duplicated modal/validation/execution code.

### Setup Wizard (later)
- Add "Generate with AI" contextual action on company / fiscal year / CoA steps, reusing `PromptGenerator` step only.

---

## 7. Implementation plan (phased)

### Phase 1 — Codebase assessment ✅ (this document)
- Inspected `api.ts`, `tenant.tsx`, `types.ts`, `importExport.ts`, `entities.ts`, `Accounts.tsx`, `CoaSetupModal.tsx`, `ImportPreviewModal.tsx`, `setup.tsx`.
- Confirmed conventions: tenant scoping, offline outbox, toast, i18n, modal pattern.

### Phase 2 — Generic infrastructure
1. Create `lib/ai/types.ts` — shared types + adapter interface.
2. Create `lib/ai/registry.ts` — `registerAdapter`/`getAdapter`/`listAdapters`.
3. Create `lib/ai/prompt.ts` — `buildPrompt(taskId, ctx)` returning prompt string; `copyPrompt()` with toast.
4. Create `lib/ai/validate.ts` — minimal JSON-schema subset validator + business-validation helper signatures.
5. Create `components/AIWorkspaceModal.tsx` — 5-step modal (prompt → input → validate → preview → execute), self-contained backdrop, Tailwind to match existing modals.
6. Add `aiWorkspace.*` keys to `lib/i18n/{en,ne}.ts`.

### Phase 3 — First complete integration: Chart of Accounts
7. Create `lib/ai/adapters/coa.ts` — `coaImportAdapter`: schema, prompt context (existing accounts, account types, classes, tenant), validate (dup codes, parent→group, no cycles), preview, execute via `api('/gl-accounts')`.
8. Register `coaImportAdapter` in registry.
9. Wire "Import with AI" button into `Accounts.tsx` → open `AIWorkspaceModal(taskId='coa.import')`.
10. On success, refresh accounts list (`load()` / `cacheVersion`).

### Phase 4 — Second module: Opening Balances
11. Create `lib/ai/adapters/openingBalances.ts` — `openingBalancesImportAdapter`.
12. Register; wire into `SetupOpeningBalances.tsx`.
13. Verify same modal/infrastructure reused with zero duplication.

### Phase 5 — Testing & hardening
14. Unit tests: `lib/ai/__tests__/prompt.test.ts`, `validate.test.ts`, `coa.adapter.test.ts` (dup detection, parent/child, cycles, tenant isolation).
15. API integration tests: valid/invalid JSON, missing required, duplicates, cross-tenant, unauthorized, partial failure.
16. E2E: copy prompt → import JSON → validate → edit → preview → confirm → verify persisted.
17. Regression: existing manual CoA CRUD unaffected.

---

## 8. Definition of done

- User opens Chart of Accounts, clicks "Import with AI", sees `AIWorkspaceModal`.
- Copies a contextual AI prompt (task + schema + tenant context, no secrets).
- Pastes external-AI-generated JSON → validates → reviews in editable table → previews CREATE/UPDATE/SKIP → confirms → executes through existing `/gl-accounts` API.
- Same infrastructure runs Opening Balances with its own schema/validation/execution, no duplicated modal or engine.
- Build `exit 0`, tests pass, deployed prod + staging.

---

## 9. Known limitations / out of scope (v1)

- No direct LLM API integration (user brings their own assistant per spec).
- No Markdown code-fence stripping beyond instructing the AI; if AI returns fenced JSON, user must paste raw JSON (documented limitation; auto-strip is a v2).
- DELETE only for explicitly supported/authorized tasks (CoA v1 is create/update only).
- Bulk atomicity per-record with error reporting; full DB transaction only where `immediate: true` is supported by the offline engine.
- No virtualization in validation table (pagination only) — fine for typical import sizes (<1000 rows).
