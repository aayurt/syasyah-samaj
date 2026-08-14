import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { SortState } from '../lib/useSortSearch'

interface SortableThProps {
  label: string
  sortKey: string
  sort: SortState
  onSort: (key: string) => void
  align?: 'left' | 'right'
}

/** Clickable table header that toggles asc/desc for the given column key. */
export default function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: SortableThProps) {
  const active = sort.key === sortKey
  return (
    <th className={`px-4 py-2 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors ${
          active ? 'text-slate-700' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ChevronsUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  )
}
