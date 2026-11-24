import { useState, useEffect } from 'react'
import { CalendarClock, X } from 'lucide-react'
import { api } from '../lib/api'
import { pushToast } from '../lib/toast'
import { useT } from '../lib/i18n'
import NepaliDateInput from './NepaliDateInput'
import { adToBsString, todayAD } from '../lib/nepaliDate'
import { useFiscalYear, findOverlappingFiscalYear } from '../lib/fiscalYear'
import { useTenant } from '../lib/tenant'
import { LiquidButton } from './ui/LiquidButton'
import type { FiscalYear } from '../lib/types'

interface AddFiscalYearModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (createdYear: FiscalYear) => void
}

export default function AddFiscalYearModal({
  isOpen,
  onClose,
  onSuccess,
}: AddFiscalYearModalProps) {
  const t = useT()
  const { tenantId } = useTenant()
  const { years, refresh, selectYear } = useFiscalYear()

  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<'active' | 'open' | 'closed'>('open')
  const [makeActive, setMakeActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-calculate smart defaults based on the latest existing year
  useEffect(() => {
    if (!isOpen) return
    setError(null)

    if (years.length > 0) {
      // Find the latest year by endDate or startDate
      const sorted = [...years].sort((a, b) =>
        String(b.endDate || b.startDate || '').localeCompare(String(a.endDate || a.startDate || ''))
      )
      const latest = sorted[0]

      if (latest.endDate) {
        // Start next day after latest end date
        try {
          const prevEnd = new Date(latest.endDate)
          const nextStart = new Date(prevEnd)
          nextStart.setDate(nextStart.getDate() + 1)
          const nextStartStr = nextStart.toISOString().slice(0, 10)

          const nextEnd = new Date(nextStart)
          nextEnd.setFullYear(nextEnd.getFullYear() + 1)
          nextEnd.setDate(nextEnd.getDate() - 1)
          const nextEndStr = nextEnd.toISOString().slice(0, 10)

          setStartDate(nextStartStr)
          setEndDate(nextEndStr)

          const bs = adToBsString(nextStartStr)
          const bsYear = Number(bs.slice(0, 4)) || 0
          if (bsYear) {
            setLabel(`${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`)
          } else {
            setLabel(`FY ${nextStartStr.slice(0, 4)}-${nextEndStr.slice(2, 4)}`)
          }
          return
        } catch {
          /* fallback */
        }
      }
    }

    // Default fallback to current date
    const today = todayAD()
    setStartDate(today)
    try {
      const nextYear = new Date(today)
      nextYear.setFullYear(nextYear.getFullYear() + 1)
      nextYear.setDate(nextYear.getDate() - 1)
      setEndDate(nextYear.toISOString().slice(0, 10))

      const bs = adToBsString(today)
      const bsYear = Number(bs.slice(0, 4)) || 0
      if (bsYear) {
        setLabel(`${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`)
      }
    } catch {
      setEndDate(today)
    }
  }, [isOpen, years])

  // Auto-update label when start date changes if user hasn't explicitly typed a custom label
  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    if (val) {
      try {
        const bs = adToBsString(val)
        const bsYear = Number(bs.slice(0, 4)) || 0
        if (bsYear) {
          setLabel(`${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`)
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate || !endDate) {
      setError('Both Start Date and End Date are required.')
      return
    }

    if (startDate > endDate) {
      setError('Fiscal year end date must be after the start date.')
      return
    }

    const overlap = findOverlappingFiscalYear(startDate, endDate, years)
    if (overlap) {
      const overlapLabel = overlap.label || `FY ${overlap.startDate}`
      setError(
        `Fiscal year duration overlaps with existing fiscal year "${overlapLabel}" (${overlap.startDate} to ${overlap.endDate}). Fiscal year periods cannot touch or overlap.`
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      let finalLabel = label.trim()
      if (!finalLabel && startDate) {
        const bs = adToBsString(startDate)
        const bsYear = Number(bs.slice(0, 4)) || 0
        if (bsYear) {
          finalLabel = `${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`
        } else {
          finalLabel = `FY ${startDate.slice(0, 4)}`
        }
      }

      const body: Record<string, unknown> = {
        label: finalLabel,
        startDate,
        endDate,
        status: makeActive ? 'active' : status,
        isActive: makeActive,
      }
      if (tenantId) body.tenant = Number(tenantId)

      // Create new fiscal year
      await api('/fiscal-years', { method: 'POST', immediate: true, body })

      // Fetch created record to get its generated server ID
      const queryTenant = tenantId ? { tenant: tenantId } : {}
      const res = await api<{ docs: FiscalYear[] }>('/fiscal-years', {
        query: {
          limit: 1,
          depth: 0,
          sort: '-startDate',
          where: JSON.stringify({ startDate: { equals: startDate } }),
          ...queryTenant,
        },
      })
      const created = res.docs?.[0]

      if (makeActive && created) {
        await api('/globals/billing-settings', {
          method: 'POST',
          body: { activeFiscalYear: created.id },
        }).catch(() => {})
      }

      pushToast('success', 'Fiscal year created', finalLabel)

      // Refresh fiscal year context and auto-select new year
      await refresh()
      if (created) {
        selectYear(created.id)
        if (onSuccess) onSuccess(created)
      }

      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create fiscal year')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-fy-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 p-5 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600">
              <CalendarClock size={18} />
            </div>
            <div>
              <h2 id="add-fy-title" className="text-base font-semibold text-slate-800">
                {t('fy.addYear', 'Add New Fiscal Year')}
              </h2>
              <p className="text-xs text-slate-500">
                Create an accounting period for your organization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Label */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Fiscal Year Label <span className="text-crimson-600 font-bold ml-0.5">*</span>
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 2082-83 or 2025-26"
              className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Automatically derived from Bikram Sambat start date or Gregorian year.
            </span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <NepaliDateInput
                label="Start Date"
                required
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>
            <div>
              <NepaliDateInput
                label="End Date"
                required
                value={endDate}
                onChange={setEndDate}
              />
            </div>
          </div>

          {/* Status & Active toggle */}
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status & Scope <span className="text-crimson-600 font-bold ml-0.5">*</span>
            </span>
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="modalFyStatus"
                  checked={status === 'open' || status === 'active'}
                  onChange={() => setStatus('open')}
                  className="text-crimson-600 focus:ring-crimson-500"
                />
                Open
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="modalFyStatus"
                  checked={status === 'closed'}
                  onChange={() => {
                    setStatus('closed')
                    setMakeActive(false)
                  }}
                  className="text-crimson-600 focus:ring-crimson-500"
                />
                Closed (Read-Only)
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={makeActive}
                disabled={status === 'closed'}
                onChange={(e) => {
                  setMakeActive(e.target.checked)
                  if (e.target.checked) setStatus('active')
                }}
                className="rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
              />
              <span>Set as active working year for new transactions</span>
            </label>
          </div>

          {/* Actions */}
          <div className="mt-5 flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <LiquidButton
              type="submit"
              variant="primary"
              size="md"
              disabled={saving || !startDate || !endDate}
              className="!bg-crimson-600 hover:!bg-crimson-700 !border-crimson-600"
            >
              {saving ? t('msg.saving', 'Creating…') : t('fy.createYear', 'Create Fiscal Year')}
            </LiquidButton>
          </div>
        </form>
      </div>
    </div>
  )
}
