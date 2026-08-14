/** Pulsing placeholder block. */
export function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />
}

/**
 * Table-shaped skeleton matching the app's list views: a header row of short
 * bars over `rows` body rows. Used while a page's first data fetch is running
 * so the user sees the coming layout instead of a blank area.
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  const cols = [
    'w-24',
    'w-16',
    'w-20',
    'w-28',
    'w-14',
    'w-24',
    'w-10',
  ] as const
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
        {cols.map((w, i) => (
          <Sk key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6">
            {cols.map((w, i) => (
              <Sk key={i} className={`h-3.5 ${w}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the trial-balance style report (banner + grouped sections). */
export function ReportSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="mt-4 space-y-4">
      <Sk className="h-10 w-full" />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {Array.from({ length: sections }).map((_, s) => (
          <div key={s} className="border-b border-slate-100 py-3 last:border-0">
            <Sk className="mb-3 h-3 w-28" />
            {Array.from({ length: 3 }).map((_, r) => (
              <div key={r} className="flex items-center gap-6 py-1.5">
                <Sk className="h-3.5 w-24" />
                <Sk className="h-3.5 w-16" />
                <Sk className="h-3.5 w-16" />
                <Sk className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
