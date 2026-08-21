import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CloudOff,
  Eye,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useCalendar } from '../lib/calendar'
import { getEngine, fmt, useSyncState } from '../lib/api'
import type { OutboxEntry } from '../lib/offline/types'
import { DOC_TYPE_LABELS } from '../lib/types'

/** Human-readable label for a queued write's collection. */
const COLLECTION_LABELS: Record<string, string> = {
  documents: 'Voucher',
  'gl-accounts': 'Account',
  'account-groups': 'Account group',
  'journal-entries': 'Journal entry',
  parties: 'Party',
  items: 'Item',
}

/** Render one queued write's request body as a readable draft. */
function DraftBody({ entry, formatDate }: { entry: OutboxEntry; formatDate: (d: string) => string }) {
  const b = (entry.body ?? {}) as Record<string, unknown>
  const isDoc =
    entry.path.replace(/^\/+|\/+$/g, '') === 'documents' ||
    (entry.method === 'POST' &&
      entry.path.replace(/^\/+|\/+$/g, '').split('/')[0] === 'documents')
  const idOf = (v: unknown): string =>
    v && typeof v === 'object'
      ? String((v as { id: unknown }).id ?? '')
      : String(v ?? '')

  if (isDoc) {
    const lines = (b.lines as Record<string, unknown>[] | undefined) || []
    const jl = (b.journalLines as Record<string, unknown>[] | undefined) || []
    const label = DOC_TYPE_LABELS[String(b.docType)] || String(b.docType || 'Voucher')
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Type</dt>
            <dd className="mt-0.5 text-slate-700">{label}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Date</dt>
            <dd className="mt-0.5 text-slate-700">
              {formatDate(String(b.date ?? ''))}
            </dd>
          </div>
          {b.party !== undefined && b.party !== '' && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Party</dt>
              <dd className="mt-0.5 text-slate-700">{idOf(b.party) || '—'}</dd>
            </div>
          )}
          {b.narration ? (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">Narration</dt>
              <dd className="mt-0.5 text-slate-700">{String(b.narration)}</dd>
            </div>
          ) : null}
          {b.paymentMethod ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Payment</dt>
              <dd className="mt-0.5 capitalize text-slate-700">{String(b.paymentMethod)}</dd>
            </div>
          ) : null}
          {b.taxRate ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Tax rate</dt>
              <dd className="mt-0.5 text-slate-700">{String(b.taxRate)}%</dd>
            </div>
          ) : null}
        </dl>
        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Description</th>
                <th className="w-16 py-2 pr-2 text-right">Qty</th>
                <th className="w-24 py-2 pr-2 text-right">Rate</th>
                <th className="w-28 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-2 text-slate-700">{idOf(l.item) || '—'}</td>
                  <td className="py-2 pr-2 text-slate-600">{String(l.description ?? '')}</td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-700">{String(l.qty ?? '')}</td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-700">
                    {l.rate !== undefined ? fmt(Number(l.rate)) : ''}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-800">
                    {l.amount !== undefined ? fmt(Number(l.amount)) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {jl.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">Account</th>
                <th className="w-24 py-2 pr-2 text-right">Debit</th>
                <th className="w-24 py-2 pr-2 text-right">Credit</th>
                <th className="py-2 text-right">Memo</th>
              </tr>
            </thead>
            <tbody>
              {jl.map((l, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-2 text-slate-700">{idOf(l.account) || '—'}</td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-700">
                    {l.debit !== undefined && l.debit !== '' ? fmt(Number(l.debit)) : ''}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-slate-700">
                    {l.credit !== undefined && l.credit !== '' ? fmt(Number(l.credit)) : ''}
                  </td>
                  <td className="py-2 text-right text-slate-600">{String(l.memo ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // Generic collection draft — render scalar fields, skip internals.
  const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'localId'])
  const rows = Object.entries(b).filter(([k, v]) => {
    if (SKIP.has(k)) return false
    if (v === null || v === undefined || v === '') return false
    return typeof v !== 'object'
  })
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-slate-400">
            {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
          </dt>
          <dd className="mt-0.5 text-slate-700">{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function SyncBanner() {
  const state = useSyncState()
  const { formatDateTime, formatDate } = useCalendar()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<OutboxEntry[]>([])
  const [viewEntry, setViewEntry] = useState<OutboxEntry | null>(null)
  const wasOnline = useRef(state.online)

  const syncNow = async () => {
    setSyncing(true)
    try {
      await getEngine().syncAll()
    } finally {
      setSyncing(false)
    }
  }

  const loadConflicts = async () => {
    try {
      setConflicts(await getEngine().listConflicts())
    } catch {
      setConflicts([])
    }
  }

  // Refresh the conflicted list whenever the count changes (or after any
  // action mutates the outbox).
  useEffect(() => {
    void loadConflicts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.conflicts])

  useEffect(() => {
    const online = () => getEngine().setOnline(true)
    const offline = () => getEngine().setOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  // Auto-sync when the connection returns: queued offline writes must reach
  // the server the moment the device regains the network. This is a one-shot
  // event, not a periodic fetch — fresh data is otherwise pulled only via the
  // resync button.
  useEffect(() => {
    if (state.online && !wasOnline.current) {
      void syncNow()
    }
    wasOnline.current = state.online
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.online])

  // True for queued document creates — the user can reopen them in the
  // Vouchers form, fix them, and save again.
  const canEdit = (e: OutboxEntry) =>
    e.method === 'POST' && e.path.replace(/^\/+|\/+$/g, '') === 'documents'

  const action = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } finally {
      await loadConflicts()
    }
  }

  const rows: React.ReactNode[] = []

  for (const b of state.banners) {
    rows.push(
      <div
        key={`b${b.at}${b.message}`}
        className="flex items-center gap-2 bg-orange-50 px-6 py-1.5 text-xs text-orange-800"
      >
        <TriangleAlert size={13} />
        <span className="flex-1">{b.message}</span>
      </div>,
    )
  }

  for (const c of conflicts) {
    rows.push(
      <div
        key={`c${c.seq}`}
        className="flex flex-wrap items-center gap-2 bg-red-50 px-6 py-2 text-xs text-red-800"
      >
        <TriangleAlert size={13} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">
            Queued {c.method === 'POST' ? 'create' : c.method.toLowerCase()}
            {c.path !== '/documents' ? ` ${c.path}` : ''} — could not sync:
          </span>{' '}
          {c.conflict?.message ?? 'server rejected it'}
        </span>
        <span className="flex items-center gap-1">
          <button
            onClick={() => setViewEntry(c)}
            title="View the queued draft's data"
            className="flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100"
          >
            <Eye size={11} />
            View
          </button>
          {canEdit(c) && (
            <button
              onClick={() => {
                // Vouchers must be mounted to receive the resume event —
                // navigate there first, then dispatch once its listener is
                // registered. If already on /vouchers the second call after
                // the timeout is harmless (same seq, idempotent load).
                navigate('/vouchers')
                setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent('afno:resume-queued', {
                      detail: { seq: c.seq },
                    }),
                  )
                }, 100)
              }}
              className="flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100"
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
          <button
            onClick={() => void action(() => getEngine().retry(c.seq))}
            disabled={syncing || !state.online}
            title="Clear the conflict and try syncing this change again"
            className="flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100 disabled:opacity-50"
          >
            <RefreshCw size={11} />
            Retry
          </button>
          <button
            onClick={() => void action(() => getEngine().discard(c.seq))}
            title="Remove this queued change permanently"
            className="flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 font-medium hover:bg-red-100"
          >
            <Trash2 size={11} />
            Discard
          </button>
        </span>
      </div>,
    )
  }

  let banner: React.ReactNode = null
  if (!state.online && state.pending === 0 && state.conflicts === 0) {
    banner = (
      <div className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-800">
        <div className="flex items-center gap-2">
          <CloudOff size={15} />
          <span>
            Offline — new changes will be queued and synced when you reconnect.
          </span>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={syncing}
          className="flex items-center gap-1 rounded border border-amber-300 px-2 py-0.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Retry
        </button>
      </div>
    )
  } else if (state.pending > 0 || state.conflicts > 0 || rows.length > 0) {
    banner = (
      <div className="border-b border-slate-200 bg-sky-50">
        {rows}
        {(state.pending > 0 || state.conflicts > 0) && (
          <div className="flex items-center justify-between gap-3 px-6 py-2 text-sm text-sky-800">
            <span>
              {state.conflicts > 0 &&
                `${state.conflicts} change${state.conflicts === 1 ? '' : 's'} need${state.conflicts === 1 ? 's' : ''} attention.`}
              {state.pending > 0 && (
                <>
                  {state.conflicts > 0 ? ' ' : ''}
                  {state.online
                    ? `${state.pending} change${state.pending === 1 ? '' : 's'} waiting to sync.`
                    : `Offline — ${state.pending} change${state.pending === 1 ? '' : 's'} queued locally.`}
                </>
              )}
            </span>
            <button
              onClick={() => void syncNow()}
              disabled={syncing || !state.online}
              className="flex items-center gap-1 rounded border border-sky-300 px-2 py-0.5 text-xs font-medium hover:bg-sky-100 disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        )}
      </div>
    )
  }

  const collection =
    COLLECTION_LABELS[viewEntry?.path.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '']
  const viewTitle =
    viewEntry && viewEntry.body && typeof viewEntry.body === 'object'
      ? DOC_TYPE_LABELS[
          String((viewEntry.body as Record<string, unknown>).docType ?? '')
        ] || collection
      : collection

  return (
    <>
      {banner}
      {viewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop is visual only — the modal closes via the X or buttons. */}
          <div className="fixed inset-0 bg-slate-900/50" />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {viewTitle || 'Queued draft'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {viewEntry.method} {viewEntry.path} · queued{' '}
                  {formatDateTime(viewEntry.queuedAt)}
                </div>
              </div>
              <button
                onClick={() => setViewEntry(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4">
              <DraftBody entry={viewEntry} formatDate={formatDate} />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">
              <button
                onClick={() => setViewEntry(null)}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              {canEdit(viewEntry) && (
                <button
                  onClick={() => {
                    const seq = viewEntry.seq
                    setViewEntry(null)
                    navigate('/vouchers')
                    setTimeout(() => {
                      window.dispatchEvent(
                        new CustomEvent('afno:resume-queued', {
                          detail: { seq },
                        }),
                      )
                    }, 100)
                  }}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Edit draft
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
