/**
 * Master workbook export (MISSION.md M4, OBJ-3).
 *
 * One .xlsx containing the whole tenant:
 *   _Index    — hyperlinks to every sheet, live COUNTA record counts,
 *               Trial-Balance check formula (must equal 0)
 *   _Manifest — FormatVersion/Tenant/ExportedAt/EntityCount + a
 *               sheet → slug → importOrder → columns table (drives M5 import)
 *   1 sheet per registry entity (importOrder sequence)
 *
 * Linking (4 layers, ADR-0004 / MISSION §4.4):
 *   1. FK business keys as plain values (authoritative, imported as-is)
 *   2. `_`-prefixed derived display columns — INDEX/MATCH across sheets
 *      (skipped on import: ExcelJS writes formulas without cached results)
 *   3. SUMIF cross-sheet totals + balance flag on Vouchers; TB check in _Index
 *   4. Data-validation dropdowns on FK columns sourced from the ref sheet
 */
import ExcelJS from 'exceljs'
import { ENTITY_REGISTRY, type EntityExcelConfig } from './entities'
import { getDocValue, styleHeader } from './entityIo'

export const MASTER_FORMAT_VERSION = 1
const SHEET_PREFIX_ORDER = ['_Index', '_Manifest'] as const
const BLOB_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** 1 → 'A', 27 → 'AA' */
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function keyIndex(cfg: EntityExcelConfig, key: string): number {
  const idx = cfg.columns.findIndex((c) => c.key === key)
  return idx >= 0 ? idx + 1 : -1
}

/** Prefer a human display column (name/label/…) distinct from the ref field. */
function displayColumn(
  refCfg: EntityExcelConfig,
  refField: string,
): { key: string; index: number } {
  const preferred = ['name', 'label', 'fullName', 'number', 'code', 'description', 'phone', 'docType']
  const candidates = [
    ...preferred.filter((k) => k !== refField),
    ...refCfg.columns.map((c) => c.key).filter((k) => k !== refField),
  ]
  for (const key of candidates) {
    const index = keyIndex(refCfg, key)
    if (index > 0) return { key, index }
  }
  // Single-column ref edge case: fall back to the ref field itself.
  return { key: refField, index: Math.max(keyIndex(refCfg, refField), 1) }
}

export interface MasterWorkbookOptions {
  tenantName?: string
}

export async function buildMasterWorkbook(
  docsBySlug: Record<string, Record<string, unknown>[]>,
  options: MasterWorkbookOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const ordered = [...ENTITY_REGISTRY].sort((a, b) => a.importOrder - b.importOrder)
  const sheetNames = new Map(ordered.map((e) => [e.slug, e.sheetName]))

  const journalCfg = ENTITY_REGISTRY.get('journal-entries')
  const indexSheet = buildIndex(workbook, ordered, options)
  buildManifest(workbook, ordered, options)

  for (const cfg of ordered) {
    const docs = docsBySlug[cfg.slug] ?? []
    writeEntitySheet(workbook, cfg, docs, sheetNames, journalCfg)
  }

  // TB check lives at the bottom of _Index once the journal sheet exists.
  appendTbCheck(indexSheet, ENTITY_REGISTRY.get('journal-entries'))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: BLOB_TYPE })
}

/* ── _Index ────────────────────────────────────────────────────────────── */

function buildIndex(
  workbook: ExcelJS.Workbook,
  ordered: EntityExcelConfig[],
  options: MasterWorkbookOptions,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('_Index')
  sheet.columns = [
    { key: 'a', width: 46 },
    { key: 'b', width: 22 },
    { key: 'c', width: 18 },
  ]

  const title = sheet.addRow(['Syasyah Samaj — All Data (master workbook)'])
  title.getCell(1).font = { bold: true, size: 14 }
  const meta = sheet.addRow([
    `Tenant: ${options.tenantName || 'default'} · Exported: ${new Date().toISOString()}`,
  ])
  meta.getCell(1).font = { color: { argb: 'FF666666' } }
  sheet.addRow([])

  const header = sheet.addRow(['Sheet', 'Records', 'Open'])
  header.font = { bold: true }

  for (const cfg of ordered) {
    const countFormula = `COUNTA('${cfg.sheetName}'!A:A)-1`
    sheet.addRow([
      { text: cfg.sheetName, hyperlink: `#'${cfg.sheetName}'!A1` },
      { formula: `=${countFormula}` },
      { text: '↗', hyperlink: `#'${cfg.sheetName}'!A1` },
    ])
  }
  return sheet
}

function appendTbCheck(indexSheet: ExcelJS.Worksheet, journal?: EntityExcelConfig): void {
  if (!journal) return
  const debitCol = colLetter(keyIndex(journal, 'debit'))
  const creditCol = colLetter(keyIndex(journal, 'credit'))
  const row = indexSheet.addRow([
    'Trial Balance check (must be 0)',
    { formula: `=ROUND(SUM('${journal.sheetName}'!${debitCol}:${debitCol})-SUM('${journal.sheetName}'!${creditCol}:${creditCol}),2)` },
  ])
  row.getCell(1).font = { bold: true }
}

/* ── _Manifest ─────────────────────────────────────────────────────────── */

function buildManifest(
  workbook: ExcelJS.Workbook,
  ordered: EntityExcelConfig[],
  options: MasterWorkbookOptions,
): void {
  const sheet = workbook.addWorksheet('_Manifest')
  sheet.columns = [
    { key: 'a', width: 24 },
    { key: 'b', width: 64 },
    { key: 'c', width: 16 },
    { key: 'd', width: 90 },
  ]
  sheet.addRow(['FormatVersion', MASTER_FORMAT_VERSION])
  sheet.addRow(['Tenant', options.tenantName || 'default'])
  sheet.addRow(['ExportedAt', new Date().toISOString()])
  sheet.addRow(['EntityCount', ordered.length])
  sheet.addRow([])
  const header = sheet.addRow(['Sheet', 'Slug', 'ImportOrder', 'Columns'])
  header.font = { bold: true }
  for (const cfg of ordered) {
    sheet.addRow([
      cfg.sheetName,
      cfg.slug,
      cfg.importOrder,
      cfg.columns.map((c) => c.key).join(','),
    ])
  }
}

export interface MasterManifest {
  version: number
  tenant?: string
  exportedAt?: string
  entities: { sheet: string; slug: string; importOrder: number; columns: string[] }[]
}

/** Read the _Manifest sheet — the M5 import entry point. */
export function readMasterManifest(workbook: ExcelJS.Workbook): MasterManifest {
  const sheet = workbook.getWorksheet('_Manifest')
  if (!sheet) throw new Error('Missing _Manifest sheet — not a master workbook')

  const kv: Record<string, unknown> = {}
  const entities: MasterManifest['entities'] = []
  let inTable = false

  sheet.eachRow((row) => {
    const c1 = String(row.getCell(1).value ?? '').trim()
    if (c1 === 'Sheet') {
      inTable = true
      return
    }
    if (inTable) {
      if (!c1) return
      entities.push({
        sheet: c1,
        slug: String(row.getCell(2).value ?? ''),
        importOrder: Number(row.getCell(3).value || 0),
        columns: String(row.getCell(4).value ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
    } else if (c1) {
      kv[c1] = row.getCell(2).value
    }
  })

  return {
    version: Number(kv.FormatVersion || 0),
    tenant: kv.Tenant != null ? String(kv.Tenant) : undefined,
    exportedAt: kv.ExportedAt != null ? String(kv.ExportedAt) : undefined,
    entities,
  }
}

/* ── Entity sheets (canonical columns + derived link columns) ──────────── */

function writeEntitySheet(
  workbook: ExcelJS.Workbook,
  cfg: EntityExcelConfig,
  docs: Record<string, unknown>[],
  sheetNames: Map<string, string>,
  journalCfg?: EntityExcelConfig,
): void {
  const sheet = workbook.addWorksheet(cfg.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const links = cfg.fkLinks ?? []
  const isVouchers = cfg.slug === 'documents' && journalCfg
  const extraCols = [
    ...links.map((l) => ({ key: `_${l.field}`, header: `_${l.field} (linked)`, width: 30 })),
    ...(isVouchers
      ? [
          { key: '_debitTotal', header: '_debitTotal', width: 16 },
          { key: '_creditTotal', header: '_creditTotal', width: 16 },
          { key: '_balanced', header: '_balanced', width: 12 },
        ]
      : []),
  ]

  sheet.columns = [
    ...cfg.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || Math.max(c.header.length, 15),
    })),
    ...extraCols,
  ]
  styleHeader(sheet.getRow(1))

  // Expand (journal lines) + write canonical values.
  const rows = cfg.expand ? docs.flatMap((d) => cfg.expand!(d)) : docs
  for (const row of rows) {
    const out: Record<string, unknown> = {}
    for (const c of cfg.columns) {
      const val = getDocValue(row, c.source ?? c.key)
      out[c.key] = val === undefined ? '' : val
    }
    // Derived columns are filled with formulas after the row lands.
    sheet.addRow(out)
  }

  const lastRow = rows.length + 1
  if (cfg.columns.length + extraCols.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(lastRow, 1), column: cfg.columns.length + extraCols.length },
    }
  }

  // Layer 2 + 4: INDEX/MATCH display formulas + FK dropdowns per data row.
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const refSlug = link.refSlug
    const refCfg = ENTITY_REGISTRY.get(refSlug)
    const refSheetName = sheetNames.get(refSlug) ?? refCfg?.sheetName
    if (!refCfg || !refSheetName) continue

    const keyIdx = keyIndex(cfg, link.field)
    if (keyIdx <= 0) continue
    const refIdx = keyIndex(refCfg, link.refField)
    const disp = displayColumn(refCfg, link.refField)
    const derivedIdx = cfg.columns.length + 1 + i

    for (let r = 2; r <= lastRow; r++) {
      const keyCell = `${colLetter(keyIdx)}${r}`
      // Layer 2: display value from the referenced sheet.
      sheet.getCell(r, derivedIdx).value = {
        formula: `IFERROR(INDEX('${refSheetName}'!$${colLetter(disp.index)}:$${colLetter(disp.index)},MATCH(${keyCell},'${refSheetName}'!$${colLetter(refIdx)}:$${colLetter(refIdx)},0)),"⚠ missing")`,
      }
      // Layer 4: dropdown sourced from the referenced key column.
      sheet.getCell(r, keyIdx).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [
          `='${refSheetName}'!$${colLetter(refIdx)}$2:$${colLetter(refIdx)}$500`,
        ],
      }
    }
  }

  // Layer 3: SUMIF totals + balance flag on the Vouchers sheet.
  if (isVouchers && journalCfg) {
    const jKey = keyIndex(journalCfg, 'voucherNo')
    const jDebit = keyIndex(journalCfg, 'debit')
    const jCredit = keyIndex(journalCfg, 'credit')
    const ownKey = keyIndex(cfg, 'number') // voucher number column
    const debitIdx = cfg.columns.length + links.length + 1
    const creditIdx = debitIdx + 1
    const balancedIdx = debitIdx + 2
    const jSheet = `'${journalCfg.sheetName}'`

    for (let r = 2; r <= lastRow; r++) {
      const keyCell = `${colLetter(ownKey)}${r}`
      sheet.getCell(r, debitIdx).value = {
        formula: `SUMIF(${jSheet}!$${colLetter(jKey)}:$${colLetter(jKey)},${keyCell},${jSheet}!$${colLetter(jDebit)}:$${colLetter(jDebit)})`,
      }
      sheet.getCell(r, creditIdx).value = {
        formula: `SUMIF(${jSheet}!$${colLetter(jKey)}:$${colLetter(jKey)},${keyCell},${jSheet}!$${colLetter(jCredit)}:$${colLetter(jCredit)})`,
      }
      const debitCell = `${colLetter(debitIdx)}${r}`
      const creditCell = `${colLetter(creditIdx)}${r}`
      sheet.getCell(r, balancedIdx).value = {
        formula: `IF(${debitCell}=${creditCell},"✓","✗")`,
      }
    }
  }
}
