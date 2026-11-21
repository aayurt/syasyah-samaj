import { useT } from '../lib/i18n'
import { Camera } from 'lucide-react'
import EntryCard from './EntryCard'

interface VoucherNotesCardProps {
  narration: string
  onChange: (value: string) => void
}

export default function VoucherNotesCard({ narration, onChange }: VoucherNotesCardProps) {
  const t = useT()
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
        <label className="text-sm font-medium text-slate-700">{t('vouchers.attachImages', 'Attach Images')}</label>
        <div className="mt-2 flex items-center gap-3">
          <button type="button"
            className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500">
            <Camera size={24} />
          </button>
          <span className="text-xs text-slate-400">{t('vouchers.uploadHint', 'Upload receipts, invoices, or supporting documents')}</span>
        </div>
      </div>
    </EntryCard>
  )
}
