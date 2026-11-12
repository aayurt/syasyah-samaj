/** @file AI workspace page — full-page import-by-AI surface.
 * Left sidebar lists every AI model (from AI_MODELS). Clicking one loads its
 * prompt into a chat thread; the user can append messages, copy the effective
 * prompt, paste back JSON, validate it, preview an editable table, then
 * execute (write through the existing API / service layer — no auto-execute,
 * no AI provider in this app).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Sparkles, MessageSquare, Code2, Edit, Trash2, Plus, Send, Play, ArrowRight } from 'lucide-react'
import { useT } from '../lib/i18n'
import { AI_MODELS, modelDef, type AIModel } from '../lib/ai/schemas'
import { validateAgainstModel } from '../lib/ai/validate'
import {
  fieldInputs,
  enumOptions,
  exampleJson,
  NUMERIC_FIELDS,
} from '../lib/ai/helpers'
import { executeImport } from '../lib/importExport'
import { api } from '../lib/api'
import { pushToast } from '../lib/toast'
import { authClient, isAdminUser } from '../lib/auth'
import { useTenant } from '../lib/tenant'

type Step = 'prompt' | 'paste' | 'validate' | 'preview' | 'execute'

const MODEL_LABEL: Record<AIModel, string> = {
  'account-groups': 'Account Groups',
  'gl-accounts': 'Chart of Accounts',
  'opening-balances': 'Opening Balances',
  'tax-types': 'Tax Types',
  'company-profile': 'Company Profile',
  'sub-companies': 'Sub-companies',
  'fiscal-year': 'Fiscal Year',
  parties: 'Parties',
  items: 'Items',
  members: 'Members',
}

const MODEL_DESC: Record<AIModel, string> = {
  'account-groups': 'Ledger account groups (asset, liability, equity, income, expense)',
  'gl-accounts': 'Chart of accounts with codes, classes, and opening balances',
  'opening-balances': 'Opening balances per account for a fiscal year',
  'tax-types': 'Sales and purchase tax rates',
  'company-profile': 'Organization profile (name, PAN, contact, address)',
  'sub-companies': 'Illaka / sub-company tenants',
  'fiscal-year': 'Fiscal year periods',
  parties: 'Customers, vendors, and both parties',
  items: 'Goods and services with price and unit',
  members: 'Organization members with roles',
}

export default function AIPage() {
  const t = useT()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const canWrite = isAdminUser(userRole)
  const { tenantId, isIllaka, tenants } = useTenant()

  const [model, setModel] = useState<AIModel>('gl-accounts')
  const [step, setStep] = useState<Step>('prompt')
  const [rawJson, setRawJson] = useState('')
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [parseError, setParseError] = useState('')
  const [validation, setValidation] = useState<{
    valid: boolean
    errors: { row: number; field: string; message: string }[]
    warnings: { row: number; field: string; message: string }[]
  }>({ valid: false, errors: [], warnings: [] })
  const [preview, setPreview] = useState<{ doc: Record<string, unknown>; action: string }[]>([])
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null)

  // Chat thread
  const [threadMessages, setThreadMessages] = useState<{ id: string; content: string }[]>([])
  const [threadDraft, setThreadDraft] = useState('')

  // Built-in browser language model (optional)
  const [gemini, setGemini] = useState<{
    status: 'idle' | 'checking' | 'ready' | 'unavailable' | 'error'
    prompt: string
    response: string
    error: string
  }>({ status: 'idle', prompt: '', response: '', error: '' })
  const geminiSessionRef = useRef<any>(null)

  const def = modelDef(model)
  const prompt = useMemo(() => def.prompt({ tenantName: tenants.find((t) => String(t.id) === tenantId)?.name ?? tenantId ?? 'your organization', accounts: [] }), [def, tenantId, tenants])

  const effectivePrompt = useMemo(
    () => [prompt, ...threadMessages.map((m) => m.content)].filter(Boolean).join('\n\n'),
    [prompt, threadMessages],
  )

  const sendThreadMessage = useCallback(() => {
    const text = threadDraft.trim()
    if (!text) return
    const msg = { id: crypto.randomUUID?.() ?? `${Date.now()}`, content: text }
    setThreadMessages((prev) => [...prev, msg])
    setThreadDraft('')
  }, [threadDraft])

  const clearThread = useCallback(() => {
    setThreadMessages([])
    setThreadDraft('')
  }, [])

  const formatJson = useCallback((text: string) => {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
    try {
      return JSON.stringify(JSON.parse(cleaned), null, 2)
    } catch {
      return cleaned
    }
  }, [])

  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(effectivePrompt)
    pushToast('info', t('ai.copied', 'Prompt copied'), t('ai.promptCopied', 'Paste this into your AI'))
  }, [effectivePrompt, t])

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
    const rows = docs.map((doc) => ({
      doc: doc && typeof doc === 'object' && !Array.isArray(doc) ? { ...(doc as Record<string, unknown>) } : {},
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

  const addRow = useCallback(() => {
    setPreview((prev) => [...prev, { doc: {}, action: 'create' }])
  }, [])

  const handleExecute = useCallback(async () => {
    if (validation.errors.length !== 0) return
    if (!canWrite) {
      pushToast('error', t('ai.needAdmin', 'Admin required'), t('ai.needAdminMsg', 'Only admins can create or modify data.'))
      return
    }
    setExecuting(true)
    const records = preview.map((row) => ({ doc: row.doc, action: 'create' as const }))
    try {
      // Single-record / non-entity writes through existing endpoints.
      if (model === 'company-profile') {
        // Billing settings globals is a single record — import only the first row.
        const row = preview[0]
        if (!row) {
          setResult({ created: 0, updated: 0, skipped: 0, errors: ['No company-profile row to import'] })
          return
        }
        try {
          await api('/globals/billing-settings', { method: 'POST', body: row.doc })
          setResult({ created: 1, updated: 0, skipped: 0, errors: [] })
        } catch (e) {
          setResult({ created: 0, updated: 0, skipped: 0, errors: [e instanceof Error ? e.message : String(e)] })
        }
      } else if (model === 'sub-companies') {
        const errs: string[] = []
        let created = 0
        let updated = 0
        let existing: { id: string; code?: string }[] = []
        try {
          const res = await api<{ docs: { id: string; code?: string }[] }>('/tenants', { query: { depth: 0, limit: 100 } })
          existing = res.docs ?? []
        } catch {
          existing = []
        }
        const byCode = new Map<string, { id: string }>()
        for (const e of existing) if (e.code) byCode.set(e.code, e)
        for (const row of preview) {
          const target = byCode.get(String(row.doc.code || ''))
          const body = { name: row.doc.name, code: row.doc.code, type: 'illaka', active: row.doc.active ?? true, slug: row.doc.slug || '' }
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
        setResult({ created, updated, skipped: 0, errors: errs })
      } else if (model === 'fiscal-year') {
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
      } else {
        const res = await executeImport(model, records)
        setResult(res)
      }
      if (result?.errors.length === 0) {
        pushToast('success', t('ai.imported', 'Import complete'), `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`)
      } else if (result) {
        pushToast('error', t('ai.importFailed', 'Import failed'), `${result.errors.length} record(s) failed: ${result.errors.join('; ')}`)
      }
    } catch (e) {
      pushToast('error', t('ai.importFailed', 'Import failed'), e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(false)
    }
  }, [model, preview, validation, canWrite, t, tenantId])

  // Re-validate whenever source docs or model change.
  const sourceDocs = useMemo(() => (step === 'validate' ? ((parsed?.docs as unknown[]) ?? []) : preview.map((p) => p.doc)), [step, parsed, preview])

  const STEP_LABELS: [string, string][] = [
    ['prompt', t('ai.stepPrompt', 'Prompt')],
    ['paste', t('ai.stepPaste', 'Paste JSON')],
    ['validate', t('ai.stepValidate', 'Validate')],
    ['preview', t('ai.stepPreview', 'Preview')],
    ['execute', t('ai.stepExecute', 'Import')],
  ]

  const stepDone = (key: string): boolean => {
    if (key === 'prompt') return true
    if (key === 'paste') return rawJson.trim().length !== 0
    if (key === 'validate') return parsed != null
    if (key === 'preview') return preview.length !== 0
    return false
  }

  useEffect(() => {
    if (sourceDocs.length === 0) {
      setValidation({ valid: false, errors: [], warnings: [] })
      return
    }
    setValidation(validateAgainstModel({ docs: sourceDocs }, model, { tenantName: tenants.find((t) => String(t.id) === tenantId)?.name ?? tenantId ?? 'your organization', accounts: [] }))
  }, [sourceDocs, model, tenantId, tenants])

  const errorCount = validation.errors.length
  const warningCount = validation.warnings.length

  const isModelActive = (m: AIModel) => m === model

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Left: model sidebar */}
      <aside className="flex-none w-72 border-r border-slate-200 bg-white flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <Sparkles size={16} className="text-crimson-600" />
          <span className="font-semibold text-sm tracking-tight">{t('ai.title', 'AI Import')}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {AI_MODELS.map((m) => {
            const active = m.value === model
            return (
              <button
                key={m.value}
                onClick={() => {
                  setModel(m.value)
                  setStep('prompt')
                  setRawJson('')
                  setParsed(null)
                  setParseError('')
                  setValidation({ valid: false, errors: [], warnings: [] })
                  setPreview([])
                  setResult(null)
                  setThreadMessages([])
                  setThreadDraft('')
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition ${active ? 'bg-crimson-50 text-crimson-700 border-r-2 border-crimson-600' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="w-5 text-center">{active ? <ArrowRight size={14} strokeWidth={2.5} /> : <Sparkles size={14} strokeWidth={1.5} />}</span>
                <span className={active ? 'font-medium' : 'font-normal'}>{MODEL_LABEL[m.value]}</span>
              </button>
            )
          })}
        </div>
        <div className="border-t border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">{t('ai.sidebarHint', 'Pick a model, then chat with its prompt and paste the returned JSON.')}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-crimson-600" />
            <div>
              <h1 className="text-lg font-semibold">{MODEL_LABEL[model]}</h1>
              <p className="text-xs text-slate-500">{MODEL_DESC[model]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={!effectivePrompt.trim()}
            >
              <Copy size={14} /> <span className="hidden sm:inline">{t('ai.copyPrompt', 'Copy prompt')}</span>
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1.5 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
            >
              {t('ai.back', 'Back')}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Step indicator */}
          <div className="flex gap-1 mb-4 px-1">
            {STEP_LABELS.map(([key, label], i) => {
              const active = step === key
              const done = stepDone(key)
              return (
                <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${
                    active ? 'bg-crimson-600 border-crimson-600 text-white' : done ? 'bg-slate-200 border-slate-200 text-slate-600' : 'bg-white border-slate-300 text-slate-400'
                  }`}>{i + 1}</span>
                  <span className={active ? 'font-semibold text-slate-800' : 'text-slate-500'}>{label}</span>
                </div>
              )
            })}
          </div>

          {/* STEP: Prompt + Chat */}
          {step === 'prompt' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-crimson-600 uppercase tracking-wider">
                    <MessageSquare size={12} /> {t('ai.chatThread', 'Chat thread')}
                  </span>
                  <button onClick={clearThread} className="text-xs text-slate-400 hover:text-crimson-600">{t('ai.clearThread', 'Clear')}</button>
                </div>
                <div className="flex flex-col gap-2 mb-3 max-h-64 overflow-y-auto pr-2">
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-crimson-100 flex items-center justify-center">
                      <Sparkles size={10} className="text-crimson-600" />
                    </div>
                    <div className="bg-slate-100 p-3 rounded-lg rounded-tl-none text-sm text-slate-700 break-words max-w-[90%] whitespace-pre-wrap">{effectivePrompt}</div>
                  </div>
                  {threadMessages.map((m) => (
                    <div key={m.id} className="flex gap-2 justify-end">
                      <div className="bg-crimson-600 text-white p-3 rounded-lg rounded-tr-none text-sm break-words max-w-[80%] whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-crimson-500 outline-none"
                    placeholder={t('ai.chatPlaceholder', 'Add a note to the prompt…')}
                    value={threadDraft}
                    onChange={(e) => setThreadDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendThreadMessage())}
                  />
                  <button onClick={sendThreadMessage} className="px-3 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={!threadDraft.trim()}>
                    <Send size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <Code2 size={12} /> {t('ai.promptToCopy', 'Prompt to copy')}
                  </span>
                  <button onClick={copyPrompt} className="flex items-center gap-1 text-xs text-crimson-600 hover:text-crimson-800">
                    <Copy size={14} /> {t('ai.copy', 'Copy')}
                  </button>
                </div>
                <div className="bg-slate-900 rounded p-3 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">{effectivePrompt}</div>
                <p className="mt-2 text-xs text-slate-500">{t('ai.promptHint', 'Copy this into your AI chat, then paste the returned JSON on the next step.')}</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep('paste')}
                  className="px-5 py-2 rounded-lg bg-crimson-600 text-white font-medium hover:bg-crimson-700 shadow-md"
                >
                  {t('ai.next', 'Next: Paste JSON')} <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </section>
          )}

          {/* STEP: Paste JSON */}
          {step === 'paste' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <Code2 size={12} /> {t('ai.pasteJson', 'Paste AI JSON')}
                  </span>
                  <button
                    onClick={() => setRawJson(exampleJson(model))}
                    className="text-xs text-slate-400 hover:text-crimson-600"
                  >
                    {t('ai.loadExample', 'Load example')}
                  </button>
                </div>
                <textarea
                  className="w-full rounded border border-slate-200 bg-white px-3 py-3 font-mono text-xs focus:ring-2 focus:ring-crimson-500 outline-none h-64"
                  placeholder={exampleJson(model)}
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                />
                {parseError && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setStep('prompt')} className="px-4 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
                    {t('ai.back', 'Back')}
                  </button>
                  <button
                    onClick={handleParse}
                    className="px-5 py-2 rounded-lg bg-crimson-600 text-white font-medium hover:bg-crimson-700 shadow-md disabled:opacity-50"
                    disabled={!rawJson.trim()}
                  >
                    {t('ai.validate', 'Validate')} <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP: Validate */}
          {step === 'validate' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <MessageSquare size={12} /> {t('ai.validation', 'Validation')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                    errorCount === 0 ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'
                  }`}>
                    {errorCount === 0 ? t('ai.valid', 'Valid') : `${errorCount} ${t('ai.errors', 'errors')}`}
                  </span>
                </div>
                {warningCount !== 0 && (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 mb-3">
                    {warningCount} {t('ai.warnings', 'warnings')} — review before importing.
                  </div>
                )}
                {validation.errors.length !== 0 && (
                  <ul className="text-xs text-red-600 space-y-1 mb-3">
                    {validation.errors.map((e, i) => (
                      <li key={i}>{`row ${e.row + 1} · ${e.field}: ${e.message}`}</li>
                    ))}
                  </ul>
                )}
                {validation.errors.length === 0 && validation.warnings.length === 0 && (
                  <p className="text-xs text-green-600">{t('ai.noIssues', 'No issues found.')}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep('paste')} className="px-4 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
                    {t('ai.edit', 'Edit JSON')}
                  </button>
                  <button onClick={toPreview} className="px-5 py-2 rounded-lg bg-crimson-600 text-white font-medium hover:bg-crimson-700 shadow-md">
                    {t('ai.preview', 'Preview table')} <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP: Preview (editable table) */}
          {step === 'preview' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-800">{t('ai.previewTable', 'Editable preview')}</h2>
                <span className="text-xs text-slate-500">{preview.length} {t('ai.rows', 'rows')}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-slate-500 font-medium w-16">#</th>
                      {fieldInputs(model).map((field) => (
                        <th key={field} className="px-3 py-2 text-slate-500 font-medium">{field}</th>
                      ))}
                      <th className="px-3 py-2 text-slate-500 font-medium w-20">{t('ai.action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, i) => {
                      const fields = fieldInputs(model)
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                          {fields.map((field) => {
                            const options = enumOptions(model, field)
                            const value = row.doc[field]
                            return (
                              <td key={field} className="px-3 py-2">
                                {options.length !== 0 ? (
                                  <select
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-crimson-500 outline-none"
                                    value={String(value ?? '')}
                                    onChange={(e) => updateCell(i, field, e.target.value)}
                                  >
                                    {options.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-2 focus:ring-crimson-500 outline-none"
                                    value={value == null ? '' : String(value)}
                                    onChange={(e) => updateCell(i, field, e.target.value)}
                                    placeholder="-"
                                  />
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeRow(i)}
                              className="px-2 py-1 rounded text-[10px] font-medium border border-red-200 text-red-600 hover:bg-red-50"
                              disabled={preview.length === 1}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={addRow}
                  className="px-4 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={14} /> {t('ai.addRow', 'Add row')}
                </button>
                <button onClick={() => setStep('validate')} className="px-4 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50">
                  {t('ai.back', 'Back')}
                </button>
                <button
                  onClick={handleExecute}
                  className="px-5 py-2 rounded-lg bg-crimson-600 text-white font-medium hover:bg-crimson-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={executing || errorCount !== 0 || !canWrite}
                >
                  {executing ? t('ai.importing', 'Importing…') : t('ai.proceed', 'Proceed & import')} <Play size={14} strokeWidth={2.5} />
                </button>
              </div>
              {!canWrite && (
                <p className="mt-2 text-xs text-red-600">{t('ai.adminOnly', 'Admin role required to import data.')}</p>
              )}
            </section>
          )}

          {/* STEP: Execute / Result */}
          {step === 'execute' && (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">{t('ai.result', 'Import result')}</h2>
                {result && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">{t('ai.created', 'Created')}</div>
                      <div className="font-semibold text-green-600">{result.created}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">{t('ai.updated', 'Updated')}</div>
                      <div className="font-semibold text-blue-600">{result.updated}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">{t('ai.skipped', 'Skipped')}</div>
                      <div className="font-semibold text-slate-500">{result.skipped}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-3">
                      <div className="text-slate-500 text-[10px] uppercase font-semibold">{t('ai.failed', 'Failed')}</div>
                      <div className="font-semibold text-red-600">{result.errors.length}</div>
                    </div>
                  </div>
                )}
                {result?.errors.length !== 0 && (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 overflow-y-auto max-h-40">
                    {result!.errors.map((e, i) => (
                      <div key={i} className="mb-1">{`• ${e}`}</div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setStep('preview')}
                    className="px-4 py-2 rounded border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {t('ai.back', 'Back')}
                  </button>
                  <button
                    onClick={() => {
                      setModel('gl-accounts')
                      setStep('prompt')
                      setRawJson('')
                      setParsed(null)
                      setParseError('')
                      setValidation({ valid: false, errors: [], warnings: [] })
                      setPreview([])
                      setResult(null)
                      setThreadMessages([])
                      setThreadDraft('')
                    }}
                    className="px-5 py-2 rounded-lg bg-crimson-600 text-white font-medium hover:bg-crimson-700 shadow-md"
                  >
                    {t('ai.newImport', 'New import')}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
