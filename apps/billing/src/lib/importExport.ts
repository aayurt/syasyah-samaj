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
  meta: { tenant?: string; exportedAt?: string; count?: number }
}

/** Parse a JSON import file. Returns parsed docs or throws. */
export async function parseImportFile<T>(file: File): Promise<ParsedImport<T>> {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
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
      },
    }
  }

  // Bare array of docs
  if (Array.isArray(raw)) {
    return {
      collection: guessCollection(file.name),
      docs: raw as T[],
      meta: { count: raw.length },
    }
  }

  throw new Error('Unrecognised import format — expected { docs: [...] } or [...]')
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
  members: [{ key: 'fullName', field: 'fullName' }],
  parties: [{ key: 'name', field: 'name' }],
  items: [{ key: 'name', field: 'name' }],
  accounts: [{ key: 'name', field: 'name' }],
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

    // Check fuzzy name match
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
