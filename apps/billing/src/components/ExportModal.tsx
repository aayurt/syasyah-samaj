import { useState } from 'react'
import { Download, FilePlus, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react'
import {
  buildExportCsv,
  buildExportJson,
  downloadBlob,
  fetchAllDocs,
} from '../lib/importExport'
import { buildEntityExcel, buildTemplate } from '../lib/excel/entityIo'
import { ENTITY_REGISTRY } from '../lib/excel/entities'
import { useT } from '../lib/i18n'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'

interface ExportOption {
  slug: string
  label: string
  desc: string
  countHint?: string
}

const EXPORT_COLLECTIONS: ExportOption[] = ENTITY_REGISTRY.map((e) => ({
  slug: e.slug,
  label: `${e.label} (${e.slug})`,
  desc: e.kind === 'master' ? 'Master data — मुख्य डाटा' : 'Transactions — लेनदेन',
}))

export default function ExportModal({
  onClose,
  defaultCollection,
}: {
  onClose: () => void
  defaultCollection?: string
}) {
  const t = useT()
  const tenantQuery = useTenantQuery()
  const { tenantId } = useTenant()
  const [selectedSlug, setSelectedSlug] = useState(defaultCollection || 'members')
  const [format, setFormat] = useState<'csv' | 'json' | 'excel' | 'template'>('csv')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const dateStr = new Date().toISOString().slice(0, 10)

      // Templates need no data — download straight away.
      if (format === 'template') {
        const blob = await buildTemplate(selectedSlug)
        downloadBlob(`${selectedSlug}_template_${dateStr}.xlsx`, blob)
        pushToast(
          'success',
          'टेम्प्लेट डाउनलोड भयो (Template ready)',
          `${selectedSlug} — headers + example row, delete the example before importing.`,
        )
        onClose()
        return
      }

      // depth:1 so relation columns export display names, not raw ids.
      const docs = await fetchAllDocs<Record<string, unknown>>(selectedSlug, tenantQuery, 500, 1)
      if (docs.length === 0) {
        pushToast('info', 'कुनै डाटा भेटिएन', 'छानिएको सूचीमा कुनै रेकर्ड फेला परेन।')
        return
      }

      const base = `${selectedSlug}_${tenantId || 'export'}_${dateStr}`
      if (format === 'excel') {
        const blob = await buildEntityExcel(selectedSlug, docs, { tenantName: tenantId || undefined })
        downloadBlob(`${base}.xlsx`, blob)
      } else if (format === 'csv') {
        downloadBlob(`${base}.csv`, buildExportCsv(docs))
      } else {
        downloadBlob(`${base}.json`, buildExportJson(selectedSlug, docs, tenantId || undefined))
      }

      pushToast(
        'success',
        'निर्यात सम्पन्न (Export Complete)',
        `${docs.length} वटा रेकर्ड सफलतापूर्वक डाउनलोड गरियो।`,
      )
      onClose()
    } catch (e) {
      pushToast(
        'error',
        'निर्यात असफल (Export Failed)',
        e instanceof Error ? e.message : 'Unknown error',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="anim-modal-in w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-crimson-50 p-2 text-crimson-600">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                डाटा निर्यात केन्द्र (Data Export)
              </h2>
              <p className="text-xs text-slate-500">
                Excel (.xlsx) / CSV / JSON ढाँचा वा खाली टेम्प्लेट डाउनलोड गर्नुहोस्
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Collection selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              कुन डाटा डाउनलोड गर्ने? (Select Collection)
            </label>
            <div className="mt-2 space-y-1.5">
              {EXPORT_COLLECTIONS.map((opt) => (
                <label
                  key={opt.slug}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 transition-colors ${
                    selectedSlug === opt.slug
                      ? 'border-crimson-500 bg-crimson-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="export-col"
                      checked={selectedSlug === opt.slug}
                      onChange={() => setSelectedSlug(opt.slug)}
                      className="accent-crimson-600"
                    />
                    <div>
                      <div className="text-xs font-medium text-slate-900">{opt.label}</div>
                      <div className="text-[11px] text-slate-500">{opt.desc}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              फाइल ढाँचा (File Format)
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  format === 'excel'
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet size={16} />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  format === 'csv'
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText size={16} />
                <span>CSV (.csv)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  format === 'json'
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText size={16} />
                <span>JSON Backup (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('template')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-medium transition-colors ${
                  format === 'template'
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FilePlus size={16} />
                <span>Blank template (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('common.cancel', 'रद्द (Cancel)')}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded bg-crimson-600 px-4 py-2 text-xs font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>डाउनलोड हुँदैछ...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>अहिले डाउनलोड गर्नुहोस् (Download)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
