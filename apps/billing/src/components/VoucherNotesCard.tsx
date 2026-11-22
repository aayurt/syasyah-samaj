import { useRef, useState } from 'react'
import { Camera, Eye, FileText, Loader2, X } from 'lucide-react'
import { useT } from '../lib/i18n'
import EntryCard from './EntryCard'
import { API_BASE } from '../lib/base'
import { pushToast } from '../lib/toast'

interface VoucherNotesCardProps {
  narration: string
  onChange: (value: string) => void
  attachmentId?: number | null
  attachmentUrl?: string
  onAttachmentChange?: (id: number | null, url: string) => void
}

export default function VoucherNotesCard({
  narration,
  onChange,
  attachmentId,
  attachmentUrl,
  onAttachmentChange,
}: VoucherNotesCardProps) {
  const t = useT()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', file.name || 'Voucher attachment')
      const res = await fetch(`${API_BASE}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = (await res.json()) as { doc: { id: number; url: string } }
      if (onAttachmentChange) {
        onAttachmentChange(data.doc.id, data.doc.url)
      }
      pushToast('success', 'Attachment uploaded')
    } catch (err) {
      pushToast('error', 'Upload failed', err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (onAttachmentChange) {
      onAttachmentChange(null, '')
    }
  }

  return (
    <EntryCard title={t('vouchers.notesRemarks', 'Notes & Remarks')}>
      <textarea
        rows={4}
        value={narration}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('vouchers.notePlaceholder', 'Enter note or description...')}
        className="w-full resize-none rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500"
      />
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700">
          {t('vouchers.attachImages', 'Attach Images & Receipts')}
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {attachmentUrl ? (
            <div className="relative group flex h-20 w-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs">
              {attachmentUrl.endsWith('.pdf') ? (
                <div className="flex flex-col items-center gap-1 text-slate-600">
                  <FileText size={24} className="text-red-500" />
                  <span className="text-[10px] font-mono">PDF Doc</span>
                </div>
              ) : (
                <img
                  src={attachmentUrl}
                  alt="Voucher attachment"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/50 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white/90 p-1 text-slate-700 hover:bg-white hover:text-blue-600"
                  title="View full image"
                >
                  <Eye size={14} />
                </a>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="rounded bg-white/90 p-1 text-slate-700 hover:bg-white hover:text-red-600"
                  title="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-crimson-400 hover:bg-crimson-50/20 hover:text-crimson-600 transition-colors disabled:opacity-50"
              title="Click to upload bill, receipt, or supporting document"
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="animate-spin text-crimson-600" />
                  <span className="text-[10px] text-slate-500">Uploading…</span>
                </>
              ) : (
                <>
                  <Camera size={22} />
                  <span className="text-[10px] font-medium">Attach Image</span>
                </>
              )}
            </button>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">
              {attachmentUrl
                ? 'Attached document ready to save.'
                : t('vouchers.uploadHint', 'Upload receipts, bills, or photo of physical voucher.')}
            </span>
            <span className="text-[11px] text-slate-400">Supported: JPG, PNG, WebP, PDF (max 10MB)</span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </EntryCard>
  )
}
