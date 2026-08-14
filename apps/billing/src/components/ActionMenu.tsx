import { useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  /** Renders the item in red (destructive action). */
  danger?: boolean
}

/**
 * Row-actions dropdown (⋯ button) — the same pattern used on the Vouchers
 * page: opens on click, closes on outside click or after an action runs.
 */
export default function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        aria-label="Actions"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'
                }`}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
