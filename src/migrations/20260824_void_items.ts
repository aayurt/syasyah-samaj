import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs) {
  // Add voidedItems JSONB array and voidedAmount numeric column
  await payload.db.drizzle.execute(`
    ALTER TABLE documents 
    ADD COLUMN IF NOT EXISTS voided_items JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS voided_amount NUMERIC DEFAULT 0;
  `)

  // Backfill existing void documents: mark all lines as voided
  await payload.db.drizzle.execute(`
    UPDATE documents 
    SET 
      voided_items = (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'itemIndex', idx - 1,
              'quantity', COALESCE((line->>'qty')::numeric, 1),
              'reason', 'Full void',
              'voidedAt', updated_at
            )
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(
          CASE WHEN jsonb_array_length(COALESCE(lines, '[]'::jsonb)) > 0 
               THEN lines ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS line(value, idx)
      ),
      voided_amount = COALESCE(net_total, 0)
    WHERE status = 'void';
  `)
}

export async function down({ payload }: MigrateDownArgs) {
  await payload.db.drizzle.execute(`
    ALTER TABLE documents 
    DROP COLUMN IF EXISTS voided_items,
    DROP COLUMN IF EXISTS voided_amount;
  `)
}
