import { useEffect, useState } from 'react'
import { X, Check, ArrowRight } from 'lucide-react'
import { getImportJobs, updateImportJob, processImportQueue, type OfflineImportJob } from '../lib/offlineImport'
import { useT } from '../lib/i18n'

interface Props {
  onClose: () => void
}

export default function SyncConflictsModal({ onClose }: Props) {
  const t = useT()
  const [jobs, setJobs] = useState<OfflineImportJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setLoading(true)
    const allJobs = await getImportJobs()
    const conflicted = allJobs.filter(j => j.conflicts && j.conflicts.length > 0)
    setJobs(conflicted)
    setLoading(false)
  }

  const handleResolve = async (jobId: string, conflictIndex: number, resolution: 'server' | 'local') => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return

    const conflict = job.conflicts![conflictIndex]

    // Remove the conflict
    const updatedConflicts = [...job.conflicts!]
    updatedConflicts.splice(conflictIndex, 1)

    let updatedRecords = [...job.records]
    if (resolution === 'server') {
      // Discard our local change (don't retry this record)
      // We can just keep it out of the records, or mark it skipped,
      // but simpler is just not re-adding it to a new job.
    } else if (resolution === 'local') {
      // We want to force our local record. For imports this usually means retrying it.
      // But we need to make sure we don't get 409 again.
      // Easiest is to queue a new update job or just re-add it to the current job's queue.
      // To simplify, let's just append it to job records and rewind progress.
      updatedRecords.push({ ...conflict.record, action: 'update', doc: { ...conflict.record.doc, id: conflict.serverDoc?.id ?? conflict.record.doc.id }})
    }

    const updatedJob = {
      ...job,
      conflicts: updatedConflicts,
      records: updatedRecords,
      status: updatedConflicts.length === 0 && job.status === 'completed' ? 'pending' : job.status,
    } as OfflineImportJob

    await updateImportJob(updatedJob)

    if (updatedJob.status === 'pending') {
      processImportQueue().catch(console.error)
    }

    loadJobs()
  }

  const handleResolveAll = async (jobId: string, resolution: 'server' | 'local') => {
    const job = jobs.find(j => j.id === jobId)
    if (!job) return

    let updatedRecords = [...job.records]
    if (resolution === 'local') {
      for (const conflict of job.conflicts!) {
        updatedRecords.push({ ...conflict.record, action: 'update', doc: { ...conflict.record.doc, id: conflict.serverDoc?.id ?? conflict.record.doc.id }})
      }
    }

    const updatedJob = {
      ...job,
      conflicts: [],
      records: updatedRecords,
      status: 'pending',
    } as OfflineImportJob

    await updateImportJob(updatedJob)
    processImportQueue().catch(console.error)

    loadJobs()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Import Conflicts Resolution
          </h2>
          <button
            onClick={onClose}
            className="rounded hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Check className="mb-4 h-12 w-12 text-emerald-500" />
              <p className="text-lg font-medium text-slate-800">No conflicts to resolve</p>
              <p className="mt-1 text-sm text-slate-500">All imports are successfully synced or pending without conflicts.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {jobs.map(job => (
                <div key={job.id} className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-orange-900">
                        {job.collection} Import
                      </h3>
                      <p className="text-sm text-orange-700">
                        {job.conflicts?.length} conflict(s) remaining
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveAll(job.id, 'local')}
                        className="rounded border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                      >
                        Force All Local
                      </button>
                      <button
                        onClick={() => handleResolveAll(job.id, 'server')}
                        className="rounded border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                      >
                        Keep All Server
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {job.conflicts?.map((conflict, idx) => (
                      <div key={idx} className="rounded border border-orange-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">Row Conflict: {conflict.error}</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleResolve(job.id, idx, 'local')}
                              className="rounded bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800 hover:bg-orange-200"
                            >
                              Use Local
                            </button>
                            <button
                              onClick={() => handleResolve(job.id, idx, 'server')}
                              className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                            >
                              Use Server
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="rounded bg-slate-50 p-3">
                            <div className="mb-2 font-semibold text-slate-600">Local (Your Import)</div>
                            <pre className="overflow-x-auto text-slate-600 whitespace-pre-wrap">
                              {JSON.stringify(conflict.record.doc, null, 2)}
                            </pre>
                          </div>
                          <div className="rounded bg-slate-50 p-3">
                            <div className="mb-2 font-semibold text-slate-600">Server (Existing)</div>
                            <pre className="overflow-x-auto text-slate-600 whitespace-pre-wrap">
                              {JSON.stringify(conflict.serverDoc, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
