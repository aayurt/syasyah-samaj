import { useState } from 'react'
import { Lightbulb, X, HelpCircle, ChevronRight } from 'lucide-react'
import { useTooltips } from '../hooks/useTooltips'

interface PageGuideProps {
  title: string
  description: string
  tips?: string[]
  badge?: string
  storageKey?: string
}

export default function PageGuide({
  title,
  description,
  tips = [],
  badge = 'Quick Tutorial & Helper',
  storageKey,
}: PageGuideProps) {
  const { enabled } = useTooltips()
  const [minimized, setMinimized] = useState(() => {
    if (!storageKey) return false
    try {
      return localStorage.getItem(`guide-min-${storageKey}`) === 'true'
    } catch {
      return false
    }
  })

  // Global toggle in Settings overrides all page guides
  if (!enabled) return null

  const handleToggle = () => {
    const next = !minimized
    setMinimized(next)
    if (storageKey) {
      try {
        localStorage.setItem(`guide-min-${storageKey}`, String(next))
      } catch {
        /* storage unavailable */
      }
    }
  }

  if (minimized) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-3.5 py-1.5 text-xs text-blue-700 transition-all">
        <div className="flex items-center gap-2">
          <HelpCircle size={14} className="text-blue-600" />
          <span className="font-medium">{title}</span>
          <span className="hidden sm:inline text-blue-500">— {description.slice(0, 75)}…</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          Show Guide <ChevronRight size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-4 text-sm text-slate-700 shadow-xs transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Lightbulb size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{title}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {badge}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-3xl">
              {description}
            </p>
            {tips.length > 0 && (
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs text-slate-600">
                {tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-500 font-bold leading-none mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
          title="Minimize guide (toggle from Settings to disable completely)"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
