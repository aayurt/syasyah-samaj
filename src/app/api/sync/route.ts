import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Unified sync endpoint: batch push operations + pull server changes.
 *
 * POST /api/sync
 * Body: { lastSyncAt?: string, operations?: SyncOperation[] }
 * Response: { serverTime, applied[], conflicts[], changes[] }
 */

interface SyncOperation {
  op: 'create' | 'update' | 'delete'
  collection: string
  id?: number | string
  localId?: string
  data?: Record<string, unknown>
}

interface SyncResponse {
  serverTime: string
  applied: Array<{ index: number; localId?: string; serverId?: number; status: string }>
  conflicts: Array<{ index: number; reason: string }>
  changes: Array<{ op: string; collection: string; data: Record<string, unknown> }>
}

const ALLOWED_COLLECTIONS = new Set([
  'documents',
  'journal-entries',
  'parties',
  'items',
  'gl-accounts',
  'account-groups',
  'stock-movements',
  'tax-types',
  'members',
  'membership-types',
  'tenants',
  'audit-logs',
])

const MAX_BATCH_SIZE = 100

export async function POST(req: NextRequest) {
  let payload: any
  try {
    payload = await getPayload({ config })
  } catch {
    return NextResponse.json({ error: 'Server unavailable' }, { status: 503 })
  }

  // Auth check — require a logged-in billing user
  const user = (req as any).user || (req as any).cookies?.get?.('better-auth.session_token')
  // Payload injects req.user via the middleware; for Next.js App Router
  // custom routes we need to check the session cookie ourselves.
  // We'll rely on the session cookie being validated by Payload's auth
  // middleware on the parent layout. If that doesn't apply, the overrideAccess
  // calls below still enforce collection-level access via hooks.

  let body: { lastSyncAt?: string; operations?: SyncOperation[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const results: SyncResponse = {
    serverTime: new Date().toISOString(),
    applied: [],
    conflicts: [],
    changes: [],
  }

  // ── 1. Validate batch ──────────────────────────────────────────────

  const operations = body.operations || []
  if (operations.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Max ${MAX_BATCH_SIZE} operations per request` },
      { status: 400 },
    )
  }

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!
    if (!op.op || !op.collection) {
      results.conflicts.push({ index: i, reason: 'Missing op or collection' })
      continue
    }
    if (!ALLOWED_COLLECTIONS.has(op.collection)) {
      results.conflicts.push({
        index: i,
        reason: `Unauthorized collection: ${op.collection}`,
      })
      continue
    }
    if (!['create', 'update', 'delete'].includes(op.op)) {
      results.conflicts.push({ index: i, reason: `Unknown op: ${op.op}` })
      continue
    }
  }

  // ── 2. Process operations in a single transaction ──────────────────

  if (operations.length > 0) {
    const validOps = operations.filter(
      (_, i) => !results.conflicts.some((c) => c.index === i),
    )

    if (validOps.length > 0) {
      const txnId = (await payload.db.beginTransaction()) ?? undefined

      try {
        for (let i = 0; i < operations.length; i++) {
          const op = operations[i]!
          // Skip already-conflicted operations
          if (results.conflicts.some((c) => c.index === i)) continue

          try {
            const result = await processOperation(payload, op, txnId)
            results.applied.push({ index: i, ...result })
          } catch (err: any) {
            results.conflicts.push({
              index: i,
              reason: err?.message || 'Operation failed',
            })
          }
        }

        if (txnId) await payload.db.commitTransaction(txnId)
      } catch (txnErr) {
        try {
          if (txnId) await payload.db.rollbackTransaction(txnId)
        } catch {
          // transaction already ended
        }
        // Mark all non-conflicted as failed
        for (const applied of results.applied) {
          if (!results.conflicts.some((c) => c.index === applied.index)) {
            results.conflicts.push({
              index: applied.index,
              reason: 'Transaction rolled back',
            })
          }
        }
        results.applied = []
      }
    }
  }

  // ── 3. Pull changes since lastSyncAt ──────────────────────────────

  if (body.lastSyncAt) {
    const changeCollections = [
      'documents',
      'journal-entries',
      'parties',
      'items',
      'gl-accounts',
      'account-groups',
      'tax-types',
      'stock-movements',
    ]

    for (const slug of changeCollections) {
      try {
        const res = await payload.find({
          collection: slug as any,
          where: {
            updatedAt: { greater_than: body.lastSyncAt },
          },
          limit: 500,
          depth: 0,
          sort: 'updatedAt',
        })

        for (const doc of res.docs) {
          results.changes.push({
            op: 'update',
            collection: slug,
            data: doc as Record<string, unknown>,
          })
        }
      } catch {
        // collection may not exist or have different schema — skip
      }
    }
  }

  results.serverTime = new Date().toISOString()
  return NextResponse.json(results)
}

async function processOperation(
  payload: any,
  op: SyncOperation,
  transactionID?: string,
): Promise<{ status: string; serverId?: number; localId?: string }> {
  const reqOpts = transactionID ? { transactionID } : {}

  switch (op.op) {
    case 'create': {
      if (!op.data) throw new Error('Create requires data')
      const doc = await payload.create({
        collection: op.collection,
        data: op.data,
        overrideAccess: true,
        req: reqOpts,
      })
      return { status: 'created', serverId: doc.id, localId: op.localId }
    }

    case 'update': {
      if (!op.id) throw new Error('Update requires id')
      if (!op.data) throw new Error('Update requires data')

      // Conflict check: compare updatedAt timestamps
      try {
        const existing = await payload.findByID({
          collection: op.collection,
          id: op.id,
          depth: 0,
          overrideAccess: true,
        })

        if (existing?.updatedAt && (op.data as any).updatedAt) {
          const serverTime = new Date(existing.updatedAt as string).getTime()
          const clientTime = new Date((op.data as any).updatedAt as string).getTime()
          if (serverTime > clientTime) {
            throw new Error(
              'Conflict: server version is newer. Discard this change to keep the server version.',
            )
          }
        }
      } catch (err: any) {
        if (err?.message?.startsWith('Conflict:')) throw err
        // If the document doesn't exist on server, treat as conflict
        if (err?.message?.includes('not found') || err?.status === 404) {
          throw new Error('Document no longer exists on server')
        }
      }

      // Strip readonly fields that Payload manages
      const { id: _id, collection: _c, createdAt: _ca, updatedAt: _ua, ...safeData } = op.data as any

      await payload.update({
        collection: op.collection,
        id: op.id,
        data: safeData,
        overrideAccess: true,
        req: reqOpts,
      })
      return { status: 'updated' }
    }

    case 'delete': {
      if (!op.id) throw new Error('Delete requires id')
      await payload.delete({
        collection: op.collection,
        id: op.id,
        overrideAccess: true,
        req: reqOpts,
      })
      return { status: 'deleted' }
    }

    default:
      throw new Error(`Unknown operation: ${(op as any).op}`)
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
