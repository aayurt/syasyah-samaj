/* ─────────────────────────────────────────────────────────────
   Import / Export helpers for the Billing SPA
   ───────────────────────────────────────────────────────────── */

import { api } from './api'
import ExcelJS from 'exceljs'
import {
  ENTITY_REGISTRY,
  type EntityExcelConfig,
  type ExcelExportColumn,
  type ImportContext,
  type ValidationError,
} from './excel/entities'

// Types live with the registry (single source of truth); re-exported here
// so existing imports keep working.
export type { ExcelExportColumn, ValidationError, EntityExcelConfig, ImportContext }

/* ── Export ───────────────────────────────────────────────── */

/** Fetch all docs for a collection (handles pagination).
 *  `depth` > 0 populates relation objects so exports show display names. */
export async function fetchAllDocs<T>(
  slug: string,
  tenantQuery: Record<string, unknown> = {},
  limit = 500,
  depth = 0,
): Promise<T[]> {
  const all: T[] = []
  let page = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api<{ docs: T[] }>(`/${slug}`, {
      query: { limit, page, depth, ...tenantQuery },
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

/* ── Excel Export ──────────────────────────────────────────── */

export interface ExcelExportOptions {
  sheetName?: string
  columns?: ExcelExportColumn[]
  tenantName?: string
  meta?: Record<string, unknown>
}

/** Convert an array of objects to an Excel (.xlsx) Blob with metadata sheet. */
export async function buildExportExcel<T extends Record<string, unknown>>(
  collection: string,
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || collection
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Determine columns
  let columns: ExcelExportColumn[]
  if (options.columns && options.columns.length > 0) {
    columns = options.columns
  } else if (docs.length > 0) {
    columns = Object.keys(docs[0]).map((key) => ({ key, header: key }))
  } else {
    columns = []
  }

  // Set up headers
  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))

  // Style header row
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' }, // crimson-700
  }
  dataSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

  // Add data rows
  for (const doc of docs) {
    const row: Record<string, unknown> = {}
    for (const col of columns) {
      const val = doc[col.key]
      if (val === null || val === undefined) {
        row[col.key] = ''
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        const o = val as Record<string, unknown>
        row[col.key] = o.name || o.title || o.fullName || o.id || JSON.stringify(o)
      } else {
        row[col.key] = val
      }
    }
    dataSheet.addRow(row)
  }

  // Auto-filter
  if (columns.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: docs.length + 1, column: columns.length },
    }
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }

  const metaData = [
    { property: 'Collection', value: collection },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* ── Excel Import ──────────────────────────────────────────── */

/** Parse an Excel (.xlsx) file into ParsedImport structure. */
export async function parseExcelFile<T>(file: File): Promise<ParsedImport<T>> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  // Find the data sheet (first non-meta sheet)
  let dataSheet: ExcelJS.Worksheet | undefined
  for (const sheet of workbook.worksheets) {
    if (sheet.name !== '_Meta') {
      dataSheet = sheet
      break
    }
  }

  if (!dataSheet) {
    throw new Error('No data sheet found in Excel file')
  }

  // Read meta sheet if present
  let meta: ParsedImport<T>['meta'] = { count: 0, format: 'excel' }
  let metaCollection: string | undefined
  const metaSheet = workbook.getWorksheet('_Meta')
  if (metaSheet) {
    const metaObj: Record<string, unknown> = {}
    metaSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const prop = row.getCell(1).value as string
        const val = row.getCell(2).value
        if (prop) metaObj[prop] = val
      }
    })
    meta = {
      tenant: metaObj['Tenant'] as string | undefined,
      exportedAt: metaObj['Exported At'] as string | undefined,
      count: (metaObj['Record Count'] as number) || undefined,
      format: 'excel',
    }
    metaCollection = metaObj['Collection'] as string | undefined
  }

  // Get headers from first row
  const headerRow = dataSheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  // Normalize headers (same logic as CSV)
  const normalizedHeaders = headers.map((h) => {
    const clean = h.trim()
    const lower = clean.toLowerCase()
    // Bare `name` stays `name` (canonical field for parties/items/accounts —
    // renaming it to fullName would break their round-trip). Members map
    // `name` → `fullName` in the per-collection mapping step instead.
    if (lower === 'name') return 'name'
    if (lower === 'fullname' || lower === 'full name' || clean.includes('नाम')) return 'fullName'
    if (lower === 'phone' || lower === 'mobile' || lower === 'contact' || clean.includes('फोन') || clean.includes('सम्पर्क')) return 'phone'
    if (lower === 'email' || clean.includes('इमेल')) return 'email'
    if (lower === 'address' || lower === 'locality' || clean.includes('ठेगाना') || clean.includes('टोल')) return 'address'
    if (lower === 'ward' || clean.includes('वडा')) return 'ward'
    if (lower === 'blood' || lower === 'bloodgroup' || lower === 'blood group' || clean.includes('रक्त')) return 'bloodGroup'
    if (lower === 'code' || clean.includes('कोड')) return 'code'
    if (lower === 'balance' || lower === 'opening' || clean.includes('रकम') || clean.includes('मौज्दात')) return 'balance'
    return clean
  })

  // Read data rows
  const results: T[] = []
  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = normalizedHeaders[colNumber - 1]
      if (field) {
        let val: unknown = cell.value
        // Handle ExcelJS rich text, dates, formulas
        if (val && typeof val === 'object' && 'richText' in val) {
          val = (val as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
        } else if (val instanceof Date) {
          val = val.toISOString()
        } else if (typeof val === 'object' && val !== null && 'result' in val) {
          // Formula result
          val = (val as { result: unknown }).result
        }
        doc[field] = val ?? ''
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          hasData = true
        }
      }
    })
    if (hasData) {
      results.push(doc as T)
    }
  })

  return {
    // _Meta wins over the filename guess — master-workbook sheets and
    // renamed files still route to the right entity.
    collection: metaCollection || guessCollection(file.name),
    docs: results,
    meta: { ...meta, count: results.length },
  }
}

/* ── Import: Parse ────────────────────────────────────────── */

export type ParsedImport<T> = {
  collection: string
  docs: T[]
  meta: { tenant?: string; exportedAt?: string; count?: number; format?: 'json' | 'csv' | 'excel' }
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
    // Map common human/Nepali headers to field names. Bare `name` stays
    // `name` (parties/items/accounts round-trip); see parseExcelFile note.
    const lower = clean.toLowerCase()
    if (lower === 'name') return 'name'
    if (lower === 'fullname' || lower === 'full name' || clean.includes('नाम')) return 'fullName'
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

/** Parse an import file (JSON, CSV, or Excel). Returns parsed docs or throws. */
export async function parseImportFile<T>(file: File): Promise<ParsedImport<T>> {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
  const text = await file.text()
  const isCsv = file.name.toLowerCase().endsWith('.csv') || text.trim().startsWith('"') || text.includes(',')

  if (isExcel) {
    return parseEntityExcel<T>(file)
  }

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
    throw new Error('Invalid file — expected valid CSV, Excel, or JSON format')
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

  throw new Error('Unrecognised import format — expected CSV, Excel (.xlsx), or JSON with { docs: [...] }')
}

/**
 * Parse a single-entity sheet (or template) back into canonical docs.
 * Reads the slug from `_Meta` → applies that entity's header aliases,
 * drops `_`-prefixed derived columns, and flattens hierarchical CoA rows.
 */
export async function parseEntityExcel<T = Record<string, unknown>>(
  file: File,
): Promise<ParsedImport<T>> {
  // Guard: master workbooks import through excel/masterWorkbook.import —
  // parsing their _Index as a data sheet would silently produce garbage.
  const guard = new ExcelJS.Workbook()
  await guard.xlsx.load(await file.arrayBuffer())
  if (guard.getWorksheet('_Manifest')) {
    throw new Error(
      'This file is a master workbook — use the "Import ALL data" action instead of a single-entity import.',
    )
  }

  const parsed = await parseExcelFile<Record<string, unknown>>(file)
  const cfg = ENTITY_REGISTRY.get(parsed.collection)
  if (!cfg) return parsed as ParsedImport<T>

  // Header → canonical key: exporters write human headers ('Opening Balance')
  // while docs use camelCase keys ('openingBalance'). Match on both the
  // original header and the key, case-insensitively.
  const headerToKey = new Map<string, string>()
  for (const c of cfg.columns) {
    headerToKey.set(c.header.trim().toLowerCase(), c.key)
    headerToKey.set(c.key.trim().toLowerCase(), c.key)
  }

  const validTypes = new Set(['asset', 'liability', 'equity', 'income', 'expense'])
  let currentGroup = ''

  const docs = parsed.docs
    .map((doc) => {
      // 1. Remap normalized headers to canonical field keys.
      for (const key of Object.keys(doc)) {
        const mapped = headerToKey.get(String(key).trim().toLowerCase())
        if (mapped && mapped !== key) {
          doc[mapped] = doc[key]
          delete doc[key]
        }
      }
      // 2. Per-entity header aliases (e.g. members: name → fullName).
      for (const [from, to] of Object.entries(cfg.headerAliases || {})) {
        if (from !== to && from in doc && !(to in doc)) {
          doc[to] = doc[from]
          delete doc[from]
        }
      }
      // 3. Round-trip rule: `_`-prefixed columns are derived/display-only.
      for (const key of Object.keys(doc)) {
        if (key.startsWith('_')) delete doc[key]
      }
      return doc
    })
    .filter((doc) => {
      if (!cfg.isHierarchical) return true

      // Hierarchical CoA: rows without a valid type are group headers —
      // remember the group name, don't import them as accounts.
      if (!validTypes.has(String(doc.type || ''))) {
        currentGroup = String(doc.name || doc.code || '').trim()
        return false
      }
      if (!doc.group) doc.group = currentGroup
      if (typeof doc.name === 'string') doc.name = doc.name.trim()
      return true
    })

  return { ...parsed, docs, meta: { ...parsed.meta, count: docs.length } } as ParsedImport<T>
}

function guessCollection(filename: string): string {
  // Filename fallback only — xlsx files carry their slug in _Meta/Collection,
  // JSON in _export.collection. Order matters: more specific terms first.
  const lower = filename.toLowerCase()
  if (lower.includes('membership')) return 'membership-types'
  if (lower.includes('member')) return 'members'
  if (lower.includes('party') || lower.includes('parties')) return 'parties'
  if (lower.includes('account-group') || lower.includes('group')) return 'account-groups'
  if (lower.includes('account')) return 'gl-accounts'
  if (lower.includes('item')) return 'items'
  if (lower.includes('journal')) return 'journal-entries'
  if (lower.includes('voucher') || lower.includes('document')) return 'documents'
  if (lower.includes('fiscal')) return 'fiscal-years'
  if (lower.includes('tax')) return 'tax-types'
  if (lower.includes('opening')) return 'opening-balances'
  if (lower.includes('fixed') || lower.includes('asset')) return 'fixed-assets'
  if (lower.includes('stock')) return 'stock-movements'
  if (lower.includes('bank')) return 'bank-statements'
  if (lower.includes('expense')) return 'expense-claims'
  if (lower.includes('recurring')) return 'recurring-schedules'
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

// Business keys per entity — derived from the registry (ADR-0004).
const DEDUP_KEYS: Record<string, { key: string; field: string }[]> =
  Object.fromEntries(ENTITY_REGISTRY.map((e) => [e.slug, e.dedupKeys]))

/* ── Accounting Excel Features ─────────────────────────────── */

/** Build hierarchical Chart of Accounts Excel with indentation. */
export async function buildCoaExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || 'Chart of Accounts'
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Build hierarchy: group by group/type
  const groups = new Map<string, { name: string; children: T[] }>()
  const rootAccounts: T[] = []

  for (const doc of docs) {
    const group = String(doc.group || 'Ungrouped')
    if (!groups.has(group)) {
      groups.set(group, { name: group, children: [] })
    }
    groups.get(group)!.children.push(doc)
  }

  // Columns for CoA
  const columns: ExcelExportColumn[] = [
    { key: 'code', header: 'Code', width: 15 },
    { key: 'name', header: 'Name', width: 50 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'class', header: 'Class', width: 15 },
    { key: 'group', header: 'Group', width: 20 },
    { key: 'openingBalance', header: 'Opening Balance', width: 20 },
    { key: 'openingBalanceType', header: 'Dr/Cr', width: 10 },
  ]

  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))

  // Style header row
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }
  dataSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

  // Add grouped rows with indentation
  let rowIndex = 1
  for (const [groupName, { children }] of groups) {
    rowIndex++
    // Group header row
    const groupRow = dataSheet.addRow({
      name: groupName,
      type: '',
      class: '',
      group: '',
      openingBalance: 0,
      openingBalanceType: '',
    })
    groupRow.font = { bold: true, size: 12 }
    groupRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    groupRow.height = 25
    // Merge first two cells for group name. Merging suppresses the slave
    // cell on write — set the master cell AFTER merging so the name survives.
    dataSheet.mergeCells(rowIndex, 1, rowIndex, 2)
    dataSheet.getCell(rowIndex, 1).value = groupName

    // Child accounts with indentation
    for (const child of children) {
      rowIndex++
      const row = dataSheet.addRow({
        code: child.code,
        name: `  ${child.name}`, // indent with spaces
        type: child.type,
        class: child.class,
        group: groupName,
        openingBalance: child.openingBalance || 0,
        openingBalanceType: child.openingBalanceType || '',
      })
      row.alignment = { indent: 1 }
    }
  }

  // Auto-filter
  if (columns.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rowIndex, column: columns.length },
    }
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }

  const metaData = [
    { property: 'Collection', value: 'gl-accounts' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: 'Hierarchical CoA' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse hierarchical CoA Excel import. */
export async function parseCoaExcel<T>(file: File): Promise<ParsedImport<T>> {
  // Reuse parseExcelFile but with special handling for indented names
  const parsed = await parseExcelFile<T>(file)

  // Detect and flatten hierarchy: indented names indicate child of previous non-indented
  const results: T[] = []
  let currentGroup = ''

  for (const doc of parsed.docs) {
    const name = String((doc as any).name || '').trim()
    if (name && !name.startsWith('  ') && !name.startsWith('\t')) {
      currentGroup = name
      // This is a group header - we might skip it or add as a group account
      const withGroup = { ...doc, group: currentGroup } as T
      results.push(withGroup)
    } else if (name) {
      // This is an account under current group
      const withGroup = { ...doc, group: currentGroup } as T
      results.push(withGroup)
    }
  }

  return {
    ...parsed,
    docs: results,
  }
}

/** Build Journal Voucher 2-sheet Excel (Headers + Lines). */
export async function buildJournalExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Sheet 1: Journal Headers
  const headerSheet = workbook.addWorksheet('Journal Headers', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headerColumns: ExcelExportColumn[] = [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'date', header: 'Date', width: 15 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'narration', header: 'Narration', width: 50 },
    { key: 'fy', header: 'Fiscal Year', width: 15 },
    { key: 'status', header: 'Status', width: 15 },
    { key: 'totalAmount', header: 'Total Amount', width: 20 },
  ]

  headerSheet.columns = headerColumns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  headerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  // Group docs by voucherNo for headers
  const voucherMap = new Map<string, T>()
  for (const doc of docs) {
    const vn = String(doc.voucherNo || '')
    if (!voucherMap.has(vn)) {
      voucherMap.set(vn, doc)
    }
  }

  for (const [vn, doc] of voucherMap) {
    const debit = Number(doc.debit || 0)
    const credit = Number(doc.credit || 0)
    headerSheet.addRow({
      voucherNo: vn,
      date: doc.date,
      type: doc.type,
      narration: doc.narration,
      fy: doc.fy,
      status: doc.status,
      totalAmount: Math.max(debit, credit),
    })
  }

  // Sheet 2: Journal Lines
  const lineSheet = workbook.addWorksheet('Journal Lines', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const lineColumns: ExcelExportColumn[] = [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'account', header: 'Account', width: 30 },
    { key: 'accountCode', header: 'Account Code', width: 15 },
    { key: 'debit', header: 'Debit', width: 15 },
    { key: 'credit', header: 'Credit', width: 15 },
    { key: 'description', header: 'Description', width: 50 },
  ]

  lineSheet.columns = lineColumns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  lineSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  lineSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  for (const doc of docs) {
    lineSheet.addRow({
      voucherNo: doc.voucherNo,
      account: doc.account || doc.party,
      accountCode: doc.accountCode,
      debit: doc.debit || 0,
      credit: doc.credit || 0,
      description: doc.description || doc.narration,
    })
  }

  // Data validation on voucherNo column (must exist in Headers sheet)
  if (voucherMap.size > 0) {
    const voucherNos = Array.from(voucherMap.keys())
    // Note: ExcelJS dataValidations API may vary by version
    // This is a simplified version - full data validation would need proper API
    console.log('Data validation would be applied for voucherNos:', voucherNos)
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  const metaData = [
    { property: 'Collection', value: 'journal-entries' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Voucher Count', value: voucherMap.size },
    { property: 'Line Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: '2-Sheet Journal (Headers + Lines)' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse Journal 2-sheet Excel import. */
export async function parseJournalExcel<T extends Record<string, unknown>>(file: File): Promise<ParsedImport<T>> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  const headerSheet = workbook.getWorksheet('Journal Headers')
  const lineSheet = workbook.getWorksheet('Journal Lines')

  if (!headerSheet || !lineSheet) {
    throw new Error('Excel file must have "Journal Headers" and "Journal Lines" sheets')
  }

  // Read headers
  const headerRow = headerSheet.getRow(1)
  const headerHeaders: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headerHeaders[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  const headers: T[] = []
  headerSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = headerHeaders[colNumber - 1]
      if (field) {
        doc[field] = cell.value ?? ''
        hasData = true
      }
    })
    if (hasData) headers.push(doc as T)
  })

  // Read lines
  const lineRow = lineSheet.getRow(1)
  const lineHeaders: string[] = []
  lineRow.eachCell((cell, colNumber) => {
    lineHeaders[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  const lines: T[] = []
  lineSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = lineHeaders[colNumber - 1]
      if (field) {
        let val: unknown = cell.value
        if (val && typeof val === 'object' && 'richText' in val) {
          val = (val as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
        } else if (val instanceof Date) {
          val = val.toISOString()
        } else if (typeof val === 'object' && val !== null && 'result' in val) {
          val = (val as { result: unknown }).result
        }
        doc[field] = val ?? ''
        hasData = true
      }
    })
    if (hasData) lines.push(doc as T)
  })

  // Combine headers and lines - merge line data with header data by voucherNo
  const results: T[] = []
  for (const line of lines) {
    const vn = String((line as any).voucherNo || '')
    const header = headers.find((h) => String((h as any).voucherNo || '') === vn)
    if (header) {
      results.push({ ...header, ...line } as T)
    } else {
      // Orphan line - include with warning
      results.push({ ...line, _orphan: true } as T)
    }
  }

  return {
    collection: 'journal-entries',
    docs: results,
    meta: { count: results.length, format: 'excel' },
  }
}

/** Build Opening Balances Excel template. */
export async function buildOpeningBalancesExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || 'Opening Balances'
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const columns: ExcelExportColumn[] = [
    { key: 'accountCode', header: 'Account Code', width: 15 },
    { key: 'accountName', header: 'Account Name', width: 40 },
    { key: 'accountType', header: 'Account Type', width: 15 },
    { key: 'fiscalYear', header: 'Fiscal Year', width: 15 },
    { key: 'debitOpening', header: 'Debit Opening', width: 20 },
    { key: 'creditOpening', header: 'Credit Opening', width: 20 },
    { key: 'isBalanced', header: 'Balanced', width: 10 },
  ]

  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  for (const doc of docs) {
    const debit = Number((doc as any).debitOpening || 0)
    const credit = Number((doc as any).creditOpening || 0)
    dataSheet.addRow({
      accountCode: (doc as any).accountCode || (doc as any).code,
      accountName: (doc as any).accountName || (doc as any).name,
      accountType: (doc as any).accountType || (doc as any).type,
      fiscalYear: (doc as any).fiscalYear,
      debitOpening: debit,
      creditOpening: credit,
      isBalanced: debit === credit ? '✓' : '✗',
    })
  }

  // Formula row for totals
  const totalRow = docs.length + 2
  dataSheet.getRow(totalRow).font = { bold: true }
  dataSheet.getCell(`E${totalRow}`).value = { formula: `SUM(E2:E${docs.length + 1})` }
  dataSheet.getCell(`F${totalRow}`).value = { formula: `SUM(F2:F${docs.length + 1})` }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  const metaData = [
    { property: 'Collection', value: 'opening-balances' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: 'Opening Balances with Totals' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse Opening Balances Excel import. */
export async function parseOpeningBalancesExcel<T extends Record<string, unknown>>(file: File): Promise<ParsedImport<T>> {
  const parsed = await parseExcelFile<T>(file)

  // Validate: only balance sheet accounts, debits = credits
  const results: T[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const doc of parsed.docs) {
    const debit = Number((doc as any).debitOpening || 0)
    const credit = Number((doc as any).creditOpening || 0)
    totalDebit += debit
    totalCredit += credit

    // Add validation flag
    const validated = { ...doc, _balanced: debit === credit } as T
    results.push(validated)
  }

  // Add summary row
  results.push({
    accountCode: 'TOTAL',
    accountName: 'SUM',
    debitOpening: totalDebit,
    creditOpening: totalCredit,
    isBalanced: totalDebit === totalCredit ? '✓' : '✗',
  } as unknown as T)

  return {
    ...parsed,
    docs: results,
  }
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

/* ── Collection Export Configurations ─────────────────────── */

// Derived from the registry — every entity, canonical columns.
export const EXPORT_COLUMNS: Record<string, ExcelExportColumn[]> =
  Object.fromEntries(ENTITY_REGISTRY.map((e) => [e.slug, e.columns]))

export const EXPORT_CONFIGS: Record<string, { sheetName: string; isHierarchical?: boolean }> =
  Object.fromEntries(
    ENTITY_REGISTRY.map((e) => [e.slug, { sheetName: e.sheetName, isHierarchical: e.isHierarchical }]),
  )

/* ── Validation (rules live on the registry — see excel/entities.ts) ───── */

/**
 * Validate parsed rows for a collection. `valid` = clean rows only (zero
 * issues of any severity); rows with warnings are still importable — callers
 * surface them amber in the preview and the user decides (ADR-0004
 * three-bucket colour model).
 */
export function validateImportRows<T extends Record<string, unknown>>(
  docs: T[],
  collection: string,
): { valid: T[]; errors: ValidationError[] } {
  const valid: T[] = []
  const errors: ValidationError[] = []
  const cfg = ENTITY_REGISTRY.get(collection)

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]
    const rowNum = i + 2 // +1 for header, +1 for 0-index
    const rowErrors = cfg?.validate?.(doc) ?? []
    for (const e of rowErrors) {
      errors.push({ ...e, row: rowNum })
    }
    if (rowErrors.length === 0) {
      valid.push(doc)
    }
  }

  return { valid, errors }
}

/**
 * Build the FK resolver for one executeImport run: fetch each referenced
 * entity once, index business key → id per (slug, field).
 */
async function buildImportContext(cfg?: EntityExcelConfig): Promise<ImportContext> {
  const docsBySlug = new Map<string, Record<string, unknown>[]>()
  const maps = new Map<string, Map<string, number>>() // `${slug}|${field}` → value → id

  const ensureSlug = async (slug: string) => {
    if (!docsBySlug.has(slug)) {
      docsBySlug.set(slug, await fetchAllDocs<Record<string, unknown>>(slug))
    }
  }
  const ensureField = async (slug: string, field: string) => {
    const key = `${slug}|${field}`
    if (maps.has(key)) return
    await ensureSlug(slug)
    const map = new Map<string, number>()
    for (const d of docsBySlug.get(slug) ?? []) {
      const v = d[field]
      if (v !== null && v !== undefined && d.id !== null && d.id !== undefined) {
        map.set(String(v).toLowerCase().trim(), Number(d.id))
      }
    }
    maps.set(key, map)
  }

  for (const link of cfg?.fkLinks ?? []) {
    await ensureField(link.refSlug, link.refField)
  }

  const pending: string[] = []
  return {
    findId: (slug, field, value) => {
      if (value === null || value === undefined || value === '') return undefined
      if (typeof value === 'object') return (value as { id?: number }).id ?? undefined
      const hit = maps.get(`${slug}|${field}`)?.get(String(value).toLowerCase().trim())
      if (hit !== undefined) return hit
      if (typeof value === 'number') return value // already an id
      return undefined
    },
    missing: (slug, field, value) => {
      pending.push(`${field}: '${String(value)}' not found in ${slug}`)
    },
    takeMissing: () => {
      // The same FK can be flagged by resolveFks AND mapForApi — one message
      // per distinct failure is enough for the preview.
      const drained = [...new Set(pending)]
      pending.length = 0
      return drained
    },
  }
}

/** Replace FK business keys with existing record ids (per cfg.fkLinks). */
function resolveFks(
  cfg: EntityExcelConfig | undefined,
  doc: Record<string, unknown>,
  ctx: ImportContext,
): Record<string, unknown> {
  const out = { ...doc }
  for (const link of cfg?.fkLinks ?? []) {
    const raw = out[link.field]
    if (raw === null || raw === undefined || raw === '') continue
    const target = link.to ?? link.field
    const id = ctx.findId(link.refSlug, link.refField, raw)
    if (id === undefined) {
      ctx.missing(link.refSlug, link.field, raw)
      continue
    }
    out[target] = id
    if (target !== link.field) delete out[link.field]
  }
  return out
}

const TRUE_STRINGS = new Set(['true', 'yes', 'y', '1', 'on'])

function coerceBooleans(cfg: EntityExcelConfig | undefined, doc: Record<string, unknown>): void {
  for (const f of cfg?.booleanFields ?? []) {
    if (f in doc) {
      const v = doc[f]
      doc[f] =
        typeof v === 'boolean' ? v : TRUE_STRINGS.has(String(v ?? '').toLowerCase().trim())
    }
  }
}

/** Canonical doc → payload body; returns { errors } instead of a body when
 *  any FK failed to resolve (the record is skipped, nothing is POSTed). */
function prepareBody(
  cfg: EntityExcelConfig | undefined,
  ctx: ImportContext,
  rawDoc: Record<string, unknown>,
): { body?: Record<string, unknown>; errors: string[] } {
  const doc = { ...rawDoc }
  delete doc.id
  delete doc._id
  const resolved = resolveFks(cfg, doc, ctx)
  coerceBooleans(cfg, resolved)
  const body = cfg?.mapForApi ? cfg.mapForApi(resolved, ctx) : resolved
  const errors = ctx.takeMissing()
  if (errors.length > 0) return { errors }
  return { body, errors: [] }
}

/** Group flattened rows (journal lines) into one doc per groupBy key. */
function groupRecords<T extends Record<string, unknown>>(
  records: { doc: T; action: ImportAction }[],
  groupBy: string,
): { doc: T; action: ImportAction }[] {
  const groups = new Map<
    string,
    { doc: Record<string, unknown>; action: ImportAction; rows: Record<string, unknown>[] }
  >()
  for (const { doc, action } of records) {
    const key = String((doc as Record<string, unknown>)[groupBy] ?? '')
    let g = groups.get(key)
    if (!g) {
      g = { doc: { ...(doc as Record<string, unknown>) }, action, rows: [] }
      groups.set(key, g)
    }
    g.rows.push(doc as Record<string, unknown>)
  }
  return Array.from(groups.values()).map((g) => ({
    doc: { ...g.doc, _rows: g.rows } as unknown as T,
    action: g.action,
  }))
}

export async function executeImport<T extends Record<string, unknown>>(
  collection: string,
  records: { doc: T; action: ImportAction }[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] }
  const cfg = ENTITY_REGISTRY.get(collection)
  const ctx = await buildImportContext(cfg)
  const queue = cfg?.groupBy ? groupRecords(records, cfg.groupBy) : records

  // Atomic validation for opening-balances: all entries must reference existing Chart of Accounts headings
  if (collection === 'opening-balances') {
    for (const item of queue) {
      if (item.action === 'skip') continue
      const raw = item.doc as Record<string, unknown>
      const accountHeading = raw.accountCode || raw.accountName || raw.account || raw.code || raw.name
      const { errors } = prepareBody(cfg, ctx, raw)
      if (errors.length > 0 || !ctx.findId('gl-accounts', 'code', raw.accountCode ?? raw.code)) {
        const headingName = String(raw.accountName || raw.accountCode || accountHeading || 'Unknown')
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [
            `Account heading '${headingName}' was not found in Chart of Accounts. Please create the account heading before importing opening balances. The operation has been cancelled.`,
          ],
        }
      }
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const { doc, action } = queue[i]
    try {
      if (action === 'skip') {
        result.skipped++
      } else if (action === 'create') {
        const { body, errors } = prepareBody(cfg, ctx, doc)
        if (errors.length > 0) {
          result.errors.push(...errors)
        } else {
          await api(`/${collection}`, { method: 'POST', body })
          result.created++
        }
      } else if (action === 'update') {
        const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
        if (id == null) {
          result.errors.push(`Update failed: no id for record`)
        } else {
          const { body, errors } = prepareBody(cfg, ctx, doc)
          if (errors.length > 0) {
            result.errors.push(...errors)
          } else {
            await api(`/${collection}/${id}`, { method: 'PATCH', body })
            result.updated++
          }
        }
      }
    } catch (err) {
      result.errors.push(`${action} failed for record: ${err instanceof Error ? err.message : String(err)}`)
    }
    onProgress?.(i + 1, queue.length)
  }

  return result
}
