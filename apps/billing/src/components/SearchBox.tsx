import { Search, X } from 'lucide-react'

interface SearchBoxProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

/** Compact search input with a magnifier icon and clear (×) button. */
export default function SearchBox({
  value,
  onChange,
  placeholder = 'Search…',
}: SearchBoxProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-52 rounded border border-slate-300 py-1.5 pl-8 pr-7 text-sm outline-none focus:border-slate-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
