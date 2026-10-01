# Coding Conventions — syasyah-samaj

## TypeScript

### General
- **Strict mode**: Always enabled (`"strict": true` in tsconfig)
- **No `any`**: Use `unknown` + type guards; `any` only for external lib interop
- **Explicit returns**: Public functions must have explicit return types
- **Const over let**: Default to `const`; `let` only when reassignment needed
- **Type imports**: `import type { Foo } from '...'` for type-only imports

### Naming
- **Files**: PascalCase for components (`VoucherForm.tsx`), camelCase for utilities (`api.ts`, `nepaliNumbers.ts`)
- **Interfaces**: PascalCase, no `I` prefix (`Member`, `VoucherLine`)
- **Types**: PascalCase (`ImportAction`, `DedupResult`)
- **Constants**: UPPER_SNAKE_CASE (`DEDUP_KEYS`, `CLEANUP_LABELS`)
- **Functions**: camelCase, verb-first (`fetchAllDocs`, `classifyRecords`)
- **React components**: PascalCase (`ImportPreviewModal`, `NepaliDateInput`)
- **Hooks**: camelCase with `use` prefix (`useSyncState`, `useTenantQuery`)

### React Patterns
- **Function components only** — no class components
- **Props interface** named `ComponentNameProps`
- **Default exports** for pages, named exports for utilities
- **No inline styles** — Tailwind classes only
- **Event handlers**: `handleEventName` convention (`handleSubmit`, `handleImport`)

### Async/Await
- Always `await` promises; no bare `.then()` chains
- `try/catch` for error handling with typed errors
- Parallel operations: `Promise.all([a(), b()])` when independent

## Code Organization

### File Structure (per feature/page)
```
src/pages/Vouchers/
├── Vouchers.tsx           # Main page component
├── VoucherForm.tsx        # Sub-component (form)
├── VoucherList.tsx        # Sub-component (list)
├── hooks/
│   └── useVouchers.ts     # Page-specific hooks
├── components/
│   ├── VoucherRow.tsx
│   └── VoucherFilters.tsx
├── __tests__/
│   ├── Vouchers.test.tsx
│   └── VoucherForm.test.tsx
└── index.ts               # Public exports
```

### Barrel Exports
- Use `index.ts` for public API
- Re-export types from `types.ts` if separate

### Imports Order
1. External packages (React, libraries)
2. Internal aliases (`@/lib/...`, `@/components/...`)
3. Relative imports (`./`, `../`)
4. Types (grouped with `import type`)

## State Management

### Local State
- `useState` for simple UI state (modals, inputs, toggles)
- `useReducer` for complex form state (VoucherForm lines)

### Server State
- **Cache-first**: `useCachedList` hook reads from IndexedDB/SQLite
- **SyncEngine** handles background sync automatically
- **No React Query / TanStack Query** — custom offline-first solution

### Global State
- **Context**: Tenant (`TenantProvider`), Auth, Theme, Toasts
- **No Redux / Zustand** — Context + hooks sufficient

## Forms & Validation

### Form Library
- **React Hook Form** + **Zod** for schema validation
- Schema defined in `validationSchemas.ts` per collection
- Reuse schemas in API and import validation

### Validation Rules
- **Required fields**: Marked with `*` in UI
- **Cross-field**: e.g., debit total = credit total
- **Async validation**: Check duplicates via API (debounced)

### Error Display
- Inline field errors (red text below input)
- Toast for submit errors
- Modal for critical/blocking errors

## Internationalization (i18n)

### Translation Keys
- Namespace by feature: `vouchers.create`, `members.import.preview`
- English (`en.json`) + Nepali (`ne.json`) required
- Use `useT()` hook: `t('vouchers.create.title')`
- **No hardcoded strings** in components

### Nepali Localization
- Numbers: `fmt(value)` respects `nepaliDigits` setting
- Dates: `NepaliDateInput` for AD/BS entry
- Amount in words: `numberToWords()` / `numberToNepaliWords()`

## Testing Conventions

### Test File Naming
- Unit: `*.test.ts` / `*.test.tsx` alongside source
- Integration: `*.test.tsx` in `__tests__/`
- E2E: `*.spec.ts` in `e2e/specs/`

### Test Structure
```typescript
describe('functionName', () => {
  it('should do X when Y', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Mocking
- **MSW** for API mocking in integration tests
- **vi.mock()** for module mocking in unit tests
- **Test doubles** for IndexedDB/SQLite adapters (memory adapter)

## Error Handling

### Error Types
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) { super(message) }
}
```

### Handling Pattern
```typescript
try {
  await api('/vouchers', { method: 'POST', body })
} catch (err) {
  if (err instanceof AppError) {
    pushToast('error', err.code, err.message)
  } else {
    pushToast('error', 'UNKNOWN', 'Unexpected error')
  }
}
```

## Git & Commits

### Commit Messages
```
type(scope): short description

Longer explanation if needed

Refs: #issue-number
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`

### Branch Names
- `feat/short-description`
- `fix/short-description`
- `chore/short-description`

## Performance

### Bundle Size
- Dynamic imports for heavy features: `const { ExportExcel } = await import('./ExportExcel')`
- Tree-shaking friendly: named exports
- Analyze with `pnpm build && npx vite-bundle-analyzer`

### Rendering
- `React.memo` for list items (`VoucherRow`, `MemberRow`)
- `useMemo` / `useCallback` for expensive computations
- Virtualization for large lists (future)

## Security

- **Never log secrets** (tokens, passwords, keys)
- **Sanitize user input** in export filenames
- **Validate file uploads** (type, size, content)
- **CSP headers** configured in `next.config.js` / Vite

## Accessibility

- Semantic HTML (`<button>`, `<label>`, `<table>`)
- ARIA labels for icon-only buttons
- Focus management in modals
- Color contrast (WCAG AA minimum)
- Keyboard navigation for all interactive elements