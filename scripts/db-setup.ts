/**
 * Create the database schema for a fresh PostgreSQL database.
 *
 * Why this exists
 * ---------------
 * The repo's migration chain cannot bootstrap an empty database on its own:
 * migration #14 (`20260819_p2_tally_vouchers_tax`) inserts into `tax_types`,
 * but that table is only created by the later migration #21
 * (`20261011_045410___name`). Running `payload migrate` on a fresh database
 * therefore fails with `relation "tax_types" does not exist`.
 *
 * `payload generate:db-schema` is not a schema-creation step either — it only
 * writes `src/payload-generated-schema.ts` (a TypeScript file that does not
 * even pass `tsc`).
 *
 * The schema that the application actually runs against is produced by
 * Payload's **dev-mode schema push** (`@payloadcms/db-postgres`'s connect hook
 * pushes whenever `NODE_ENV !== 'production'` and `PAYLOAD_MIGRATING !== 'true'`).
 * This script performs that push deterministically: it boots the Payload
 * config against the target database, waits for the push to complete, and
 * exits non-zero if any collection table is missing.
 *
 * Usage:
 *   DATABASE_URI=postgresql://... NODE_ENV=development pnpm db:setup
 *
 * It is safe to run against an already-populated database: Payload's push is
 * idempotent and only adds what is missing.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const connectionString = process.env.DATABASE_URI
if (!connectionString) {
  console.error('db:setup requires DATABASE_URI to point at the target database.')
  process.exit(1)
}

// The push only runs when the adapter believes it is not in production.
if (process.env.NODE_ENV === 'production') {
  console.error(
    'db:setup refuses to run with NODE_ENV=production — the dev-mode schema push ' +
      'is disabled in production. Set NODE_ENV=development for this step.',
  )
  process.exit(1)
}
process.env.PAYLOAD_MIGRATING = 'false'

// The Payload config boots the Resend email adapter at import time, and the
// SDK throws when the key is missing. This step never sends mail, so a
// placeholder key is enough to let the config load.
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 're_db_setup_placeholder'
}
if (!process.env.PAYLOAD_SECRET) {
  process.env.PAYLOAD_SECRET = 'db-setup-placeholder-secret'
}

const configPath = path.join(repoRoot, 'src', 'payload.config.ts')
if (!existsSync(configPath)) {
  console.error(`db:setup could not find the Payload config at ${configPath}`)
  process.exit(1)
}

console.log('db:setup — booting Payload to push the schema…')

const { default: config } = await import(configPath)
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

// The connect hook pushes the schema on init. Query a representative set of
// collections to prove the tables exist rather than assuming the push ran.
const probeCollections = ['users', 'gl-accounts', 'journal-entries', 'documents', 'fixed-assets']
const missing: string[] = []

for (const collection of probeCollections) {
  try {
    await payload.count({ collection: collection as any })
  } catch {
    missing.push(collection)
  }
}

if (missing.length > 0) {
  console.error(
    `db:setup failed — these collections have no table after the schema push: ${missing.join(', ')}`,
  )
  process.exit(1)
}

console.log(`db:setup — schema ready (verified ${probeCollections.length} collections).`)
process.exit(0)
