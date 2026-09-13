/* ─────────────────────────────────────────────────────────────
   Import / Export helpers for the Billing SPA
   ───────────────────────────────────────────────────────────── */

import { api } from './api'

/* ── Export ───────────────────────────────────────────────── */

/** Fetch all docs for a collection (handles pagination). */
export async function fetchAllDocs<T>(
  slug: string,
  tenantQuery: Record<string, unknown> = {},
  limit = 500,
): Promise<T[]> {
  const all: T[] = []
  let page = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api<{ docs: T[] }>(`/${slug}`, {
      query: { limit, page, depth: 0, ...tenantQuery },
    })
    all.push(...(res.docs || []))
    if (!res.docs || res.docs.length < limit) break
    page++
  }
  return all
}

/** Convert an array of objects to a CSV Blob with UTF-8 BOM for Excel compatibility. */
export function buildExportCsv<T extends Record<string, unknown>>(
  docs: T[],
  columns?: string[],
): Blob {
  if (docs.length === 0) {
    return new Blob(['\uFEFF'], { type: 'text/csv;charset=utf-8;' })
  }

  // Determine headers
  const headers = columns && columns.length > 0
    ? columns
    : Array.from(
        new Set(
          docs.flatMap((d) =>
            Object.keys(d).filter(
              (k) =>
                typeof d[k] !== 'object' ||
                d[k] === null ||
                (typeof d[k] === 'object' && !Array.isArray(d[k])),
            ),
          ),
        ),
      )

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') {
      const o = val as Record<string, unknown>
      val = o.name || o.title || o.fullName || o.id || JSON.stringify(o)
    }
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines: string[] = []
  lines.push(headers.map(escapeCell).join(','))

  for (const doc of docs) {
    const row = headers.map((h) => escapeCell(doc[h]))
    lines.push(row.join(','))
  }

  // Prepend \uFEFF BOM for Excel Devanagari/UTF-8 support
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
}

/** Build a JSON export blob with metadata header. */
export function buildExportJson<T>(
  collection: string,
  docs: T[],
  tenantName?: string,
): Blob {
  const payload = {
    _export: {
      collection,
      tenant: tenantName || null,
      exportedAt: new Date().toISOString(),
      count: docs.length,
      version: 1,
    },
    docs,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Import: Parse ────────────────────────────────────────── */

export type ParsedImport<T> = {
  collection: string
  docs: T[]
  meta: { tenant?: string; exportedAt?: string; count?: number; format?: 'json' | 'csv' }
}

/** Robust RFC-4180 compliant CSV parser with quote unescaping. */
export function parseCsvText(text: string): Record<string, unknown>[] {
  // Strip UTF-8 BOM if present
  const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"'
        i++ // skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentVal += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentVal.trim())
        currentVal = ''
      } else if (char === '\r') {
        // Skip carriage return if followed by newline
        if (nextChar === '\n') {
          i++
        }
        currentRow.push(currentVal.trim())
        lines.push(currentRow)
        currentRow = []
        currentVal = ''
      } else if (char === '\n') {
        currentRow.push(currentVal.trim())
        lines.push(currentRow)
        currentRow = []
        currentVal = ''
      } else {
        currentVal += char
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim())
    lines.push(currentRow)
  }

  // Filter empty lines
  const nonEmptyLines = lines.filter((row) => row.some((c) => c.length > 0))
  if (nonEmptyLines.length < 2) return []

  const rawHeaders = nonEmptyLines[0]
  // Normalize headers (camelCase and strip quotes/spaces)
  const headers = rawHeaders.map((h) => {
    const clean = h.trim()
    // Map common human/Nepali headers to field names
    const lower = clean.toLowerCase()
    if (lower === 'name' || lower === 'fullname' || lower === 'full name' || clean.includes('नाम')) return 'fullName'
    if (lower === 'phone' || lower === 'mobile' || lower === 'contact' || clean.includes('फोन') || clean.includes('सम्पर्क')) return 'phone'
    if (lower === 'email' || clean.includes('इमेल')) return 'email'
    if (lower === 'address' || lower === 'locality' || clean.includes('ठेगाना') || clean.includes('टोल')) return 'address'
    if (lower === 'ward' || clean.includes('वडा')) return 'ward'
    if (lower === 'blood' || lower === 'bloodgroup' || lower === 'blood group' || clean.includes('रक्त')) return 'bloodGroup'
    if (lower === 'code' || clean.includes('कोड')) return 'code'
    if (lower === 'balance' || lower === 'opening' || clean.includes('रकम') || clean.includes('मौज्दात')) return 'balance'
    return clean
  })

  const results: Record<string, unknown>[] = []
  for (let r = 1; r < nonEmptyLines.length; r++) {
    const row = nonEmptyLines[r]
    const doc: Record<string, unknown> = {}
    for (let c = 0; c < headers.length; c++) {
      const field = headers[c]
      if (field) {
        doc[field] = row[c] ?? ''
      }
    }
    results.push(doc)
  }

  return results
}

/** Parse an import file (JSON or CSV). Returns parsed docs or throws. */
export async function parseImportFile<T>(file: File): Promise<ParsedImport<T>> {
  const text = await file.text()
  const isCsv = file.name.toLowerCase().endsWith('.csv') || text.trim().startsWith('"') || text.includes(',')

  if (isCsv) {
    try {
      const docs = parseCsvText(text) as T[]
      if (docs.length === 0) {
        throw new Error('CSV file is empty or has no data rows')
      }
      return {
        collection: guessCollection(file.name),
        docs,
        meta: { count: docs.length, format: 'csv' },
      }
    } catch (e) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        // Might be JSON, fall through
      } else {
        throw e
      }
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Invalid file — expected valid CSV or JSON format')
  }

  if (raw && typeof raw === 'object' && 'docs' in raw && Array.isArray((raw as Record<string, unknown>).docs)) {
    const obj = raw as Record<string, unknown>
    const meta = (obj._export as Record<string, unknown>) || {}
    return {
      collection: (meta.collection as string) || guessCollection(file.name),
      docs: obj.docs as T[],
      meta: {
        tenant: meta.tenant as string | undefined,
        exportedAt: meta.exportedAt as string | undefined,
        count: meta.count as number | undefined,
        format: 'json',
      },
    }
  }

  // Bare array of docs
  if (Array.isArray(raw)) {
    return {
      collection: guessCollection(file.name),
      docs: raw as T[],
      meta: { count: raw.length, format: 'json' },
    }
  }

  throw new Error('Unrecognised import format — expected CSV or JSON with { docs: [...] }')
}

function guessCollection(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes('member')) return 'members'
  if (lower.includes('party')) return 'parties'
  if (lower.includes('item')) return 'items'
  if (lower.includes('account')) return 'accounts'
  if (lower.includes('journal')) return 'journal-entries'
  if (lower.includes('voucher') || lower.includes('document')) return 'documents'
  return 'unknown'
}

/* ── Import: Dedup ────────────────────────────────────────── */

export type DedupResult<T> = {
  /** Records with no match — safe to import directly. */
  newRecords: T[]
  /** Records that match an existing doc by id. */
  exactDuplicates: { imported: T; existing: T }[]
  /** Records that match by name (fuzzy). */
  similarRecords: { imported: T; existing: T; matchField: string }[]
}

const DEDUP_KEYS: Record<string, { key: string; field: string }[]> = {
  members: [{ key: 'fullName', field: 'fullName' }, { key: 'phone', field: 'phone' }],
  parties: [{ key: 'name', field: 'name' }, { key: 'phone', field: 'phone' }],
  items: [{ key: 'name', field: 'name' }, { key: 'code', field: 'code' }],
  accounts: [{ key: 'name', field: 'name' }, { key: 'code', field: 'code' }],
}

/** Compare imported docs against existing docs to find duplicates. */
export function classifyRecords<T extends Record<string, unknown>>(
  imported: T[],
  existing: T[],
  collection: string,
): DedupResult<T> {
  const result: DedupResult<T> = { newRecords: [], exactDuplicates: [], similarRecords: [] }
  const keys = DEDUP_KEYS[collection] || []

  // Build lookup maps from existing
  const byId = new Map<string | number, T>()
  for (const doc of existing) {
    const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
    if (id != null) byId.set(id as string | number, doc)
  }

  const byName = new Map<string, T>()
  for (const doc of existing) {
    for (const k of keys) {
      const val = String(doc[k.key] || '').toLowerCase().trim()
      if (val) byName.set(val, doc)
    }
  }

  for (const doc of imported) {
    // Check exact id match
    const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
    if (id != null && byId.has(id as string | number)) {
      result.exactDuplicates.push({ imported: doc, existing: byId.get(id as string | number)! })
      continue
    }

    // Check fuzzy/unique key match
    let foundSimilar = false
    for (const k of keys) {
      const val = String(doc[k.key] || '').toLowerCase().trim()
      if (val && byName.has(val)) {
        result.similarRecords.push({
          imported: doc,
          existing: byName.get(val)!,
          matchField: k.field,
        })
        foundSimilar = true
        break
      }
    }

    if (!foundSimilar) {
      result.newRecords.push(doc)
    }
  }

  return result
}

/* ── Import: Execute ──────────────────────────────────────── */

export type ImportAction = 'skip' | 'create' | 'update'

export async function executeImport<T extends Record<string, unknown>>(
  collection: string,
  records: { doc: T; action: ImportAction }[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }

  for (let i = 0; i < records.length; i++) {
    const { doc, action } = records[i]
    try {
      if (action === 'skip') {
        result.skipped++
      } else if (action === 'create') {
        // Remove id so server generates a new one
        const body = { ...doc }
        delete body.id
        delete body._id
        await api(`/${collection}`, { method: 'POST', body })
        result.created++
      } else if (action === 'update') {
        const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
        if (id == null) {
          result.errors.push(`Update failed: no id for record`)
        } else {
          const body = { ...doc }
          delete (body as Record<string, unknown>).id
          delete (body as Record<string, unknown>)._id
          await api(`/${collection}/${id}`, { method: 'PATCH', body })
          result.updated++
        }
      }
    } catch (err) {
      result.errors.push(`${action} failed for record: ${err instanceof Error ? err.message : String(err)}`)
    }
    onProgress?.(i + 1, records.length)
  }

  return result
}
