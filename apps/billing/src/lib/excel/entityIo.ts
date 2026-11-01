/**
 * Per-entity Excel I/O (MISSION.md M2, ADR-0004).
 *
 * Everything is registry-driven: one sheet per entity, headers from
 * `cfg.columns`, collection slug in `_Meta` for import routing, and
 * `_`-prefixed derived columns skipped on parse (master-workbook round-trip
 * rule — ExcelJS writes formulas without cached results).
 */
import ExcelJS from 'exceljs'
import { ENTITY_REGISTRY, type EntityExcelConfig } from './entities'
import { buildCoaExcel, parseEntityExcel } from '../importExport'

// Parse lives with the other import plumbing; re-exported here so callers
// can find build + parse side by side.
export { parseEntityExcel }

const BLOB_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFBE1A1A' }, // crimson-700
}
export { HEADER_FILL }

/**
 * Read a canonical column value from an API doc:
 *   - dotted paths (`idCardDetails.bloodGroup`)
 *   - arrays → JSON text (bank-statement rows, claim lines, …)
 *   - relation objects → display name (name/title/fullName/label/code/id/number)
 *   - falsy primitives (0 / false / '') preserved as-is
 */
export function getDocValue(
  doc: Record<string, unknown>,
  key: string,
): unknown {
  let val: unknown = doc
  for (const seg of key.split('.')) {
    if (val === null || val === undefined || typeof val !== 'object') return undefined
    val = (val as Record<string, unknown>)[seg]
  }
  if (val === null || val === undefined) return undefined
  if (Array.isArray(val)) return JSON.stringify(val)
  if (val instanceof Date) return val
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    const display = o.name ?? o.title ?? o.fullName ?? o.label ?? o.code ?? o.number ?? o.id
    return display === undefined ? JSON.stringify(o) : display
  }
  return val
}

function getCfg(slug: string): EntityExcelConfig {
  const cfg = ENTITY_REGISTRY.get(slug)
  if (!cfg) throw new Error(`"${slug}" is not in the registry`)
  return cfg
}

function addMetaSheet(
  workbook: ExcelJS.Workbook,
  cfg: EntityExcelConfig,
  options: EntityBuildOptions,
  extra: [string, string | number][] = [],
): void {
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = HEADER_FILL
  metaSheet.addRows([
    { property: 'Collection', value: cfg.slug },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Version', value: 1 },
    ...extra,
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ])
}

export function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = HEADER_FILL
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}

export interface EntityBuildOptions {
  sheetName?: string
  tenantName?: string
  meta?: Record<string, unknown>
}

/** Build a one-sheet Excel export for a registry entity. */
export async function buildEntityExcel(
  slug: string,
  docs: Record<string, unknown>[],
  options: EntityBuildOptions = {},
): Promise<Blob> {
  const cfg = getCfg(slug)

  // Hierarchical chart of accounts keeps its specialized builder
  // (group header rows + indented children).
  if (cfg.isHierarchical && cfg.slug === 'gl-accounts') {
    return buildCoaExcel(docs, options)
  }

  // Expand one API doc into row(s) where needed (journal lines → rows).
  const rows = cfg.expand ? docs.flatMap((d) => cfg.expand!(d)) : docs

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const dataSheet = workbook.addWorksheet(options.sheetName || cfg.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  dataSheet.columns = cfg.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  styleHeader(dataSheet.getRow(1))

  for (const row of rows) {
    const out: Record<string, unknown> = {}
    for (const c of cfg.columns) {
      const val = getDocValue(row, c.source ?? c.key)
      out[c.key] = val === undefined ? '' : val
    }
    dataSheet.addRow(out)
  }

  if (cfg.columns.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: cfg.columns.length },
    }
  }

  addMetaSheet(workbook, cfg, options, [
    ['Record Count', rows.length],
    ['Format', cfg.expand ? 'Expanded Lines' : 'Entity Sheet'],
  ])

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: BLOB_TYPE })
}

/** Downloadable blank template: headers + one example row + `_ReadMe` glossary. */
export async function buildTemplate(slug: string): Promise<Blob> {
  const cfg = getCfg(slug)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Data sheet MUST come first so parseEntityExcel picks it up.
  const dataSheet = workbook.addWorksheet(cfg.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  dataSheet.columns = cfg.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  styleHeader(dataSheet.getRow(1))

  const example: Record<string, unknown> = {}
  for (const c of cfg.columns) {
    example[c.key] = cfg.example?.[c.key] ?? ''
  }
  dataSheet.addRow(example)

  // Glossary
  const readme = workbook.addWorksheet('_ReadMe')
  readme.columns = [
    { header: 'Header', key: 'header', width: 30 },
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Notes', key: 'notes', width: 60 },
  ]
  readme.getRow(1).font = { bold: true }
  const title = readme.addRow(['', '', ''])
  title.getCell(1).value = `${cfg.label} — import template`
  title.getCell(1).font = { bold: true, size: 14 }
  const how = readme.addRow(['', '', ''])
  how.getCell(1).value = 'How to use'
  how.getCell(1).font = { bold: true }
  readme.addRow(['', '', '1. Fill one row per record — keep the header row untouched.'])
  readme.addRow(['', '', '2. Delete the example row.'])
  readme.addRow(['', '', '3. Save as .xlsx, then import via Data Management → Import.'])
  readme.addRow(['', '', ''])
  const glossaryHead = readme.addRow(['Header', 'Field', 'Notes'])
  glossaryHead.font = { bold: true }
  const fkByField = new Map((cfg.fkLinks || []).map((l) => [l.field, l]))
  for (const c of cfg.columns) {
    const fk = fkByField.get(c.key)
    const notes = [
      fk ? `Linked to ${fk.refSlug} → ${fk.refField}` : '',
      c.header.includes('(JSON)') ? 'Array stored as JSON text' : '',
      c.source ? `Reads ${c.source} from the API` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    readme.addRow({ header: c.header, field: c.key, notes })
  }

  addMetaSheet(workbook, cfg, {}, [['Record Count', 1], ['Format', 'Template']])

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: BLOB_TYPE })
}
