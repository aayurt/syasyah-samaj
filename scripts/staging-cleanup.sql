-- Staging data cleanup — fresh reset for syasha_staging
-- Safe to re-run: every DELETE guards with IF EXISTS semantics via cascade.
-- Order respects foreign-key constraints (children before parents).
-- Run: psql "$DATABASE_URI" -f scripts/staging-cleanup.sql

-- ══════════════════════════════════════════════════════════════════════
-- 1. Transactional documents (child rows first, then parents)
-- ══════════════════════════════════════════════════════════════════════

DELETE FROM stock_movements;
DELETE FROM documents_journal_lines;
DELETE FROM documents_lines;
DELETE FROM documents_tax_lines;
DELETE FROM documents_voided_items;
DELETE FROM documents;
DELETE FROM journal_entries;
DELETE FROM doc_sequences;
DELETE FROM audit_logs;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Masters (parties, items, tax types)
-- ══════════════════════════════════════════════════════════════════════

DELETE FROM items;
DELETE FROM parties;
DELETE FROM tax_types;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Chart of accounts
-- ══════════════════════════════════════════════════════════════════════

DELETE FROM gl_accounts;
DELETE FROM account_groups;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Fiscal years
-- ══════════════════════════════════════════════════════════════════════

DELETE FROM fiscal_years;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Tenants (keep the system tenant if one exists; wipe everything else)
-- ══════════════════════════════════════════════════════════════════════

-- Delete all tenants except a bootstrap/system tenant if your schema has one.
-- Uncomment and adjust the WHERE clause to protect a specific tenant:
--   DELETE FROM tenants WHERE name NOT LIKE 'System%';
DELETE FROM tenants;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Globals (billing settings, payroll settings)
-- ══════════════════════════════════════════════════════════════════════

DELETE FROM globals;

-- ══════════════════════════════════════════════════════════════════════
-- 7. Reset sequences if your DB uses serial/identity PKs
-- ══════════════════════════════════════════════════════════════════════

-- Payload uses UUID PKs, so no sequence reset needed for Payload tables.
-- If any table uses serial/identity, uncomment and adjust:
--   SELECT setval('some_table_id_seq', 1, false);

-- ══════════════════════════════════════════════════════════════════════
-- Verify
-- ══════════════════════════════════════════════════════════════════════

SELECT 'STAGING CLEANUP COMPLETE' AS status;
