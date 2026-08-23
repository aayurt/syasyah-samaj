-- Seed script: realistic accounting test data
-- Uses explicit IDs for Payload array sub-tables (varchar PKs)

BEGIN;

-- Clean first
DELETE FROM stock_movements;
DELETE FROM documents_journal_lines;
DELETE FROM documents_lines;
DELETE FROM documents_tax_lines;
DELETE FROM documents_voided_items;
DELETE FROM documents;
DELETE FROM journal_entries;
DELETE FROM doc_sequences;
DELETE FROM audit_logs;

-- ══════════════════════════════════════════════════════════════════
-- SALES INVOICE 1: Kathmandu Traders — Rs. 25,000 + 13% VAT
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, tenant_id, created_at, updated_at)
VALUES (1, 'sales-invoice', 'SI-2026-0001', '2026-08-01', 5, 'posted', 'Sale of pooja supplies to Kathmandu Traders', 22123.89, 2876.11, 25000.00, 'bank', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (1, '2026-08-01', 'Sales Invoice SI-2026-0001 — Kathmandu Traders', 'posted', '2026-08-01', 2, now(), now());

UPDATE documents SET journal_entry_id = 1 WHERE id = 1;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 1, 'jl-1-0', 4, 25000, NULL, 'AR — Kathmandu Traders'),
  (1, 1, 'jl-1-1', 10, NULL, 22123.89, 'Sales Revenue'),
  (2, 1, 'jl-1-2', 8, NULL, 2876.11, 'VAT Output 13%');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 1, 'dl-1-0', 'Prayer Flags (Khada)', 50, 120, 6000),
  (1, 1, 'dl-1-1', 'Pooja Thali Set', 10, 1300, 13000),
  (2, 1, 'dl-1-2', 'Ghee (Clarified Butter)', 8, 800, 6400);

-- ══════════════════════════════════════════════════════════════════
-- SALES INVOICE 2: Hotel Annapurna — Rs. 18,500 + VAT
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, tenant_id, created_at, updated_at)
VALUES (2, 'sales-invoice', 'SI-2026-0002', '2026-08-05', 1, 'posted', 'Supply of ritual items to Hotel Annapurna', 16371.68, 2128.32, 18500.00, 'bank', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (2, '2026-08-05', 'Sales Invoice SI-2026-0002 — Hotel Annapurna', 'posted', '2026-08-05', 2, now(), now());

UPDATE documents SET journal_entry_id = 2 WHERE id = 2;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 2, 'jl-2-0', 4, 18500, NULL, 'AR — Hotel Annapurna'),
  (1, 2, 'jl-2-1', 10, NULL, 16371.68, 'Sales Revenue'),
  (2, 2, 'jl-2-2', 8, NULL, 2128.32, 'VAT Output 13%');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 2, 'dl-2-0', 'Incense Sticks (Dhup)', 30, 220, 6600),
  (1, 2, 'dl-2-1', 'Oil Lamp (Diyo)', 20, 260, 5200),
  (2, 2, 'dl-2-2', 'Candles', 50, 45, 2250),
  (3, 2, 'dl-2-3', 'Cotton Wicks (Batti)', 30, 50, 1500);

-- ══════════════════════════════════════════════════════════════════
-- SALES INVOICE 3: Patan Handicrafts — Rs. 12,000 + VAT
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, tenant_id, created_at, updated_at)
VALUES (3, 'sales-invoice', 'SI-2026-0003', '2026-08-10', 4, 'posted', 'Festival supplies to Patan Handicrafts', 10619.47, 1380.53, 12000.00, 'bank', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (3, '2026-08-10', 'Sales Invoice SI-2026-0003 — Patan Handicrafts', 'posted', '2026-08-10', 2, now(), now());

UPDATE documents SET journal_entry_id = 3 WHERE id = 3;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 3, 'jl-3-0', 4, 12000, NULL, 'AR — Patan Handicrafts'),
  (1, 3, 'jl-3-1', 10, NULL, 10619.47, 'Sales Revenue'),
  (2, 3, 'jl-3-2', 8, NULL, 1380.53, 'VAT Output 13%');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 3, 'dl-3-0', 'Rice (Chaamal)', 50, 95, 4750),
  (1, 3, 'dl-3-1', 'Ghee (Clarified Butter)', 5, 800, 4000),
  (2, 3, 'dl-3-2', 'Prayer Flags (Khada)', 20, 120, 2400);

-- ══════════════════════════════════════════════════════════════════
-- RECEIPT 1: Kathmandu Traders pays Rs. 15,000 (partial)
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, linked_invoice_id, tenant_id, created_at, updated_at)
VALUES (4, 'receipt-voucher', 'RV-2026-0001', '2026-08-08', 5, 'posted', 'Partial payment from Kathmandu Traders', 15000, 0, 15000, 'bank', 1, 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (4, '2026-08-08', 'Receipt RV-2026-0001 — Kathmandu Traders (partial)', 'posted', '2026-08-08', 2, now(), now());

UPDATE documents SET journal_entry_id = 4 WHERE id = 4;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 4, 'jl-4-0', 3, 15000, NULL, 'Bank — receipt'),
  (1, 4, 'jl-4-1', 4, NULL, 15000, 'AR — Kathmandu Traders');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 4, 'dl-4-0', 'Receipt', 1, 15000, 15000);

-- ══════════════════════════════════════════════════════════════════
-- RECEIPT 2: Hotel Annapurna pays full Rs. 18,500
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, linked_invoice_id, tenant_id, created_at, updated_at)
VALUES (5, 'receipt-voucher', 'RV-2026-0002', '2026-08-12', 1, 'posted', 'Full payment from Hotel Annapurna', 18500, 0, 18500, 'bank', 2, 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (5, '2026-08-12', 'Receipt RV-2026-0002 — Hotel Annapurna (full)', 'posted', '2026-08-12', 2, now(), now());

UPDATE documents SET journal_entry_id = 5 WHERE id = 5;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 5, 'jl-5-0', 3, 18500, NULL, 'Bank — receipt'),
  (1, 5, 'jl-5-1', 4, NULL, 18500, 'AR — Hotel Annapurna');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 5, 'dl-5-0', 'Receipt', 1, 18500, 18500);

-- ══════════════════════════════════════════════════════════════════
-- PURCHASE INVOICE 1: Nepal Stationery House — Rs. 35,000 + VAT
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, tenant_id, created_at, updated_at)
VALUES (6, 'purchase-invoice', 'PI-2026-0001', '2026-08-03', 6, 'posted', 'Bulk purchase from Nepal Stationery House', 30973.45, 4026.55, 35000.00, 'bank', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (6, '2026-08-03', 'Purchase Invoice PI-2026-0001 — Nepal Stationery House', 'posted', '2026-08-03', 2, now(), now());

UPDATE documents SET journal_entry_id = 6 WHERE id = 6;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 6, 'jl-6-0', 13, 30973.45, NULL, 'Purchases'),
  (1, 6, 'jl-6-1', 8, 4026.55, NULL, 'VAT Input 13%'),
  (2, 6, 'jl-6-2', 6, NULL, 35000, 'AP — Nepal Stationery House');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 6, 'dl-6-0', 'Prayer Flags (Khada)', 100, 80, 8000),
  (1, 6, 'dl-6-1', 'Incense Sticks (Dhup)', 80, 150, 12000),
  (2, 6, 'dl-6-2', 'Candles', 100, 25, 2500),
  (3, 6, 'dl-6-3', 'Cotton Wicks (Batti)', 50, 30, 1500);

-- ══════════════════════════════════════════════════════════════════
-- PURCHASE INVOICE 2: Everest Logistics — Rs. 22,000 + VAT
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, tenant_id, created_at, updated_at)
VALUES (7, 'purchase-invoice', 'PI-2026-0002', '2026-08-07', 8, 'posted', 'Supplies from Everest Logistics', 19469.03, 2530.97, 22000.00, 'bank', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (7, '2026-08-07', 'Purchase Invoice PI-2026-0002 — Everest Logistics', 'posted', '2026-08-07', 2, now(), now());

UPDATE documents SET journal_entry_id = 7 WHERE id = 7;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 7, 'jl-7-0', 13, 19469.03, NULL, 'Purchases'),
  (1, 7, 'jl-7-1', 8, 2530.97, NULL, 'VAT Input 13%'),
  (2, 7, 'jl-7-2', 6, NULL, 22000, 'AP — Everest Logistics');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 7, 'dl-7-0', 'Ghee (Clarified Butter)', 15, 600, 9000),
  (1, 7, 'dl-7-1', 'Rice (Chaamal)', 80, 70, 5600),
  (2, 7, 'dl-7-2', 'Oil Lamp (Diyo)', 20, 180, 3600);

-- ══════════════════════════════════════════════════════════════════
-- PAYMENT 1: Pay Nepal Stationery House Rs. 20,000 (partial)
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, payment_method, linked_invoice_id, tenant_id, created_at, updated_at)
VALUES (8, 'payment-voucher', 'PV-2026-0001', '2026-08-15', 6, 'posted', 'Partial payment to Nepal Stationery House', 20000, 0, 20000, 'bank', 6, 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (8, '2026-08-15', 'Payment PV-2026-0001 — Nepal Stationery House', 'posted', '2026-08-15', 2, now(), now());

UPDATE documents SET journal_entry_id = 8 WHERE id = 8;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 8, 'jl-8-0', 6, 20000, NULL, 'AP — Nepal Stationery House'),
  (1, 8, 'jl-8-1', 3, NULL, 20000, 'Bank — payment');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 8, 'dl-8-0', 'Payment', 1, 20000, 20000);

-- ══════════════════════════════════════════════════════════════════
-- CREDIT NOTE 1: Return from Kathmandu Traders Rs. 3,000
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, reference_to_id, reference_to_doc_type, tenant_id, created_at, updated_at)
VALUES (9, 'credit-note', 'CN-2026-0001', '2026-08-18', 5, 'posted', 'Return of damaged candles — Kathmandu Traders', 2654.87, 345.13, 3000.00, 1, 'sales-invoice', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (9, '2026-08-18', 'Credit Note CN-2026-0001 — Kathmandu Traders', 'posted', '2026-08-18', 2, now(), now());

UPDATE documents SET journal_entry_id = 9 WHERE id = 9;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 9, 'jl-9-0', 12, 2654.87, NULL, 'Sales Returns'),
  (1, 9, 'jl-9-1', 8, 345.13, NULL, 'VAT reversal'),
  (2, 9, 'jl-9-2', 4, NULL, 3000, 'AR — Kathmandu Traders');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 9, 'dl-9-0', 'Candles — damaged return', 3, 1000, 3000);

-- ══════════════════════════════════════════════════════════════════
-- DEBIT NOTE 1: Nepal Stationery House charges extra Rs. 5,000
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, reference_to_id, reference_to_doc_type, tenant_id, created_at, updated_at)
VALUES (10, 'debit-note', 'DN-2026-0001', '2026-08-20', 6, 'posted', 'Additional charges from Nepal Stationery House', 4424.78, 575.22, 5000.00, 6, 'purchase-invoice', 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (10, '2026-08-20', 'Debit Note DN-2026-0001 — Nepal Stationery House', 'posted', '2026-08-20', 2, now(), now());

UPDATE documents SET journal_entry_id = 10 WHERE id = 10;

-- Dr. Expense (increases what we owe), Cr. AP
INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 10, 'jl-10-0', 13, 4424.78, NULL, 'Additional charges'),
  (1, 10, 'jl-10-1', 8, 575.22, NULL, 'VAT Input'),
  (2, 10, 'jl-10-2', 6, NULL, 5000, 'AP — Nepal Stationery House');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 10, 'dl-10-0', 'Additional handling charges', 1, 5000, 5000);

-- ══════════════════════════════════════════════════════════════════
-- JOURNAL VOUCHER: Office rent Rs. 15,000
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, status, narration, net_total, tax_total, gross_total, tenant_id, created_at, updated_at)
VALUES (11, 'journal-voucher', 'JV-2026-0001', '2026-08-20', 'posted', 'Office rent for Bhadra 2083', 15000, 0, 15000, 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (11, '2026-08-20', 'Journal Voucher JV-2026-0001 — Office Rent', 'posted', '2026-08-20', 2, now(), now());

UPDATE documents SET journal_entry_id = 11 WHERE id = 11;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 11, 'jl-11-0', 15, 15000, NULL, 'Rent Expense'),
  (1, 11, 'jl-11-1', 3, NULL, 15000, 'Bank — rent');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 11, 'dl-11-0', 'Office rent — Bhadra 2083', 1, 15000, 15000);

-- ══════════════════════════════════════════════════════════════════
-- CONTRA: Transfer Rs. 10,000 from Bank to Cash
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, status, narration, net_total, tax_total, gross_total, from_account_id, to_account_id, tenant_id, created_at, updated_at)
VALUES (12, 'contra', 'CT-2026-0001', '2026-08-22', 'posted', 'Cash withdrawal from bank', 10000, 0, 10000, 3, 1, 2, now(), now());

INSERT INTO journal_entries (id, date, narration, status, posted_at, tenant_id, created_at, updated_at)
VALUES (12, '2026-08-22', 'Contra CT-2026-0001 — Bank to Cash', 'posted', '2026-08-22', 2, now(), now());

UPDATE documents SET journal_entry_id = 12 WHERE id = 12;

INSERT INTO documents_journal_lines (_order, _parent_id, id, account_id, debit, credit, memo) VALUES
  (0, 12, 'jl-12-0', 1, 10000, NULL, 'Cash in Hand'),
  (1, 12, 'jl-12-1', 3, NULL, 10000, 'Bank Account');

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 12, 'dl-12-0', 'Bank to Cash transfer', 1, 10000, 10000);

-- ══════════════════════════════════════════════════════════════════
-- DRAFT DOCUMENT: Unposted sales order for testing
-- ══════════════════════════════════════════════════════════════════

INSERT INTO documents (id, doc_type, number, date, party_id, status, narration, net_total, tax_total, gross_total, tenant_id, created_at, updated_at)
VALUES (13, 'sales-invoice', NULL, '2026-08-24', 3, 'draft', 'Draft — Thamel Tours order (unposted)', 8849.56, 1150.44, 10000.00, 2, now(), now());

INSERT INTO documents_lines (_order, _parent_id, id, description, qty, rate, amount) VALUES
  (0, 13, 'dl-13-0', 'Pooja Thali Set', 5, 1300, 6500),
  (1, 13, 'dl-13-1', 'Ghee (Clarified Butter)', 4, 800, 3200);

-- ══════════════════════════════════════════════════════════════════
-- Seed doc_sequences
-- ══════════════════════════════════════════════════════════════════

INSERT INTO doc_sequences (key, last_number, created_at, updated_at) VALUES
  ('sales-invoice:2026:2', 3, now(), now()),
  ('purchase-invoice:2026:2', 2, now(), now()),
  ('receipt-voucher:2026:2', 2, now(), now()),
  ('payment-voucher:2026:2', 1, now(), now()),
  ('credit-note:2026:2', 1, now(), now()),
  ('debit-note:2026:2', 1, now(), now()),
  ('journal-voucher:2026:2', 1, now(), now()),
  ('contra:2026:2', 1, now(), now())
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ══════════════════════════════════════════════════════════════════
-- Verify
-- ══════════════════════════════════════════════════════════════════

SELECT 'SEED COMPLETE' as status;
SELECT doc_type, number, date, status, gross_total FROM documents ORDER BY date, doc_type;
SELECT '---SUMMARY---' as sep;
SELECT doc_type, count(*) as count, sum(gross_total)::numeric(12,2) as total FROM documents GROUP BY doc_type ORDER BY doc_type;
SELECT '---JOURNAL BALANCE---' as sep;
SELECT
  sum(debit)::numeric(12,2) as total_debit,
  sum(credit)::numeric(12,2) as total_credit,
  CASE WHEN abs(sum(coalesce(debit,0)) - sum(coalesce(credit,0))) < 0.01
    THEN 'BALANCED ✓' ELSE 'IMBALANCED ✗' END as status
FROM documents_journal_lines;
