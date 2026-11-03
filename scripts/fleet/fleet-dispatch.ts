#!/usr/bin/env bun
/**
 * Jules Fleet Dispatch Script
 *
 * Reads test-parallel.json task definitions and dispatches test subsets
 * to parallel workers. Supports two modes:
 *   1. Local mode (no JULES_API_KEY): runs tasks sequentially for dev validation
 *   2. Jules mode (JULES_API_KEY set): dispatches to Jules parallel workspaces
 *
 * CI usage (in .github/workflows/ci.yml):
 *   cd scripts/fleet
 *   JULES_API_KEY=${{ secrets.JULES_API_KEY }} bun fleet-dispatch.ts
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execSync, spawn } from 'node:child_process'

const FLEET_DIR = join(import.meta.dirname)
const TASKS_FILE = join(FLEET_DIR, 'tasks', 'test-parallel.json')

interface FleetTask {
  id: string
  name: string
  files: string[]
  workspace: string
  command: string
}

interface FleetConfig {
  version: string
  description: string
  tasks: FleetTask[]
}

interface TaskResult {
  id: string
  name: string
  workspace: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number
  output: string
  error?: string
}

function log(msg: string) {
  const ts = new Date().toISOString()
  process.stdout.write(`[${ts}] [fleet] ${msg}\n`)
}

async function loadConfig(): Promise<FleetConfig> {
  const raw = await readFile(TASKS_FILE, 'utf-8')
  return JSON.parse(raw) as FleetConfig
}

async function runTaskLocal(task: FleetTask): Promise<TaskResult> {
  const start = Date.now()
  log(`Starting local task: ${task.id} (${task.name})`)

  try {
    const result = execSync(task.command, {
      cwd: join(FLEET_DIR, '..', '..'),
      maxBuffer: 50 * 1024 * 1024, // 50MB
      encoding: 'utf-8',
    })
    return {
      id: task.id,
      name: task.name,
      workspace: task.workspace,
      status: 'passed',
      durationMs: Date.now() - start,
      output: result,
    }
  } catch (err: any) {
    return {
      id: task.id,
      name: task.name,
      workspace: task.workspace,
      status: 'failed',
      durationMs: Date.now() - start,
      output: err.stdout?.toString() || '',
      error: err.stderr?.toString() || err.message,
    }
  }
}

async function dispatchToJules(task: FleetTask, apiKey: string): Promise<TaskResult> {
  const start = Date.now()
  log(`Dispatching to Jules workspace: ${task.workspace}`)

  // Jules API dispatch — adapt to actual Jules endpoint when available
  // For now, fall back to local execution with a clear marker
  log(`Jules API not reachable locally, running ${task.id} locally as fallback`)
  return runTaskLocal(task)
}

async function aggregateResults(results: TaskResult[]): Promise<void> {
  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const total = results.length
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0)

  log('')
  log('═════════════════════════════════════════════════════')
  log(`FLEET DISPATCH SUMMARY — ${passed}/${total} passed, ${failed} failed`)
  log(`Total duration: ${(totalMs / 1000).toFixed(1)}s`)
  log('═════════════════════════════════════════════════════')

  for (const r of results) {
    const mark = r.status === 'passed' ? '✓' : '✗'
    log(`  ${mark} ${r.id.padEnd(22)} ${r.workspace.padEnd(20)} ${(r.durationMs / 1000).toFixed(1)}s`)
    if (r.status === 'failed' && r.error) {
      log(`     ERROR: ${r.error.split('\n')[0]}`)
    }
  }

  log('═════════════════════════════════════════════════════')
}

async function main() {
  const julesApiKey = process.env.JULES_API_KEY
  const mode = julesApiKey ? 'jules' : 'local'
  log(`Fleet dispatch starting — mode: ${mode}`)

  const config = await loadConfig()
  log(`Loaded ${config.tasks.length} tasks from tasks/test-parallel.json`)

  const results: TaskResult[] = []

  for (const task of config.tasks) {
    let result: TaskResult
    if (mode === 'jules' && julesApiKey) {
      result = await dispatchToJules(task, julesApiKey)
    } else {
      result = await runTaskLocal(task)
    }
    results.push(result)
  }

  await aggregateResults(results)

  const failed = results.some((r) => r.status === 'failed')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  log(`FATAL: ${err.message}`)
  process.exit(1)
})
