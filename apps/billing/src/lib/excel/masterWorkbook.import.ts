/**
 * Master workbook import (MISSION.md M5, OBJ-3).
 *
 * parseMasterWorkbook     — manifest-driven parse of every sheet, `_`-derived
 *                            columns dropped, cross-sheet FK orphan report
 * importMasterWorkbook    — entities executed in manifest importOrder
 *                            (masters before transactions); each sheet is
 *                            deduped against the DB, then written through
 *                            executeImport (FK resolution against live data —
 *                            by the time a sheet runs, its master sheets have
 *                            already landed).
 */
import ExcelJS from 'exceljs'
import { ENTITY_REGISTRY } from './entities'
import { readMasterManifest, type MasterManifest } from './masterWorkbook'
import {
  classifyRecords,
  executeImport,
  fetchAllDocs,
  type ImportAction,
} from '../importExport'

export type OrphanRef = {
  sheet: string
  row: number
  field: string
  value: string
  refSheet: string
}

export type ParsedMaster = {
  manifest: MasterManifest
  /** slug → canonical docs (empty array when the sheet had no data). */
  sheets: Record<string, Record<string, unknown>[]>
  /** Rows whose FK business key exists nowhere in the workbook. */
  orphans: OrphanRef[]
  /** Registry slugs whose sheet is absent from the workbook. */
  missingSheets: string[]
}

function readCell(cell: ExcelJS.Cell): unknown {
  const val = cell.value as unknown
  if (val === null || val === undefined) return undefined
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((rt) => rt.text).join('')
    }
    if ('result' in o) return o.result
    if ('formula' in o) return undefined // no cached result (never opened in Excel)
    if ('hyperlink' in o) return o.text
    if ('text' in o) return o.text
    return undefined
  }
  return val
}

export async function parseMasterWorkbook(file: File): Promise<ParsedMaster> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const manifest = readMasterManifest(workbook)

  const sheets: ParsedMaster['sheets'] = {}
  const missingSheets: string[] = []

  for (const entry of manifest.entities) {
    const cfg = ENTITY_REGISTRY.get(entry.slug)
    const ws = workbook.getWorksheet(entry.sheet)
    if (!cfg || !ws) {
      missingSheets.push(entry.slug)
      sheets[entry.slug] = []
      continue
    }

    const headerToKey = new Map<string, string>()
    for (const c of cfg.columns) {
      headerToKey.set(c.header.trim().toLowerCase(), c.key)
      headerToKey.set(c.key.trim().toLowerCase(), c.key)
    }

    const headerCells: { col: number; key: string }[] = []
    ws.getRow(1).eachCell((cell, col) => {
      const raw = String(cell.value ?? '').trim()
      if (!raw || raw.startsWith('_')) return // derived display columns are skipped
      headerCells.push({ col, key: headerToKey.get(raw.toLowerCase()) ?? raw })
    })

    const docs: Record<string, unknown>[] = []
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const doc: Record<string, unknown> = {}
      let hasData = false
      for (const h of headerCells) {
        const val = readCell(row.getCell(h.col))
        doc[h.key] = val === undefined ? '' : val
        if (val !== undefined && val !== null && String(val).trim() !== '') hasData = true
      }
      if (hasData) docs.push(doc)
    }
    sheets[entry.slug] = docs
  }

  // Every registry entity is addressable, even when the sheet was absent.
  for (const cfg of ENTITY_REGISTRY) {
    if (!(cfg.slug in sheets)) {
      sheets[cfg.slug] = []
      if (!manifest.entities.some((e) => e.slug === cfg.slug)) missingSheets.push(cfg.slug)
    }
  }

  return { manifest, sheets, orphans: findOrphans(sheets), missingSheets }
}

/** Cross-sheet referential check: every FK business key must exist in the
 *  workbook's referenced sheet (the same values will resolve against the DB
 *  at execute time, in importOrder). */
function findOrphans(sheets: ParsedMaster['sheets']): OrphanRef[] {
  const orphans: OrphanRef[] = []
  for (const cfg of ENTITY_REGISTRY) {
    const docs = sheets[cfg.slug] ?? []
    for (const link of cfg.fkLinks ?? []) {
      const refCfg = ENTITY_REGISTRY.get(link.refSlug)
      if (!refCfg) continue
      const keys = new Set(
        (sheets[link.refSlug] ?? [])
          .map((d) => String(d[link.refField] ?? '').toLowerCase().trim())
          .filter(Boolean),
      )
      docs.forEach((doc, i) => {
        const raw = doc[link.field]
        if (raw === '' || raw === null || raw === undefined) return
        if (typeof raw === 'number') return // already an id
        const key = String(raw).toLowerCase().trim()
        if (!keys.has(key)) {
          orphans.push({
            sheet: cfg.sheetName,
            row: i + 2,
            field: link.field,
            value: String(raw),
            refSheet: refCfg.sheetName,
          })
        }
      })
    }
  }
  return orphans
}

export type SheetSummary = {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export type MasterImportSummary = {
  perSlug: Record<string, SheetSummary>
  totals: SheetSummary
}

/**
 * Import a parsed master workbook: each sheet (in importOrder) is classified
 * against the DB (new → create; exact/similar duplicates → skip by default),
 * then executed. Per-sheet failures are collected, never aborting later
 * sheets — masters fail-fast is enforced by dependency order + orphan
 * reporting before execution.
 */
export async function importMasterWorkbook(
  parsed: ParsedMaster,
  options: { onProgress?: (slug: string) => void } = {},
): Promise<MasterImportSummary> {
  const ordered = [...parsed.manifest.entities].sort(
    (a, b) => a.importOrder - b.importOrder,
  )
  const perSlug: Record<string, SheetSummary> = {}
  const totals: SheetSummary = { created: 0, updated: 0, skipped: 0, errors: [] }

  for (const entry of ordered) {
    options.onProgress?.(entry.slug)
    const docs = parsed.sheets[entry.slug] ?? []
    if (docs.length === 0) {
      perSlug[entry.slug] = { created: 0, updated: 0, skipped: 0, errors: [] }
      continue
    }

    let existing: Record<string, unknown>[] = []
    try {
      existing = await fetchAllDocs<Record<string, unknown>>(entry.slug)
    } catch {
      existing = [] // offline/unavailable — treat as empty, writes still queue
    }

    const dedup = classifyRecords(docs, existing, entry.slug)
    const records = [
      ...dedup.newRecords.map((doc) => ({ doc, action: 'create' as ImportAction })),
      ...dedup.exactDuplicates.map((p) => ({ doc: p.imported, action: 'skip' as ImportAction })),
      ...dedup.similarRecords.map((p) => ({ doc: p.imported, action: 'skip' as ImportAction })),
    ]

    const res = await executeImport(entry.slug, records)
    perSlug[entry.slug] = {
      created: res.created,
      updated: res.updated,
      skipped: res.skipped,
      errors: res.errors,
    }
    totals.created += res.created
    totals.updated += res.updated
    totals.skipped += res.skipped
    totals.errors.push(...res.errors.map((e) => `${entry.slug}: ${e}`))
  }

  return { perSlug, totals }
}
