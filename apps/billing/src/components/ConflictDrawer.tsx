import { useEffect, useState } from 'react'
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
import { useT, docTypeLabel } from '../lib/i18n'
import ConflictResolutionModal from './ConflictResolutionModal'

/**
 * Right-side review drawer quarantining writes the server rejected
 * (business-rule / validation failures). Replaces the old full-width red
 * banner rows — problems are reviewed on the user's terms instead of
 * interrupting the current turn.
 */

const COLLECTION_LABELS: Record<string, string> = {
  documents: 'Transaction',
  'gl-accounts': 'Account',
  'account-groups': 'Account group',
  'journal-entries': 'Journal entry',
  parties: 'Party',
  items: 'Item',
}

/** Map an HTTP method to the appropriate sync translation key. */
function queuedLabel(method: string): string {
  if (method === 'POST') return 'sync.queuedCreate'
  if (method === 'PATCH') return 'sync.queuedUpdate'
  return 'sync.queuedDelete'
}

/** Human label for a queued write's collection. */
function collectionLabel(path: string): string {
  const slug = path.replace(/^\/+|\/+$/g, '').split('/')[0]
  return COLLECTION_LABELS[slug] ?? slug
}

/** Render one queued write's request body as a readable draft. */
function DraftBody({ entry, formatDate }: { entry: OutboxEntry; formatDate: (d: string) => string }) {
  const t = useT()
  const b = (entry.body ?? {}) as Record<string, unknown>
  const clean = entry.path.replace(/^\/+|\/+$/g, '')
  const isDoc =
    clean === 'documents' ||
    (entry.method === 'POST' && clean.split('/')[0] === 'documents')
  const idOf = (v: unknown): string =>
    v && typeof v === 'object'
      ? String((v as { id: unknown }).id ?? '')
      : String(v ?? '')

  if (isDoc) {
    const lines = (b.lines as Record<string, unknown>[] | undefined) || []
    const jl = (b.journalLines as Record<string, unknown>[] | undefined) || []
    const label = docTypeLabel(String(b.docType), t, 'Voucher')
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftType')}</dt>
            <dd className="mt-0.5 text-slate-700">{label}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftDate')}</dt>
            <dd className="mt-0.5 text-slate-700">
              {formatDate(String(b.date ?? ''))}
            </dd>
          </div>
          {b.party !== undefined && b.party !== '' && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftParty')}</dt>
              <dd className="mt-0.5 text-slate-700">{idOf(b.party) || '—'}</dd>
            </div>
          )}
          {b.narration ? (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftNarration')}</dt>
              <dd className="mt-0.5 text-slate-700">{String(b.narration)}</dd>
            </div>
          ) : null}
          {b.paymentMethod ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftPayment')}</dt>
              <dd className="mt-0.5 capitalize text-slate-700">{String(b.paymentMethod)}</dd>
            </div>
          ) : null}
          {b.taxRate ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{t('sync.draftTaxRate')}</dt>
              <dd className="mt-0.5 text-slate-700">{String(b.taxRate)}%</dd>
            </div>
          ) : null}
        </dl>
        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2">{t('sync.draftItem')}</th>
                <th className="py-2 pr-2">{t('sync.draftDescription')}</th>
                <th className="w-16 py-2 pr-2 text-right">{t('sync.draftQty')}</th>
                <th className="w-24 py-2 pr-2 text-right">{t('sync.draftRate')}</th>
                <th className="w-28 py-2 text-right">{t('sync.draftAmount')}</th>
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
                <th className="py-2 pr-2">{t('sync.draftAccount')}</th>
                <th className="w-24 py-2 pr-2 text-right">{t('sync.draftDebit')}</th>
                <th className="w-24 py-2 pr-2 text-right">{t('sync.draftCredit')}</th>
                <th className="py-2 text-right">{t('sync.draftMemo')}</th>
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

export default function ConflictDrawer({ onClose }: { onClose: () => void }) {
  const t = useT()
  const state = useSyncState()
  const { formatDateTime, formatDate } = useCalendar()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<OutboxEntry[]>([])
  const [viewEntry, setViewEntry] = useState<OutboxEntry | null>(null)
  const [resolveEntry, setResolveEntry] = useState<OutboxEntry | null>(null)

  const loadConflicts = async () => {
    try {
      setConflicts(await getEngine().listConflicts())
    } catch {
      setConflicts([])
    }
  }

  // Refresh the list whenever the conflict count changes (or after any
  // action mutates the outbox).
  useEffect(() => {
    void loadConflicts()
  }, [state.conflicts])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const syncNow = async () => {
    setSyncing(true)
    try {
      await getEngine().syncAll()
    } finally {
      setSyncing(false)
    }
  }

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

  const editDraft = (seq: number) => {
    // Vouchers must be mounted to receive the resume event — navigate there
    // first, then dispatch once its listener is registered. If already on
    // /vouchers the second call after the timeout is harmless (same seq,
    // idempotent load).
    onClose()
    navigate('/vouchers')
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('afno:resume-queued', {
          detail: { seq },
        }),
      )
    }, 100)
  }

  return (
    <>
      {/* Backdrop — click to dismiss; the drawer closes via X / Escape. */}
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={t('sync.drawerTitle', 'Needs review')}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <TriangleAlert size={17} className="text-orange-500" />
            <div>
              <div className="text-base font-semibold text-slate-900">
                {t('sync.drawerTitle', 'Needs review')}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {t(
                  'sync.drawerSubtitle',
                  'These changes are saved on this device but the server could not accept them.',
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label={t('sync.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {conflicts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {t('sync.noConflicts', 'Nothing needs review.')}
            </p>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((c) => (
                <li
                  key={c.seq}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="flex items-start gap-2">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0 text-orange-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">
                        {t(queuedLabel(c.method))} · {collectionLabel(c.path)}
                      </div>
                      <div className="mt-0.5 break-words text-xs text-slate-500">
                        {c.conflict?.message ?? t('sync.serverRejected')}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {t('sync.queuedAt', 'Queued {d}').replace(
                          '{d}',
                          formatDateTime(c.queuedAt),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setResolveEntry(c)}
                      title={t('sync.resolveTitle', 'Compare your version with the server and resolve')}
                      className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Eye size={11} />
                      {t('sync.resolve', 'Resolve')}
                    </button>
                    {canEdit(c) && (
                      <button
                        onClick={() => editDraft(c.seq)}
                        className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil size={11} />
                        {t('sync.edit', 'Edit')}
                      </button>
                    )}
                    <button
                      onClick={() => void action(() => getEngine().retry(c.seq))}
                      disabled={syncing || !state.online}
                      title={t('sync.retryTitle', 'Clear the conflict and try syncing again')}
                      className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <RefreshCw size={11} />
                      {t('sync.retry', 'Retry')}
                    </button>
                    <button
                      onClick={() => void action(() => getEngine().discard(c.seq))}
                      title={t('sync.discardTitle', 'Remove this queued change permanently')}
                      className="flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={11} />
                      {t('sync.discard', 'Discard')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CloudOff size={12} />
            {t('sync.drawerFooter', 'Saved locally — nothing is lost')}
          </span>
          <button
            onClick={() => void syncNow()}
            disabled={syncing || !state.online}
            className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('sync.syncing', 'Syncing…') : t('sync.syncNow', 'Sync now')}
          </button>
        </div>
      </aside>

      {viewEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  {(() => {
                    const b = (viewEntry.body ?? {}) as Record<string, unknown>
                    return (
                      docTypeLabel(String(b.docType ?? ''), t) ||
                      collectionLabel(viewEntry.path) ||
                      t('sync.queuedDraft', 'Queued draft')
                    )
                  })()}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {viewEntry.method} {viewEntry.path} · {t('sync.queuedAt', 'Queued {d}').replace('{d}', formatDateTime(viewEntry.queuedAt))}
                </div>
              </div>
              <button
                onClick={() => setViewEntry(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label={t('sync.close', 'Close')}
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
                {t('sync.close', 'Close')}
              </button>
              {canEdit(viewEntry) && (
                <button
                  onClick={() => {
                    const seq = viewEntry.seq
                    setViewEntry(null)
                    editDraft(seq)
                  }}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  {t('sync.editDraft', 'Edit draft')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {resolveEntry && (
        <ConflictResolutionModal
          entry={resolveEntry}
          onClose={() => setResolveEntry(null)}
          onResolved={() => {
            setResolveEntry(null)
            void loadConflicts()
          }}
        />
      )}
    </>
  )
}
