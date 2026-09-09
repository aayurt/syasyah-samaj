import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react'
import {
  classifyRecords,
  executeImport,
  fetchAllDocs,
  type DedupResult,
  type ImportAction,
} from '../lib/importExport'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'

type AnyDoc = Record<string, unknown>

type Step = 'classify' | 'review' | 'executing' | 'done'

export default function ImportPreviewModal({
  collection,
  docs,
  onClose,
  onImported,
}: {
  collection: string
  docs: AnyDoc[]
  onClose: () => void
  onImported: () => void
}) {
  const tenantQuery = useTenantQuery()
  const [step, setStep] = useState<Step>('classify')
  const [dedup, setDedup] = useState<DedupResult<AnyDoc> | null>(null)
  const [actions, setActions] = useState<Map<number, ImportAction>>(new Map())
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch existing records and classify
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchAllDocs<AnyDoc>(collection, tenantQuery)
      .then((existing) => {
        if (!alive) return
        const dedupResult = classifyRecords(docs, existing, collection)
        setDedup(dedupResult)
        // Default actions: new→create, exact→skip, similar→skip (user decides)
        const map = new Map<number, ImportAction>()
        dedupResult.newRecords.forEach((_, i) => map.set(i, 'create'))
        dedupResult.exactDuplicates.forEach((_, i) => map.set(docs.length + i, 'skip'))
        dedupResult.similarRecords.forEach((_, i) => map.set(docs.length * 2 + i, 'skip'))
        setActions(map)
        setStep('review')
      })
      .catch(() => {
        if (alive) setStep('review') // proceed anyway
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [collection, tenantQuery])

  const setAction = (key: number, action: ImportAction) => {
    setActions((prev) => new Map(prev).set(key, action))
  }

  const handleImport = async () => {
    if (!dedup) return
    setStep('executing')

    // Build the records list with their actions
    const records: { doc: AnyDoc; action: ImportAction }[] = []

    dedup.newRecords.forEach((doc, i) => {
      records.push({ doc, action: actions.get(i) || 'create' })
    })
    dedup.exactDuplicates.forEach((pair, i) => {
      const key = docs.length + i
      records.push({ doc: pair.imported, action: actions.get(key) || 'skip' })
    })
    dedup.similarRecords.forEach((pair, i) => {
      const key = docs.length * 2 + i
      records.push({ doc: pair.imported, action: actions.get(key) || 'skip' })
    })

    const res = await executeImport(collection, records, (done, total) => {
      setProgress({ done, total })
    })

    setResult(res)
    setStep('done')
    if (res.errors.length === 0) {
      pushToast('success', 'Import complete', `${res.created} created, ${res.updated} updated, ${res.skipped} skipped`)
    } else {
      pushToast('error', 'Import completed with errors', `${res.errors.length} errors`)
    }
    onImported()
  }

  const totalNew = dedup?.newRecords.length || 0
  const totalExact = dedup?.exactDuplicates.length || 0
  const totalSimilar = dedup?.similarRecords.length || 0
  const willImport = [...actions.values()].filter((a) => a !== 'skip').length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Import Preview — {collection} ({docs.length} records)
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Analyzing records…
            </div>
          )}

          {step === 'review' && dedup && (
            <>
              {/* Summary */}
              <div className="mb-4 space-y-1 text-sm">
                {totalNew > 0 && (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={14} /> {totalNew} new (will be created)
                  </div>
                )}
                {totalSimilar > 0 && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={14} /> {totalSimilar} similar (review below)
                  </div>
                )}
                {totalExact > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle size={14} /> {totalExact} exact duplicates (will skip by default)
                  </div>
                )}
              </div>

              {/* New records */}
              {totalNew > 0 && (
                <div className="mb-4 max-h-40 overflow-y-auto rounded border border-slate-200">
                  <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    New Records ({totalNew})
                  </div>
                  {dedup.newRecords.slice(0, 10).map((doc, i) => (
                    <div key={i} className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
                      <span className="text-slate-700">{String(doc.fullName || doc.name || doc.email || `Record ${i + 1}`)}</span>
                      <span className="text-emerald-600">Will create</span>
                    </div>
                  ))}
                  {totalNew > 10 && <div className="px-3 py-1.5 text-xs text-slate-400">…and {totalNew - 10} more</div>}
                </div>
              )}

              {/* Similar records */}
              {totalSimilar > 0 && (
                <div className="mb-4 max-h-60 overflow-y-auto rounded border border-amber-200">
                  <div className="bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                    Similar Records ({totalSimilar}) — choose action for each
                  </div>
                  {dedup.similarRecords.map((pair, i) => {
                    const key = docs.length * 2 + i
                    const action = actions.get(key) || 'skip'
                    return (
                      <div key={i} className="border-t border-amber-100 px-3 py-2">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-medium text-slate-700">
                              {String(pair.imported.fullName || pair.imported.name || pair.imported.email)}
                            </span>
                            <span className="ml-2 text-slate-400">
                              matches "{String(pair.existing.fullName || pair.existing.name || pair.existing.email)}"
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {(['skip', 'update', 'create'] as ImportAction[]).map((a) => (
                              <button
                                key={a}
                                onClick={() => setAction(key, a)}
                                className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                  action === a
                                    ? a === 'skip' ? 'bg-slate-200 text-slate-700' : a === 'update' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                {a === 'skip' ? 'Skip' : a === 'update' ? 'Update' : 'Create New'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Exact duplicates */}
              {totalExact > 0 && (
                <div className="mb-4 max-h-40 overflow-y-auto rounded border border-red-200">
                  <div className="bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                    Exact Duplicates ({totalExact})
                  </div>
                  {dedup.exactDuplicates.slice(0, 5).map((pair, i) => (
                    <div key={i} className="flex items-center justify-between border-t border-red-100 px-3 py-2 text-xs">
                      <span className="text-slate-700">
                        {String(pair.imported.fullName || pair.imported.name || pair.imported.email)}
                      </span>
                      <span className="text-red-500">Duplicate — skip</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Import button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">{willImport} records will be imported</span>
                <div className="flex gap-2">
                  <button onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={willImport === 0}
                    className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                  >
                    Import {willImport} Records
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'executing' && (
            <div className="py-8 text-center text-sm text-slate-500">
              <Loader2 size={20} className="mx-auto mb-3 animate-spin text-crimson-600" />
              Importing {progress.done}/{progress.total}…
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={14} /> {result.created} records created
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle2 size={14} /> {result.updated} records updated
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                {result.skipped} records skipped
              </div>
              {result.errors.length > 0 && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
              <button onClick={onClose} className="mt-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
