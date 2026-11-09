# SearchSelect — component level notes

## What it is
Generic searchable dropdown (`SearchSelect.tsx`) that replaces native `<select>` for a polished UI. Uses `Popover` (portal to `document.body`) for the option list. Used for Document Type selection in the Number Series modal (`Settings.tsx` lines 2280–2286).

## Props
| Prop | Type | Required | Default | Notes |
|---|---|---|---|---|
| `options` | `SearchSelectOption[]` | yes | — | `{ value, label, sublabel?, badge? }` |
| `value` | `string \| number` | yes | — | Current selection |
| `onChange` | `(v: string) => void` | yes | — | Fired on option select |
| `placeholder` | `string` | no | `t('searchSelect.select')` | Shown when no value |
| `emptyLabel` | `string` | no | `— clear selection —` | Clear button label |

## Known pitfall — portaled options + outside-click timing
The dropdown panel is portaled to `document.body`, so option elements are **not** DOM descendants of the trigger wrapper (`wrapRef`). The outside-click handler listens on `document` and closes the popover when the click target is outside `wrapRef`.

On `mousedown` at `document`:
1. `SearchSelect`'s outside-close fires (`setOpen(false)`)
2. React re-renders and unmounts the portaled panel
3. The option's `onClick`/`onChange` never runs
4. Selection is lost — document type appears not to "stick"

### Fix applied
Option buttons stop propagation on `mousedown` and `mouseup`:
```tsx
onMouseDown={(e) => e.stopPropagation()}
onMouseUp={(e) => e.stopPropagation()}
```
This keeps the click events scoped to the option so `onChange` fires first, then the popover closes via `onClick`.

Additionally, the outside-close listener was moved from `mousedown` to `mouseup` (`SearchSelect.tsx` lines 43–49) so the option's `mouseup` isn't consumed by the close handler either.

## Where it's used
- `apps/billing/src/pages/Settings.tsx` — Number Series Add/Edit modal, Document Type field (line 2280)
- `apps/billing/src/components/SearchSelect.test.tsx` — 46 test cases covering trigger, open/close, filter, clear, select

## Files
- `SearchSelect.tsx` — component + logic
- `SearchSelect.md` — this file
- `SearchSelect.test.tsx` — unit tests
- `Popover.tsx` — portal + outside-click + Escape close
