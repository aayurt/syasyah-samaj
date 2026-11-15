/** Temporary: dump the exact SQL the migration generates. */
import { buildUpSQL } from '../src/migrations/20261115_doc_sequences_order_types.ts'

console.log(buildUpSQL())
