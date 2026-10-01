import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react'
import {
  classifyRecords,
  executeImport,
  fetchAllDocs,
  validateImportRows,
  type ValidationError,
  type DedupResult,
  type ImportAction,
} from '../lib/importExport'
import { useT } from '../lib/i18n'
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
  const t = useT()
  const tenantQuery = useTenantQuery()
  const [step, setStep] = useState<Step>('classify')
  const [dedup, setDedup] = useState<DedupResult<AnyDoc> | null>(null)
  const [actions, setActions] = useState<Map<number, ImportAction>>(new Map())
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [isValidated, setIsValidated] = useState(false)

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

  const handleValidateAll = () => {
    const { errors } = validateImportRows(docs, collection)
    setValidationErrors(errors)
    setIsValidated(true)
  }

  const handleSetValidToCreate = () => {
    if (!dedup) return
    const errorRows = new Set(validationErrors.filter(e => e.severity === 'error').map(e => e.row))
    const newActions = new Map(actions)

    const processGroup = (records: any[], offset: number) => {
      records.forEach((r, i) => {
        const doc = r.imported || r
        const rowNum = docs.indexOf(doc) + 2
        if (!errorRows.has(rowNum)) {
          newActions.set(offset + i, 'create')
        }
      })
    }
    processGroup(dedup.newRecords, 0)
    processGroup(dedup.exactDuplicates, docs.length)
    processGroup(dedup.similarRecords, docs.length * 2)
    setActions(newActions)
  }

  const handleSetDuplicatesToUpdate = () => {
    if (!dedup) return
    const newActions = new Map(actions)
    dedup.exactDuplicates.forEach((_, i) => newActions.set(docs.length + i, 'update'))
    dedup.similarRecords.forEach((_, i) => newActions.set(docs.length * 2 + i, 'update'))
    setActions(newActions)
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

  const renderRow = (doc: AnyDoc, key: number, existingDoc?: AnyDoc, matchField?: string) => {
    const rowNum = docs.indexOf(doc) + 2;
    const errs = validationErrors.filter(e => e.row === rowNum);
    const errors = errs.filter(e => e.severity === 'error');
    const warnings = errs.filter(e => e.severity === 'warning');
    const action = actions.get(key) || 'skip';

    return (
      <div key={key} className={`flex items-start justify-between border-t px-3 py-2 text-xs ${errors.length > 0 ? 'bg-red-50/50' : warnings.length > 0 ? 'bg-amber-50/50' : 'border-slate-100'}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px]">Line {rowNum}</span>
            <span className="font-medium text-slate-700">{String(doc.fullName || doc.name || doc.email || `Record ${rowNum}`)}</span>
            {errors.length > 0 && <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">Error</span>}
            {warnings.length > 0 && <span className="rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold">Warning</span>}
          </div>
          {existingDoc && (
            <div className="text-slate-500 text-[10px] mt-0.5">
              Matches "{String(existingDoc.fullName || existingDoc.name || existingDoc.email)}"
            </div>
          )}
          {errs.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {errs.map((e, idx) => (
                <div key={idx} className={`text-[10px] ${e.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
                  • {e.field}: {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
        <select
          value={action}
          onChange={(e) => setAction(key, e.target.value as ImportAction)}
          className="ml-4 shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-500"
        >
          <option value="create">{t('importPreview.createNew', 'Create')}</option>
          <option value="update">{t('importPreview.update', 'Update')}</option>
          <option value="skip">{t('importPreview.skip', 'Skip')}</option>
        </select>
      </div>
    )
  }

  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]">
      <div className="anim-modal-in w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            {t('importPreview.title')} — {collection} ({docs.length} records)
          </h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t('importPreview.analyzing')}
            </div>
          )}

          {step === 'review' && dedup && (
            <>
              {/* Bulk Actions */}
              <div className="mb-4 flex flex-wrap gap-2 rounded bg-slate-50 p-3">
                <button
                  onClick={handleValidateAll}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {isValidated ? 'Re-Validate All' : 'Validate All'}
                </button>
                <button
                  onClick={handleSetValidToCreate}
                  className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Set all valid to Create
                </button>
                <button
                  onClick={handleSetDuplicatesToUpdate}
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Set all duplicates to Update
                </button>
              </div>

              {/* Summary */}
              <div className="mb-4 space-y-1 text-sm">
                {totalNew > 0 && (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 size={14} /> {t('importPreview.newWillBeCreated').replace('{n}', String(totalNew))}
                  </div>
                )}
                {totalSimilar > 0 && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={14} /> {t('importPreview.similarReview').replace('{n}', String(totalSimilar))}
                  </div>
                )}
                {totalExact > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle size={14} /> {t('importPreview.exactDuplicatesSkip').replace('{n}', String(totalExact))}
                  </div>
                )}
              </div>

              {/* New records */}
              {totalNew > 0 && (
                <div className="mb-4 max-h-60 overflow-y-auto rounded border border-slate-200">
                  <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {t('importPreview.newRecords').replace('{n}', String(totalNew))}
                  </div>
                  {dedup.newRecords.map((doc, i) => renderRow(doc, i))}
                </div>
              )}

              {/* Similar records */}
              {totalSimilar > 0 && (
                <div className="mb-4 max-h-60 overflow-y-auto rounded border border-amber-200">
                  <div className="bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                    {t('importPreview.similarRecords').replace('{n}', String(totalSimilar))}
                  </div>
                  {dedup.similarRecords.map((pair, i) => renderRow(pair.imported, docs.length * 2 + i, pair.existing, pair.matchField))}
                </div>
              )}

              {/* Exact duplicates */}
              {totalExact > 0 && (
                <div className="mb-4 max-h-40 overflow-y-auto rounded border border-red-200">
                  <div className="bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                    {t('importPreview.exactDuplicates').replace('{n}', String(totalExact))}
                  </div>
                  {dedup.exactDuplicates.map((pair, i) => renderRow(pair.imported, docs.length + i, pair.existing))}
                </div>
              )}

              {/* Import button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">{t('importPreview.recordsWillBeImported').replace('{n}', String(willImport))}</span>
                <div className="flex gap-2">
                  <button onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={willImport === 0}
                    className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                  >
                    {t('importPreview.importRecords').replace('{n}', String(willImport))}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'executing' && (
            <div className="py-8 text-center text-sm text-slate-500">
              <Loader2 size={20} className="mx-auto mb-3 animate-spin text-crimson-600" />
              {t('importPreview.importing').replace('{done}', String(progress.done)).replace('{total}', String(progress.total))}
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={14} /> {t('importPreview.recordsCreated').replace('{n}', String(result.created))}
              </div>
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle2 size={14} /> {t('importPreview.recordsUpdated').replace('{n}', String(result.updated))}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                {t('importPreview.recordsSkipped').replace('{n}', String(result.skipped))}
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
