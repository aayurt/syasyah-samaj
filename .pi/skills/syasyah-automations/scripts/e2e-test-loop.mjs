#!/usr/bin/env node
// E2E Test Loop — syasyah-samaj (Cindy automation)
//
// 1. Runs the full test suite against the Docker E2E Postgres at localhost:5433 (syasha_e2e).
// 2. Does NOT touch remote Postgres at 82.165.181.153 — read-only check of E2E only.
// 3. Reports: total tests, passed, failed, and any error stack traces for failures.
// 4. If any test is red, flags it clearly so it blocks the next push to origin main.
//
// Run: node .pi/skills/syasyah-automations/scripts/e2e-test-loop.mjs [--vitest] [--playwright] [--both]

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/Users/aayurtshrestha/Projects/supreme/syasyah-samaj'
const BILLING_DIR = `${ROOT}/apps/billing`
const E2E_DB_URI = 'postgresql://postgres:postgres@localhost:5433/syasha_e2e'

function run(cmd, args, opts = {}) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      cwd: opts.cwd || BILLING_DIR,
      env: { ...process.env, ...opts.env },
    })
    return { ok: true, stdout: out, stderr: '' }
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message,
    }
  }
}

function parseVitestResults(stdout) {
  const passing = stdout.match(/Tests\s+(\d+)\s+passing/i) || stdout.match(/✓ (\d+)/i)
  const failing = stdout.match(/Tests\s+\d+\s+(\d+)\s+failing/i) || stdout.match(/✗ (\d+)/i)
  const passed = passing ? parseInt(passing[1]) : 0
  const failed = failing ? parseInt(failing[1]) : 0

  const tPassed = stdout.match(/Tests\s+(\d+) passed/)
  const tFailed = stdout.match(/Tests\s+\d+ passed\s*\|\s*(\d+) failed/)

  return {
    tests: {
      passed: tPassed ? parseInt(tPassed[1]) : passed,
      failed: tFailed ? parseInt(tFailed[1]) : failing ? parseInt(failing[1]) : failed,
    },
  }
}

function extractStackTraces(stdout) {
  const traces = []
  const lines = stdout.split('\n')
  let inTrace = false
  let current = []

  for (const line of lines) {
    if (line.includes('Error:') || line.includes('FAIL') || line.match(/^\s*at /)) {
      if (!inTrace && line.match(/^\s*at /)) continue
      if (line.includes('Error:') || line.includes('FAIL')) {
        if (current.length > 0) traces.push(current.join('\n'))
        current = [line]
        inTrace = true
      } else if (inTrace) {
        current.push(line)
      }
    } else if (inTrace && line.trim() === '') {
      if (current.length > 0) traces.push(current.join('\n'))
      current = []
      inTrace = false
    }
  }
  if (current.length > 0) traces.push(current.join('\n'))
  return traces
}

async function runVitest() {
  console.log('═══ Vitest (unit/integration) against E2E Postgres ═══\n')

  const env = {
    E2E_DATABASE_URI: E2E_DB_URI,
    DATABASE_URI: E2E_DB_URI,
    NODE_ENV: 'test',
  }

  const result = run('node', [
    '/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing/node_modules/.bin/vitest',
    'run', '--coverage=false'
  ], { env })

  console.log(result.stdout)
  if (result.stderr) console.log('STDERR:', result.stderr)

  const parsed = parseVitestResults(result.stdout)
  const traces = extractStackTraces(result.stdout)

  return { ok: result.ok, parsed, traces, stdout: result.stdout }
}

async function runPlaywright() {
  console.log('\n═══ Playwright E2E against Docker Postgres (localhost:5433) ═══\n')

  const env = {
    E2E_DATABASE_URI: E2E_DB_URI,
    E2E_API_PORT: '3100',
    E2E_WEB_PORT: '5174',
  }

  const result = run('node', [
    '/Users/aayurtshrestha/Projects/supreme/syasyah-samaj/apps/billing/node_modules/.bin/playwright',
    'test', '--config', 'e2e/playwright.config.ts'
  ], { cwd: `${ROOT}/apps/billing`, env })

  console.log(result.stdout)
  if (result.stderr) console.log('STDERR:', result.stderr)

  let parsed = { tests: { passed: 0, failed: 0 } }
  let traces = []

  const resultsPath = `${ROOT}/apps/billing/test-results/results.json`
  try {
    const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
    const suites = results.suites || []
    let total = 0, passed = 0, failed = 0
    for (const suite of suites) {
      for (const test of suite.tests || []) {
        total++
        if (test.status === 'passed') passed++
        else if (test.status === 'failed' || test.status === 'timedOut') {
          failed++
          if (test.error) traces.push(test.error.message + '\n' + (test.error.stack || ''))
        }
      }
    }
    parsed = { tests: { passed, failed } }
  } catch {
    const failedMatch = result.stdout.match(/(\d+) failed/)
    const passedMatch = result.stdout.match(/(\d+) passed/)
    parsed = {
      tests: {
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      },
    }
    traces = extractStackTraces(result.stdout)
  }

  return { ok: result.ok && parsed.tests.failed === 0, parsed, traces, stdout: result.stdout }
}

async function main() {
  const args = process.argv.slice(2)
  const runVitestFlag = args.includes('--vitest') || args.includes('--both') || args.length === 0
  const runPWFlag = args.includes('--playwright') || args.includes('--both') || args.length === 0

  console.log('═══ E2E Test Loop — syasyah-samaj ═══')
  console.log(`Target DB: ${E2E_DB_URI}`)
  console.log('Remote Postgres (82.165.181.153): NOT touched (read-only E2E)\n')

  let vitestResult, pwResult
  let totalTests = 0, totalPassed = 0, totalFailed = 0
  let allTraces = []
  let anyRed = false

  if (runVitestFlag) {
    vitestResult = await runVitest()
    totalTests += vitestResult.parsed.tests.passed + vitestResult.parsed.tests.failed
    totalPassed += vitestResult.parsed.tests.passed
    totalFailed += vitestResult.parsed.tests.failed
    allTraces.push(...vitestResult.traces)
    if (!vitestResult.ok) anyRed = true
  }

  if (runPWFlag) {
    pwResult = await runPlaywright()
    totalTests += pwResult.parsed.tests.passed + pwResult.parsed.tests.failed
    totalPassed += pwResult.parsed.tests.passed
    totalFailed += pwResult.parsed.tests.failed
    allTraces.push(...pwResult.traces)
    if (!pwResult.ok) anyRed = true
  }

  console.log('\n═══ RESULTS ═══')
  console.log(`Total tests: ${totalTests}`)
  console.log(`Passed:      ${totalPassed}`)
  console.log(`Failed:      ${totalFailed}`)

  if (allTraces.length > 0) {
    console.log('\n⛔ ERROR STACK TRACES:')
    for (const trace of allTraces.slice(0, 10)) {
      console.log(`\n---${trace.slice(0, 2000)}---`)
    }
    if (allTraces.length > 10) console.log(`\n...and ${allTraces.length - 10} more stack traces`)
  }

  if (anyRed || totalFailed > 0) {
    console.log('\n⛔⛔⛔ BLOCKER: Tests are RED — do NOT push to origin main ⛔⛔⛔')
    process.exit(1)
  }

  console.log('\n✓ All tests green. Safe to push.')
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ E2E test loop failed:', err.message)
  process.exit(2)
})
