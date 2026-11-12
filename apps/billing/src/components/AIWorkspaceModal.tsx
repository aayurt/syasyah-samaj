/** AI Workspace modal (§Phase 2).
 *
 * Self-contained backdrop-blur panel. The user brings their own external LLM
 * (ChatGPT / Claude / Gemini): this app only generates the prompt, validates
 * the JSON they paste back, shows an editable preview table, and — on their
 * explicit Confirm — writes through the existing API layer only
 * (importExport.executeImport). Nothing is auto-executed, no AI provider is
 * called from here, and tenant scope comes from useTenant().
 *
 * Step flow: Prompt → Paste JSON → Validate → Preview → Execute → Done.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  Play,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { authClient, isAdminUser } from '../lib/auth'
import { executeImport, type ImportAction } from '../lib/importExport'
import { useTenant, type TenantOption } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import type { Account } from '../lib/types'
import type { AIModel } from '../lib/ai/schemas'
import { AI_MODELS, modelDef } from '../lib/ai/schemas'
import { validateAgainstModel, type AIValidationIssue } from '../lib/ai/validate'
import { fieldInputs, enumOptions, exampleJson, docLabel, NUMERIC_FIELDS } from '../lib/ai/helpers'

type Step = 'prompt' | 'paste' | 'validate' | 'preview' | 'execute'

interface PreviewRow {
  doc: Record<string, unknown>
  action: ImportAction
}

interface AIWorkspaceModalProps {
  open: boolean
  onClose: () => void
  initialModel?: AIModel
  onImported?: () => void
}

export default function AIWorkspaceModal({
  open,
  onClose,
  initialModel,
  onImported,
}: AIWorkspaceModalProps) {
  const t = useT()

  const STEP_ORDER = [
    { key: 'prompt', label: t('ai.stepPrompt', 'Prompt') },
    { key: 'paste', label: t('ai.stepPaste', 'Paste JSON') },
    { key: 'validate', label: t('ai.stepValidate', 'Validate') },
    { key: 'preview', label: t('ai.stepPreview', 'Preview') },
    { key: 'execute', label: t('ai.stepExecute', 'Import') },
  ] as { key: Step; label: string }[]
  const { tenantId, isCentral, isIllaka, illakaCode, tenants } = useTenant()
  const tenantQuery = { tenant: tenantId } as Record<string, string | undefined>

  // Auth session — used to gate data-creating actions behind admin role
  const { data: session } = authClient.useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const canWrite = isAdminUser(userRole)

  const [model, setModel] = useState<AIModel>(initialModel ?? 'gl-accounts')
  const [schemaVersion, setSchemaVersion] = useState(0)
  const [step, setStep] = useState<Step>('prompt')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmNextModel, setConfirmNextModel] = useState<AIModel | null>(null)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  // Draft state
  const [rawJson, setRawJson] = useState('')
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [parseError, setParseError] = useState('')
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<{
    valid: boolean
    errors: AIValidationIssue[]
    warnings: AIValidationIssue[]
  }>({ valid: false, errors: [], warnings: [] })
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [accountCtx, setAccountCtx] = useState<{ code: string; name: string }[]>([])

  // Execution
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{
    created: number
    updated: number
    skipped: number
    errors: string[]
  } | null>(null)

  // Built-in browser language model (Gemini Nano via window.LanguageModel)
  const [gemini, setGemini] = useState<{
    status: 'idle' | 'checking' | 'ready' | 'unavailable' | 'error'
    prompt: string
    response: string
    error: string
  }>({ status: 'idle', prompt: '', response: '', error: '' })
  const geminiSessionRef = useRef<any>(null)

  const def = modelDef(model)
  const tenantName =
    tenants.find((t) => String(t.id) === tenantId)?.name ||
    illakaCode ||
    tenantId ||
    'your organization'
  const ctx = useMemo(
    () => ({
      tenantName,
      accounts: accountCtx,
    }),
    [tenantName, accountCtx],
  )

  const prompt = useMemo(() => def.prompt(ctx), [def, ctx])

  const [threadMessages, setThreadMessages] = useState<{ id: string; content: string }[]>([])
  const [threadDraft, setThreadDraft] = useState('')

  const effectivePrompt = useMemo(
    () => [prompt, ...threadMessages.map((m) => m.content)].filter(Boolean).join('\n\n'),
    [prompt, threadMessages],
  )

  const sendThreadMessage = () => {
    const text = threadDraft.trim()
    if (!text) return
    const msg = { id: crypto.randomUUID?.() ?? `${Date.now()}`, content: text }
    setThreadMessages((prev) => [...prev, msg])
    setThreadDraft('')
  }

  const clearThread = () => {
    setThreadMessages([])
    setThreadDraft('')
  }

  const formatJson = (text: string) => {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
    try {
      return JSON.stringify(JSON.parse(cleaned), null, 2)
    } catch {
      return cleaned
    }
  }

  // Source docs re-validated whenever they or the account context change.
  const sourceDocs = useMemo(
    () =>
      step === 'validate' ? ((parsed?.docs as unknown[]) ?? []) : preview.map((p) => p.doc),
    [step, parsed, preview],
  )

  useEffect(() => {
    if (sourceDocs.length === 0) {
      setValidation({ valid: false, errors: [], warnings: [] })
      return
    }
    setValidating(true)
    Promise.resolve()
      .then(() => validateAgainstModel({ docs: sourceDocs }, model, ctx))
      .then((res) => {
        setValidation(res)
        setValidating(false)
      })
      .catch(() => {
        setValidating(false)
      })
  }, [sourceDocs, model, ctx])

  // Existing chart of accounts, for opening-balance account-code context.
  useEffect(() => {
    if (step !== 'validate' || model !== 'opening-balances') return
    let alive = true
    void api<{ docs: Account[] }>('/gl-accounts', {
      query: { depth: 0, limit: 500, ...tenantQuery },
    })
      .then((res) => {
        if (!alive) return
        setAccountCtx((res.docs ?? []).map((a) => ({ code: String(a.code), name: String(a.name || '') })))
      })
    return () => {
      alive = false
    }
  }, [step, model, tenantId, tenantQuery])

  const hasDraft = rawJson.trim().length > 0 || preview.length > 0 || result != null

  // Honor initialModel when the modal (re)opens from a wizard step so the
  // matching model is preselected instead of defaulting to gl-accounts.
  useEffect(() => {
    if (!open || !initialModel) return
    if (initialModel === model) return
    if (hasDraft) return
    setModel(initialModel)
    setSchemaVersion((v) => v + 1)
  }, [open, initialModel, model, hasDraft])

  const resetDraft = useCallback(() => {
    setStep('prompt')
    setRawJson('')
    setParsed(null)
    setParseError('')
    setValidation({ valid: false, errors: [], warnings: [] })
    setPreview([])
    setResult(null)
    setExecuting(false)
    setGemini({ status: 'idle', prompt: '', response: '', error: '' })
    setThreadMessages([])
    setThreadDraft('')
    setAccountCtx([])
  }, [])

  const handleClose = useCallback(() => {
    if (hasDraft) {
      setCloseConfirmOpen(true)
      return
    }
    resetDraft()
    onClose()
  }, [hasDraft, onClose, resetDraft])

  const handleModelChange = useCallback((next: AIModel) => {
    if (next === model) return
    setConfirmNextModel(next)
    setConfirmOpen(true)
  }, [model])

  const confirmModelChange = useCallback(() => {
    const next = confirmNextModel
    setConfirmOpen(false)
    setConfirmNextModel(null)
    if (!next) return
    setModel(next)
    setSchemaVersion((v) => v + 1)
    setStep('prompt')
    setRawJson('')
    setParsed(null)
    setParseError('')
    setValidation({ valid: false, errors: [], warnings: [] })
    setPreview([])
  }, [confirmNextModel])

  const handleParse = useCallback(() => {
    setParseError('')
    let parsedJson: Record<string, unknown>
    try {
      parsedJson = JSON.parse(rawJson || '{}')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON')
      setParsed(null)
      return
    }
    if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
      setParseError('Expected a JSON object')
      setParsed(null)
      return
    }
    setParsed(parsedJson)
    setStep('validate')
  }, [rawJson])

  const toPreview = useCallback(() => {
    const docs = (parsed?.docs as unknown[]) ?? []
    const rows: PreviewRow[] = docs.map((doc) => ({
      doc:
        doc && typeof doc === 'object' && !Array.isArray(doc)
          ? { ...(doc as Record<string, unknown>) }
          : {},
      action: 'create',
    }))
    setPreview(rows)
    setStep('preview')
  }, [parsed])

  const updateCell = useCallback((idx: number, field: string, value: unknown) => {
    const coerced =
      NUMERIC_FIELDS.has(field) && typeof value === 'string'
        ? value === ''
          ? undefined
          : Number(value)
        : value
    setPreview((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, doc: { ...row.doc, [field]: coerced } } : row,
      ),
    )
  }, [])

  const removeRow = useCallback((idx: number) => {
    setPreview((prev) => prev.filter((_row, i) => i !== idx))
  }, [])

  const handleExecute = useCallback(async () => {
    if (validation.errors.length > 0) return
    if (!canWrite) {
      pushToast('error', t('ai.needAdmin', 'Admin required'), t('ai.needAdminMsg', 'Only admins can create or modify data.'))
      return
    }
    setExecuting(true)
    const records: { doc: Record<string, unknown>; action: ImportAction }[] = preview.map(
      (row) => ({ doc: row.doc, action: row.action }),
    )
    try {
      // Company profile and fiscal year are single-record writes through the
      // same endpoints the wizard uses — they are not entity collections, so
      // they bypass executeImport (which keys off ENTITY_REGISTRY).
      if (model === 'company-profile') {
        const errs: string[] = []
        for (const row of preview) {
          try {
            await api('/globals/billing-settings', { method: 'POST', body: row.doc })
          } catch (e) {
            errs.push(e instanceof Error ? e.message : String(e))
          }
        }
        setResult({ created: preview.length - errs.length, updated: 0, skipped: 0, errors: errs })
        if (errs.length === 0) {
          pushToast('success', t('ai.imported', 'Import complete'), t('ai.importedCompany', 'Company profile saved'))
          onImported?.()
        } else {
          pushToast('error', t('ai.importFailed', 'Import failed'), `${errs.length} failed: ${errs.join('; ')}`)
        }
        setExecuting(false)
        return
      }
      if (model === 'sub-companies') {
        const errs: string[] = []
        let created = 0
        let updated = 0
        let skipped = 0
        let existing: TenantOption[] = []
        try {
          const res = await api<{ docs: TenantOption[] }>('/tenants', { query: { depth: 0, limit: 100 } })
          existing = res.docs ?? []
        } catch {
          existing = []
        }
        const byCode = new Map<string, TenantOption>()
        for (const e of existing) if (e.code) byCode.set(e.code, e)
        for (const row of preview) {
          const target = byCode.get(String(row.doc.code || ''))
          const body = {
            name: row.doc.name,
            code: row.doc.code,
            type: 'illaka',
            active: row.doc.active ?? true,
            slug: row.doc.slug || '',
          }
          const locale = { query: { locale: 'en' } }
          try {
            if (target) {
              await api(`/tenants/${target.id}`, { method: 'PATCH', body, immediate: true, ...locale })
              updated++
            } else {
              await api('/tenants', { method: 'POST', body, immediate: true, ...locale })
              created++
            }
          } catch (e) {
            errs.push(e instanceof Error ? e.message : String(e))
          }
        }
        skipped = existing.length - byCode.size
        setResult({ created, updated, skipped, errors: errs })
        if (errs.length === 0) {
          pushToast('success', t('ai.imported', 'Import complete'), t('ai.importedSubCompanies', 'Sub-companies synced'))
          onImported?.()
        } else {
          pushToast('error', t('ai.importFailed', 'Import failed'), `${errs.length} failed: ${errs.join('; ')}`)
        }
        setExecuting(false)
        return
      }
      if (model === 'fiscal-year') {
        const errs: string[] = []
        for (const row of preview) {
          try {
            const body: Record<string, unknown> = { ...row.doc, status: 'active', isActive: true }
            if (tenantId) body.tenant = Number(tenantId)
            await api('/fiscal-years', { method: 'POST', body })
          } catch (e) {
            errs.push(e instanceof Error ? e.message : String(e))
          }
        }
        setResult({ created: preview.length - errs.length, updated: 0, skipped: 0, errors: errs })
        if (errs.length === 0) {
          pushToast('success', t('ai.imported', 'Import complete'), t('ai.importedFiscalYear', 'Fiscal year saved'))
          onImported?.()
        } else {
          pushToast('error', t('ai.importFailed', 'Import failed'), `${errs.length} failed: ${errs.join('; ')}`)
        }
        setExecuting(false)
        return
      }
      const res = await executeImport(model, records)
      setResult(res)
      if (res.errors.length === 0) {
        pushToast(
          'success',
          t('ai.imported', 'Import complete'),
          `${res.created} created, ${res.updated} updated, ${res.skipped} skipped`,
        )
        onImported?.()
      } else {
        pushToast(
          'error',
          t('ai.importFailed', 'Import failed'),
          `${res.errors.length} record(s) failed: ${res.errors.join('; ')}`,
        )
      }
    } catch (e) {
      pushToast(
        'error',
        t('ai.importFailed', 'Import failed'),
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setExecuting(false)
    }
  }, [model, preview, validation, t, onImported])

  const checkBuiltInGemini = useCallback(async () => {
    setGemini({ status: 'checking', prompt: '', response: '', error: '' })
    if (typeof window === 'undefined' || !('LanguageModel' in window)) {
      setGemini({ status: 'unavailable', prompt: '', response: '', error: 'Built-in language model not available in this browser.' })
      return
    }
    try {
      const availability = await (window as any).LanguageModel.availability()
      if (availability === 'unavailable') {
        setGemini({ status: 'unavailable', prompt: '', response: '', error: t('ai.geminiUnavailable', 'Built-in Gemini not available on this device.') })
        return
      }
      const session = await (window as any).LanguageModel.create()
      geminiSessionRef.current = session
      setGemini({ status: 'ready', prompt: effectivePrompt, response: '', error: '' })
      void askBuiltInGemini(effectivePrompt)
    } catch (e) {
      setGemini({ status: 'error', prompt: '', response: '', error: e instanceof Error ? e.message : String(e) })
    }
  }, [t, effectivePrompt])

  const askBuiltInGemini = useCallback(async (promptOverride?: string) => {
    if (!geminiSessionRef.current) return
    const text = (promptOverride ?? gemini.prompt).trim()
    if (!text) return
    setGemini((prev) => ({ ...prev, status: 'checking', response: '', error: '', prompt: text }))
    try {
      const response = await geminiSessionRef.current.prompt(text)
      setGemini((prev) => ({ ...prev, status: 'ready', response: String(response) }))
    } catch (e) {
      setGemini((prev) => ({ ...prev, status: 'error', error: e instanceof Error ? e.message : String(e) }))
    }
  }, [gemini.prompt])

  const useGeminiResponse = useCallback(() => {
    if (!gemini.response.trim()) return
    const cleaned = gemini.response.replace(/```json\n?|```\n?/g, '').trim()
    setRawJson(cleaned)
    setStep('paste')
    pushToast('info', t('ai.copied', 'Prompt copied'), t('ai.geminiResponsePasted', 'Gemini response pasted into JSON'))
  }, [gemini.response, t, pushToast])

  const byRow = new Map<number, AIValidationIssue[]>()
  for (const issue of [...validation.errors, ...validation.warnings]) {
    const list = byRow.get(issue.row) ?? []
    list.push(issue)
    byRow.set(issue.row, list)
  }

  const errorCount = validation.errors.length
  const warningCount = validation.warnings.length


  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={t('ai.title', 'Import with AI')}
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-black/40" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-[88vh] shadow-2xl">
        <header className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-crimson-600" />
            <span className="text-sm font-semibold text-slate-800">{t('ai.title', 'Import with AI')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                isIllaka ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {illakaCode || tenantId || 'All'}
              {isIllaka ? ' (illaka)' : isCentral ? ' (central)' : ''}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                canWrite
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {t('ai.role', 'Role')}: {userRole ?? '—'}
              {canWrite ? ' (admin)' : ' (no write)'}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              {t('ai.model', 'Model')}:{' '}
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value as AIModel)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                disabled={step !== 'prompt' && step !== 'execute'}
              >
                {AI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
            <button
              onClick={handleClose}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t('ai.close', 'Close')}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Model-change confirmation overlay */}
        {confirmOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full mx-4">
              <p className="text-sm text-slate-700">
                {t(
                  'ai.changeModel',
                  'Switching to NEXT clears your draft and restarts at the prompt. Continue?',
                ).replace('NEXT', confirmNextModel ?? '')}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setConfirmOpen(false)
                    setConfirmNextModel(null)
                  }}
                  className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('ai.changeCancel', 'Cancel')}
                </button>
                <button
                  onClick={confirmModelChange}
                  className="rounded px-3 py-2 text-sm font-medium text-white bg-crimson-600 hover:bg-crimson-700"
                >
                  {t('ai.changeConfirm', 'Continue')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close-with-draft confirmation */}
        {closeConfirmOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg max-w-md w-full mx-4">
              <p className="text-sm text-slate-700">
                {t('ai.discardMsg', 'You have unsaved changes. Close anyway?')}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setCloseConfirmOpen(false)
                    resetDraft()
                    onClose()
                  }}
                  className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('ai.discard', 'Discard')}
                </button>
                <button
                  onClick={() => setCloseConfirmOpen(false)}
                  className="rounded px-3 py-2 text-sm font-medium text-white bg-crimson-600 hover:bg-crimson-700"
                >
                  {t('ai.keep', 'Keep editing')}
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {/* Stepper */ }
          <div className="mb-6">
            <ol className="flex items-center gap-2 text-xs">
              {STEP_ORDER.map((s, i) => {
                const active = step === s.key
                const done = STEP_ORDER.findIndex((s) => s.key === step) > i
                return (
                  <li key={s.key} className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                        active
                          ? 'bg-crimson-600 border-crimson-600 text-white'
                          : done
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 text-slate-400'
                      }`}
                    >
                      {done ? <CheckCircle2 size={12} /> : i + 1}
                    </div>
                    <span className={`font-medium ${
                      active ? 'text-crimson-700' : done ? 'text-emerald-700' : 'text-slate-500'
                    }`}>{s.label}</span>
                    {i < STEP_ORDER.length - 1 && (
                      <ArrowRight size={12} className={`shrink-0 ${done ? 'text-emerald-400' : 'text-slate-300'}`} />
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
          {/* ── Step 1: Prompt ── */}
          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Info size={18} className="mt-0.5 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('ai.intro', 'Generate a prompt, run it in your AI tool, then paste the JSON back here.')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('ai.noSensitive', 'No account IDs, passwords or personal data are sent in the prompt.')}</p>
                </div>
              </div>

              {/* base system template */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">{def.label}</p>
                <div className="rounded border border-slate-200 bg-slate-900 p-3 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">{prompt}</pre>
                </div>
              </div>

              {/* message thread */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('ai.messageThread', 'Prompt thread')}</p>
                  <button
                    onClick={clearThread}
                    disabled={threadMessages.length === 0}
                    className={`text-xs ${threadMessages.length === 0 ? 'text-slate-300' : 'text-slate-500 hover:text-red-600'}`}
                  >
                    {t('ai.clearThread', 'Clear thread')}
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                  {threadMessages.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">{t('ai.noMessages', 'No messages yet — type below and send to build your prompt.')}</p>
                  ) : (
                    threadMessages.map((m) => (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[82%] rounded bg-crimson-600 px-3 py-2 text-xs text-white break-words">
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <textarea
                    value={threadDraft}
                    onChange={(e) => setThreadDraft(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendThreadMessage())}
                    className="flex-1 rounded border border-slate-300 bg-white px-2 py-2 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                    placeholder="Type a line to add to the prompt…"
                  />
                  <button
                    onClick={sendThreadMessage}
                    disabled={!threadDraft.trim()}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs text-white ${!threadDraft.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-crimson-600 hover:bg-crimson-700'}`}
                  >
                    {t('ai.send', 'Send')}
                  </button>
                </div>
              </div>

              {/* effective prompt (template + all messages concatenated) */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">{t('ai.effectivePrompt', 'Full prompt sent to AI')}</p>
                <div className="rounded border border-slate-200 bg-slate-900 p-3 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">{effectivePrompt}</pre>
                </div>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(effectivePrompt)
                      pushToast('info', t('ai.copied', 'Prompt copied'))
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Copy size={14} /> {t('ai.copyPrompt', 'Copy prompt')}
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(effectivePrompt)
                      const url = `https://chat.deepseek.com/?q=${encodeURIComponent(effectivePrompt)}`
                      void window.open(url, '_blank', 'noopener,noreferrer')
                      pushToast('info', 'Deepseek', 'Prompt copied — chat opened')
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Deepseek
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(effectivePrompt)
                      const url = `https://chatgpt.com/?q=${encodeURIComponent(effectivePrompt)}`
                      void window.open(url, '_blank', 'noopener,noreferrer')
                      pushToast('info', 'ChatGPT', 'Prompt copied — chat opened')
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    ChatGPT
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(effectivePrompt)
                      const url = `https://gemini.google.com/?q=${encodeURIComponent(effectivePrompt)}`
                      void window.open(url, '_blank', 'noopener,noreferrer')
                      pushToast('info', 'Gemini', 'Prompt copied — chat opened')
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Gemini
                  </button>
                  <button
                    onClick={checkBuiltInGemini}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {gemini.status === 'checking' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {t('ai.geminiBuiltIn', 'InBuilt Gemini Browser')}
                  </button>
                </div>
              </div>

              {gemini.status !== 'idle' && (
                <div className="mt-3 space-y-2 rounded border bg-slate-50 p-3">
                  {gemini.status === 'unavailable' || gemini.status === 'error' ? (
                    <p className="text-xs text-red-600">{gemini.error}</p>
                  ) : gemini.status === 'checking' ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 size={12} className="animate-spin" /> {t('ai.geminiAsk', 'Asking built-in Gemini…')}
                    </div>
                  ) : (
                    <>
                      {gemini.response && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('ai.effectivePrompt', 'Generated JSON')}</p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  const pretty = formatJson(gemini.response)
                                  void navigator.clipboard.writeText(pretty)
                                  pushToast('info', t('ai.copied', 'Prompt copied'))
                                }}
                                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <Copy size={14} /> {t('ai.copyPrompt', 'Copy')}
                              </button>
                              <button
                                onClick={useGeminiResponse}
                                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <ArrowRight size={12} /> {t('ai.geminiUse', 'Use this response')}
                              </button>
                            </div>
                          </div>
                          <div className="rounded border border-slate-200 bg-slate-900 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">{formatJson(gemini.response)}</pre>
                          </div>
                        </>
                      )}
                      {!gemini.response && gemini.status === 'ready' && (
                        <p className="text-xs text-emerald-600">{t('ai.geminiReady', 'Built-in Gemini ready — type a prompt above.')}</p>
                      )}
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-slate-500">{t('ai.promptHint', 'Open ChatGPT, Claude or Gemini, paste the prompt above, and return only the JSON.')}</p>
            </div>
          )}

          {/* ── Step 2: Paste JSON ── */}
          {step === 'paste' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                {t('ai.pasteLabel', 'Paste JSON response')} —{' '}
                <span className="font-medium text-slate-500">{def.label}</span>
              </p>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={14}
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                placeholder='{ "docs": [ ... ] }'
                spellCheck={false}
              />
              {parseError && (
                <p className="text-xs text-red-600">{t('ai.invalidJson', 'Invalid JSON')}: {parseError}</p>
              )}
              <div className="flex items-center">
                <button
                  onClick={() => setRawJson(exampleJson(model))}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {t('ai.exampleBtn', 'Insert example')}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Validate ── */}
          {step === 'validate' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      errorCount === 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {errorCount === 0
                      ? t('ai.valid', 'Valid')
                      : `${errorCount} ${t('ai.errors', 'error(s)')}`}
                  </span>
                  {warningCount > 0 && (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {warningCount} {t('ai.warnings', 'warning(s)')}
                    </span>
                  )}
                </div>
                {validating && (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 size={14} className="animate-spin" /> {t('ai.validating', 'Validating…')}
                  </span>
                )}
              </div>
              {errorCount === 0 && warningCount === 0 && Array.isArray(parsed?.docs) && parsed.docs.length > 0 && (
                <p className="text-xs text-emerald-600">{t('ai.noIssues', 'No issues found')}</p>
              )}
              <div className="rounded border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 text-slate-400 font-medium w-12">#</th>
                      <th className="px-3 py-2 text-slate-400 font-medium">Document</th>
                      <th className="px-3 py-2 text-slate-400 font-medium text-right w-20">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(parsed?.docs as unknown[]).map((doc, i) => {
                      const d = doc as Record<string, unknown>
                      const issues = byRow.get(i + 1) ?? []
                      return (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-25">
                          <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            <code className="truncate">
                              {docLabel(d, model)}
                            </code>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {issues.length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                                {t('ai.valid', 'Valid')}
                              </span>
                            ) : (
                              issues.map((issue, j) => (
                                <span
                                  key={j}
                                  className={`inline-block mb-1 rounded bg-${
                                    issue.severity === 'error' ? 'red' : 'amber'
                                  }-50 px-2 py-1 text-[10px] font-medium border ${
                                    issue.severity === 'error'
                                      ? 'border-red-200 text-red-700'
                                      : 'border-amber-200 text-amber-700'
                                  }`}
                                >
                                  {issue.field}: {issue.message}
                                </span>
                              ))
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                {errorCount > 0
                  ? t('ai.fixRows', 'Fix the rows in preview, then continue.')
                  : warningCount > 0
                    ? t('ai.warningsNonBlocking', 'Warnings are non-blocking — continue to preview if you want to adjust anything.')
                    : ''}
              </p>
            </div>
          )}

          {/* ── Step 4: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                {t('ai.previewHint', 'Correct any cell below, then run Import. Nothing is written until you confirm.')}
              </p>
              <div className="rounded border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-2 text-slate-400 font-medium w-12">#</th>
                      {fieldInputs(model).map((field) => (
                        <th key={field} className="px-3 py-2 text-slate-400 font-medium">
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-slate-400 font-medium text-right w-24">Status</th>
                      <th className="px-3 py-2 text-slate-400 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const issues = byRow.get(i + 1) ?? []
                      const cells = fieldInputs(model)
                      return (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-25 group">
                          <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                          {cells.map((field) => {
                            const opts = enumOptions(model, field)
                            const value = row.doc[field]
                            const isSelect = opts.length > 0
                            const isNumeric = NUMERIC_FIELDS.has(field)
                            return (
                              <td key={field} className="px-3 py-2">
                                {isSelect ? (
                                  <select
                                    value={String(value ?? opts[0]?.value ?? '')}
                                    onChange={(e) => updateCell(i, field, e.target.value)}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                                  >
                                    {opts.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : isNumeric ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={value == null ? '' : String(value)}
                                    onChange={(e) => updateCell(i, field, e.target.value)}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                                  />
                                ) : (
                                  <input
                                    value={value == null ? '' : String(value)}
                                    onChange={(e) => updateCell(i, field, e.target.value)}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-crimson-600"
                                  />
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right">
                            {issues.length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                                {t('ai.valid', 'Valid')}
                              </span>
                            ) : (
                              <>
                                {issues.map((issue, j) => (
                                  <span
                                    key={j}
                                    className={`inline-block mb-1 rounded bg-${
                                      issue.severity === 'error' ? 'red' : 'amber'
                                    }-50 px-2 py-1 text-[10px] font-medium border ${
                                      issue.severity === 'error'
                                        ? 'border-red-200 text-red-700'
                                        : 'border-amber-200 text-amber-700'
                                    }`}
                                  >
                                    {issue.severity === 'error' ? '✖' : '⚠'}{' '}
                                    {issue.message}
                                  </span>
                                ))}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removeRow(i)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 5: Execute ── */}
          {step === 'execute' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {executing ? (
                <>
                  <Loader2 size={32} className="mb-4 animate-spin text-crimson-600" />
                  <p className="text-sm text-slate-600">{t('ai.importing', 'Importing…')}</p>
                </>
              ) : result ? (
                <>
                  {result.errors.length === 0 ? (
                    <CheckCircle2 size={32} className="mb-4 text-emerald-600" />
                  ) : (
                    <AlertCircle size={32} className="mb-4 text-amber-600" />
                  )}
                  <p className="text-sm text-slate-700">
                    {result.errors.length === 0
                      ? `${t('ai.imported', 'Import complete')}: ${resCreated(result)}`
                      : `${t('ai.partialImport', 'Partially imported')}: ${resCreated(result)}`}
                  </p>
                  {result.errors.length > 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      {t('ai.importErrors', 'Failed:')}{' '}
                      {result.errors.join('; ')}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}
        </main>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
          {step === 'prompt' ? (
            <button
              onClick={() => setStep('paste')}
              className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700"
            >
              {t('ai.pasteJson', 'Paste JSON →')} <ArrowRight size={15} />
            </button>
          ) : step === 'execute' && result ? (
            <>
              <button
                onClick={() => {
                  setStep('prompt')
                  setRawJson('')
                  setParsed(null)
                  setParseError('')
                  setValidation({ valid: false, errors: [], warnings: [] })
                  setPreview([])
                  setResult(null)
                }}
                className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('ai.importAnother', 'Import another')}
              </button>
              <button
                onClick={handleClose}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700"
              >
                {t('ai.close', 'Close')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  if (step === 'paste') setStep('prompt')
                  else if (step === 'validate') setStep('paste')
                  else setStep('validate')
                }}
                className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight size={14} className="rotate-180" /> {t('ai.back', 'Back')}
              </button>
              {step === 'paste' && (
                <button
                  onClick={handleParse}
                  disabled={!rawJson.trim() || !!parseError}
                  className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40"
                >
                  {t('ai.validateBtn', 'Validate against schema')} <ArrowRight size={15} />
                </button>
              )}
              {step === 'validate' && (
                <button
                  onClick={toPreview}
                  disabled={errorCount > 0}
                  className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40"
                >
                  {t('ai.preview', 'Preview')} <ArrowRight size={15} />
                </button>
              )}
              {step === 'preview' && (
                <button
                  onClick={() => setStep('execute')}
                  disabled={errorCount > 0 || executing}
                  className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40"
                >
                  {t('ai.importInto', 'Import into')} {def.label} <Play size={15} />
                </button>
              )}
              {step === 'execute' && !executing && !result && (
                <button
                  onClick={handleExecute}
                  className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700"
                >
                  {t('ai.importNow', 'Run import')} <Play size={15} />
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

function resCreated(res: { created: number; updated: number; skipped: number }): string {
  return `${res.created} created, ${res.updated} updated, ${res.skipped} skipped`
}
