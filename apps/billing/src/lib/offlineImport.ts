import { api } from './api'
import { getEngine } from './offline/index'

export interface OfflineImportJob {
  id: string
  collection: string
  records: any[]
  status: 'pending' | 'syncing' | 'completed' | 'failed'
  createdAt: string
  syncedAt?: string
  result?: { created: number; updated: number; skipped: number; errors: string[] }
  conflicts?: any[]
  progress: { done: number; total: number }
}

const DB_NAME = 'afno-offline-imports'
const DB_VERSION = 1

function openImportDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('import_jobs')) {
        db.createObjectStore('import_jobs', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueImportJob(collection: string, records: any[]): Promise<OfflineImportJob> {
  const db = await openImportDb()
  const job: OfflineImportJob = {
    id: Date.now().toString(),
    collection,
    records,
    status: 'pending',
    createdAt: new Date().toISOString(),
    progress: { done: 0, total: records.length },
    conflicts: [],
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('import_jobs', 'readwrite')
    tx.objectStore('import_jobs').add(job)
    tx.oncomplete = () => resolve(job)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImportJobs(): Promise<OfflineImportJob[]> {
  const db = await openImportDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('import_jobs', 'readonly')
    const req = tx.objectStore('import_jobs').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(tx.error)
  })
}

export async function updateImportJob(job: OfflineImportJob): Promise<void> {
  const db = await openImportDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('import_jobs', 'readwrite')
    tx.objectStore('import_jobs').put(job)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function processImportQueue() {
  const engine = getEngine()
  const isOnline = engine.getState().online
  if (!isOnline) return

  const jobs = await getImportJobs()
  const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'syncing')

  for (const job of pendingJobs) {
    if (job.status === 'pending') {
      job.status = 'syncing'
      await updateImportJob(job)
    }

    const CHUNK_SIZE = 50
    const records = job.records
    let created = job.result?.created || 0
    let updated = job.result?.updated || 0
    let skipped = job.result?.skipped || 0
    let errors = job.result?.errors || []
    let conflicts = job.conflicts || []

    const startIndex = job.progress.done

    for (let i = startIndex; i < records.length; i += CHUNK_SIZE) {
      if (!engine.getState().online) {
        // went offline during processing
        job.result = { created, updated, skipped, errors }
        job.conflicts = conflicts
        await updateImportJob(job)
        return
      }

      const chunk = records.slice(i, i + CHUNK_SIZE)

      const chunkPromises = chunk.map(async (recordObj) => {
        const { doc, action } = recordObj
        try {
          if (action === 'skip') {
            skipped++
            return { status: 'success' }
          }
          if (action === 'create') {
            const body = { ...doc }
            delete body.id
            delete body._id
            const res = await api(`/${job.collection}`, { method: 'POST', body })
            created++
            return { status: 'success' }
          }
          if (action === 'update') {
            const id = doc.id ?? doc._id
            const body = { ...doc }
            const res = await api(`/${job.collection}/${id}`, { method: 'PATCH', body })
            updated++
            return { status: 'success' }
          }
        } catch (err: any) {
          if (err.status === 409 || err.message?.includes('409') || err.name === 'ConflictError') {
             conflicts.push({
               record: recordObj,
               serverDoc: err.serverDoc || null,
               error: err.message
             })
             return { status: 'conflict' }
          } else {
             errors.push(`Row error: ${err.message}`)
             return { status: 'error' }
          }
        }
      })

      await Promise.allSettled(chunkPromises)

      job.progress.done = Math.min(i + CHUNK_SIZE, records.length)
      job.result = { created, updated, skipped, errors }
      job.conflicts = conflicts
      await updateImportJob(job)
    }

    job.status = 'completed'
    job.syncedAt = new Date().toISOString()
    await updateImportJob(job)
  }
}

// Set up online listener to process queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processImportQueue().catch(console.error)
  })
}
