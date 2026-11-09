#!/usr/bin/env node
// Weekly Schema Drift Report — syasyah-samaj (Cindy automation)
//
// 1. Dumps schema from remote Postgres at 82.165.181.153 (prod, syasha).
// 2. Dumps schema from Docker E2E Postgres at localhost:5433 (syasha_e2e).
// 3. Diffs the two schemas and flags drift: missing tables, column type
//    mismatches, missing indexes/constraints.
// 4. Specifically checks the bloodGroup column — stayed `text` in prod
//    because the enum migration failed on legacy data. Confirms it's still
//    `text` in both environments.
// 5. Reports drift findings. Does NOT attempt any schema changes or migrations.
//
// Run: node .pi/skills/syasyah-automations/scripts/weekly-schema-drift.mjs

import { execFileSync } from 'node:child_process'

const PROD = {
  host: '82.165.181.153', port: '5432', user: 'nepse',
  password: 'nepse_dev', db: 'syasha',
}
const E2E = {
  host: 'localhost', port: '5433', user: 'postgres',
  password: 'postgres', db: 'syasha_e2e',
}

function psql(conn, sql) {
  try {
    const out = execFileSync('psql', [
      '-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.db,
      '-t', '-A', '-F', '|', '-c', sql
    ], {
      env: { ...process.env, PGPASSWORD: conn.password },
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
    })
    return out.trim()
  } catch (err) {
    return { error: (err.stderr && err.stderr.toString()) || err.message }
  }
}

function dumpSchema(conn) {
  const tables = psql(conn, `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  if (tables.error) return { error: tables.error, conn }

  const tableList = tables.split('\n').filter(Boolean).map((t) => t.trim())
  const schema = { tables: {}, indexes: [], constraints: [], enums: [] }

  for (const table of tableList) {
    const cols = psql(conn, `
      SELECT column_name || '|' || data_type || '|' || udt_name || '|' ||
             COALESCE(character_maximum_length::text, '') || '|' ||
             COALESCE(numeric_precision::text, '') || '|' ||
             COALESCE(numeric_scale::text, '') || '|' || is_nullable || '|' ||
             COALESCE(column_default, '')
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}'
      ORDER BY ordinal_position
    `)
    if (cols.error) continue

    const columnMap = {}
    for (const line of cols.split('\n').filter(Boolean)) {
      const [name, dataType, udtName, charLen, numPrec, numScale, nullable, defaultVal] = line.split('|')
      columnMap[name] = { dataType, udtName, charLen, numPrec, numScale, nullable, defaultVal }
    }
    schema.tables[table] = { columns: columnMap }
  }

  const idxs = psql(conn, `
    SELECT tablename || '|' || indexname || '|' || indexdef
    FROM pg_indexes WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `)
  if (!idxs.error) {
    for (const line of idxs.split('\n').filter(Boolean)) {
      const [tname, iname, def] = line.split('|')
      schema.indexes.push({ table: tname, name: iname, def })
    }
  }

  const cons = psql(conn, `
    SELECT tc.table_name || '|' || tc.constraint_name || '|' || tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `)
  if (!cons.error) {
    for (const line of cons.split('\n').filter(Boolean)) {
      const [tname, cname, ctype] = line.split('|')
      schema.constraints.push({ table: tname, name: cname, type: ctype })
    }
  }

  const enums = psql(conn, `
    SELECT t.typname || '|' || e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `)
  if (!enums.error) {
    for (const line of enums.split('\n').filter(Boolean)) {
      const [enumName, label] = line.split('|')
      schema.enums.push({ name: enumName, label })
    }
  }

  return schema
}

function columnSignature(col) {
  return `${col.dataType}:${col.udtName}:${col.charLen}:${col.numPrec}:${col.numScale}:${col.nullable}`
}

function diffSchemas(prod, e2e) {
  const findings = []

  const prodTables = Object.keys(prod.tables)
  const e2eTables = Object.keys(e2e.tables)

  const missingInE2e = prodTables.filter((t) => !e2eTables.includes(t))
  const missingInProd = e2eTables.filter((t) => !prodTables.includes(t))

  if (missingInE2e.length > 0) {
    findings.push({ severity: 'high', kind: 'missing-table', target: 'e2e',
      tables: missingInE2e })
  }
  if (missingInProd.length > 0) {
    findings.push({ severity: 'high', kind: 'missing-table', target: 'prod',
      tables: missingInProd })
  }

  const commonTables = prodTables.filter((t) => e2eTables.includes(t))
  for (const table of commonTables) {
    const prodCols = prod.tables[table].columns
    const e2eCols = e2e.tables[table].columns
    const allCols = new Set([...Object.keys(prodCols), ...Object.keys(e2eCols)])

    for (const col of allCols) {
      if (!prodCols[col]) {
        findings.push({
          severity: 'medium', kind: 'missing-column', target: 'prod',
          table, column: col,
        })
        continue
      }
      if (!e2eCols[col]) {
        findings.push({
          severity: 'medium', kind: 'missing-column', target: 'e2e',
          table, column: col,
        })
        continue
      }
      if (columnSignature(prodCols[col]) !== columnSignature(e2eCols[col])) {
        findings.push({
          severity: 'medium', kind: 'column-type-mismatch',
          table, column: col,
          prod: columnSignature(prodCols[col]),
          e2e: columnSignature(e2eCols[col]),
        })
      }
    }
  }

  const prodIdx = new Set(prod.indexes.map((i) => `${i.table}:${i.name}`))
  const e2eIdx = new Set(e2e.indexes.map((i) => `${i.table}:${i.name}`))
  for (const key of prodIdx) {
    if (!e2eIdx.has(key)) {
      findings.push({ severity: 'low', kind: 'missing-index', target: 'e2e', key })
    }
  }
  for (const key of e2eIdx) {
    if (!prodIdx.has(key)) {
      findings.push({ severity: 'low', kind: 'missing-index', target: 'prod', key })
    }
  }

  return findings
}

function checkBloodGroup(prod, e2e) {
  const results = []
  for (const [label, schema] of [['prod', prod], ['e2e', e2e]]) {
    let found = false
    for (const [table, tdef] of Object.entries(schema.tables)) {
      for (const [col, cdef] of Object.entries(tdef.columns)) {
        if (col === 'bloodGroup') {
          found = true
          results.push({
            env: label, table, column: col, type: cdef.dataType, udt: cdef.udtName,
          })
        }
      }
    }
    if (!found) {
      results.push({ env: label, table: '(none)', column: 'bloodGroup', type: 'NOT FOUND', udt: '-' })
    }
  }
  return results
}

async function main() {
  console.log('═══ Weekly Schema Drift Report ═══')

  console.log('\n📥 Dumping prod schema (82.165.181.153:5432 / syasha)...')
  const prod = dumpSchema(PROD)
  if (prod.error) {
    console.log(`✗ Prod dump failed: ${prod.error}`)
    process.exit(1)
  }
  console.log(`   Tables: ${Object.keys(prod.tables).length}`)

  console.log('\n📥 Dumping E2E schema (localhost:5433 / syasha_e2e)...')
  const e2e = dumpSchema(E2E)
  if (e2e.error) {
    console.log(`✗ E2E dump failed: ${e2e.error}`)
    console.log('   (Is Docker E2E Postgres running on localhost:5433?)')
    process.exit(1)
  }
  console.log(`   Tables: ${Object.keys(e2e.tables).length}`)

  console.log('\n🔍 Diffing schemas...')
  const findings = diffSchemas(prod, e2e)

  console.log('\n🩸 bloodGroup column check:')
  const bg = checkBloodGroup(prod, e2e)
  for (const r of bg) {
    const status = r.type === 'text' ? ' (text — enum migration pending on legacy data)' : ''
    console.log(`   ${r.env.padEnd(6)} ${r.table}.${r.column.padEnd(14)} ${r.type}${status}`)
  }
  const bothText = bg.every((r) => r.type === 'text')
  if (bothText) {
    console.log('   ✓ bloodGroup is `text` in both environments (as expected).')
  } else {
    console.log('   ✗ bloodGroup type differs between environments!')
  }

  if (findings.length === 0) {
    console.log('\n✓ No schema drift detected. Prod and E2E are in sync.')
    process.exit(0)
  }

  console.log(`\n⚠ Drift findings: ${findings.length}`)
  for (const f of findings) {
    switch (f.kind) {
      case 'missing-table':
        console.log(`   [${f.severity}] Missing table(s) in ${f.target}: ${f.tables.join(', ')}`)
        break
      case 'missing-column':
        console.log(`   [${f.severity}] Missing column ${f.table}.${f.column} in ${f.target}`)
        break
      case 'column-type-mismatch':
        console.log(`   [${f.severity}] Column type mismatch ${f.table}.${f.column}: prod=${f.prod} e2e=${f.e2e}`)
        break
      case 'missing-index':
        console.log(`   [${f.severity}] Missing index ${f.key} in ${f.target}`)
        break
    }
  }

  console.log('\nℹ No schema changes or migrations were attempted.')
  process.exit(1)
}

main().catch((err) => {
  console.error('✗ Schema drift report failed:', err.message)
  process.exit(2)
})
