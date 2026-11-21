import { ReactNode } from 'react'

interface EntryCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  accent?: 'slate' | 'indigo' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'orange' | 'lime' | 'cyan'
}

const ACCENT_BORDER: Record<string, string> = {
  slate: 'border-slate-200',
  indigo: 'border-indigo-200',
  blue: 'border-blue-200',
  violet: 'border-violet-200',
  emerald: 'border-emerald-200',
  amber: 'border-amber-200',
  rose: 'border-rose-200',
  orange: 'border-orange-200',
  lime: 'border-lime-200',
  cyan: 'border-cyan-200',
}

export default function EntryCard({
  title,
  subtitle,
  children,
  accent = 'slate',
}: EntryCardProps) {
  return (
    <section className={`mt-4 rounded-lg border ${ACCENT_BORDER[accent]} bg-white p-5`}>
      <div className="mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          {title}
        </span>
        {subtitle && <span className="ml-2 text-sm font-medium text-slate-600">{subtitle}</span>}
      </div>
      <div>{children}</div>
    </section>
  )
}
