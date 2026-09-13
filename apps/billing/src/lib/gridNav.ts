import type { KeyboardEvent } from 'react'

/* Shared ledger-grid keyboard navigation, used by VoucherForm and Journal.
 *
 * Inputs opt in with `data-grid-cell="<row>:<col>"` (row-major). Navigation:
 *   - Enter in the last column of the last row → onAppendRow() (caller appends
 *     a row and schedules focus via the returned pending-focus state).
 *   - Enter in the last column of an earlier row → jump to next row, col 0.
 *   - Enter elsewhere → next cell in the same row.
 *   - ArrowUp / ArrowDown → same column, previous / next row (overrides the
 *     number-input increment so arrows always move between cells).
 *   - ArrowLeft / ArrowRight → previous / next cell in the row, only when the
 *     text caret is already at the edge of the input.
 *   - Tab / Shift+Tab stay native — DOM order already matches the grid.
 *
 * Ctrl/Cmd+Enter is deliberately ignored here: it bubbles to the page-level
 * save/post shortcut.
 */

const cellSel = (r: number, c: number) => `[data-grid-cell="${r}:${c}"]`

export function focusCell(r: number, c: number): boolean {
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(cellSel(r, c))
  if (el) {
    el.focus()
    return true
  }
  return false
}

export interface GridKeyOpts {
  row: number
  col: number
  rows: number
  cols: number
  /** Called when Enter is pressed in the last column of the last row. */
  onAppendRow?: () => void
}

export function handleGridKeyDown(
  e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  opts: GridKeyOpts,
): void {
  const { row, col, rows, cols, onAppendRow } = opts
  const { key, ctrlKey, metaKey } = e

  // Ctrl/Cmd+Enter belongs to the form-level save/post shortcut.
  if (key === 'Enter' && (ctrlKey || metaKey)) return

  if (key === 'Enter') {
    e.preventDefault()
    if (col === cols - 1) {
      if (row === rows - 1) {
        if (onAppendRow) onAppendRow()
      } else {
        focusCell(row + 1, 0)
      }
    } else {
      focusCell(row, col + 1)
    }
    return
  }

  if (key === 'ArrowDown') {
    e.preventDefault()
    focusCell(row + 1, col)
    return
  }

  if (key === 'ArrowUp') {
    e.preventDefault()
    focusCell(row - 1, col)
    return
  }

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const el = e.currentTarget as HTMLInputElement
    if (el.selectionStart == null) return // selects / non-text inputs
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd =
      el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    if (key === 'ArrowLeft' && atStart && col > 0) {
      e.preventDefault()
      focusCell(row, col - 1)
    } else if (key === 'ArrowRight' && atEnd && col < cols - 1) {
      e.preventDefault()
      focusCell(row, col + 1)
    }
  }
}
