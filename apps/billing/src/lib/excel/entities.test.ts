/**
 * Entity registry integrity tests (MISSION.md M1).
 *
 * The registry is the single source of truth for Excel import/export:
 * one row per accounting entity → slug, sheet name, columns, dedup keys,
 * FK links, import order. These tests pin that contract so per-entity
 * Excel I/O (M2/M3) and the master workbook (M4/M5) can trust it.
 */
import { describe, it, expect } from 'vitest'
import { ENTITY_REGISTRY, type EntityExcelConfig } from './entities'

/** The 16 accounting collections that exist in Payload (src/collections). */
const PAYLOAD_SLUGS = [
  'fiscal-years',
  'account-groups',
  'gl-accounts',
  'tax-types',
  'membership-types',
  'members',
  'parties',
  'items',
  'opening-balances',
  'documents',
  'journal-entries',
  'fixed-assets',
  'stock-movements',
  'bank-statements',
  'expense-claims',
  'recurring-schedules',
] as const

describe('ENTITY_REGISTRY', () => {
  it('covers exactly the 16 accounting collections', () => {
    expect([...ENTITY_REGISTRY.map((e) => e.slug)].sort()).toEqual([...PAYLOAD_SLUGS].sort())
  })

  it('has unique slugs', () => {
    const slugs = ENTITY_REGISTRY.map((e) => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has unique, Excel-safe sheet names (≤31 chars, no []:*?/\\)', () => {
    const names = ENTITY_REGISTRY.map((e) => e.sheetName)
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length)
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(31)
      expect(name).not.toMatch(/[\[\]:*?/\\]/)
    }
  })

  it('has unique importOrder values, masters before transactions', () => {
    const orders = ENTITY_REGISTRY.map((e) => e.importOrder)
    expect(new Set(orders).size).toBe(orders.length)

    const maxMaster = Math.max(...ENTITY_REGISTRY.filter((e) => e.kind === 'master').map((e) => e.importOrder))
    const minTxn = Math.min(...ENTITY_REGISTRY.filter((e) => e.kind === 'transaction').map((e) => e.importOrder))
    expect(maxMaster).toBeLessThan(minTxn)
  })

  it('every entity has valid columns (key, header, width > 0)', () => {
    for (const e of ENTITY_REGISTRY) {
      expect(e.columns.length, `${e.slug} columns`).toBeGreaterThan(0)
      for (const col of e.columns) {
        expect(col.key, `${e.slug}.${col.key} key`).toBeTruthy()
        expect(col.header, `${e.slug}.${col.key} header`).toBeTruthy()
        expect(col.width, `${e.slug}.${col.key} width`).toBeGreaterThan(0)
      }
      // column keys unique per entity
      const keys = e.columns.map((c) => c.key)
      expect(new Set(keys).size, `${e.slug} unique keys`).toBe(keys.length)
    }
  })

  it('every dedup key references a real column of that entity', () => {
    for (const e of ENTITY_REGISTRY) {
      const keys = new Set(e.columns.map((c) => c.key))
      for (const k of e.dedupKeys) {
        expect(keys.has(k.key), `${e.slug} dedup key ${k.key}`).toBe(true)
        expect(k.field).toBeTruthy()
      }
    }
  })

  it('has labels and valid kinds', () => {
    for (const e of ENTITY_REGISTRY) {
      expect(e.label, `${e.slug} label`).toBeTruthy()
      expect(['master', 'transaction']).toContain(e.kind)
    }
  })

  it('every fkLink points at an existing entity and column', () => {
    const bySlug = new Map(ENTITY_REGISTRY.map((e) => [e.slug, e]))
    for (const e of ENTITY_REGISTRY) {
      for (const link of e.fkLinks ?? []) {
        const ref = bySlug.get(link.refSlug)
        expect(ref, `${e.slug}.${link.field} → ${link.refSlug}`).toBeDefined()
        expect(
          ref!.columns.map((c) => c.key),
          `${e.slug}.${link.field} → ${link.refSlug}.${link.refField}`,
        ).toContain(link.refField)
      }
    }
  })

  it('marks the chart of accounts as hierarchical', () => {
    const coa = ENTITY_REGISTRY.find((e) => e.slug === 'gl-accounts')
    expect(coa?.isHierarchical).toBe(true)
  })

  it('exposes a lookup helper by slug', () => {
    const get = (ENTITY_REGISTRY as unknown as { get?: (slug: string) => EntityExcelConfig | undefined })
    expect(typeof get.get).toBe('function')
    expect(get.get!('members')?.sheetName).toBe('Members')
    expect(get.get!('nope')).toBeUndefined()
  })
})
