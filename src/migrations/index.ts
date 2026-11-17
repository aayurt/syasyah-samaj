import * as migration_20260210_080957 from './20260210_080957';
import * as migration_20260226_085456 from './20260226_085456';
import * as migration_20260812_111805 from './20260812_111805';
import * as migration_20260812_122205 from './20260812_122205';
import * as migration_20260812_154815 from './20260812_154815';
import * as migration_20260812_161710 from './20260812_161710';
import * as migration_20260818_p1_illaka from './20260818_p1_illaka';
import * as migration_20260818_p2_membership from './20260818_p2_membership';
import * as migration_20260818_p3_donations from './20260818_p3_donations';
import * as migration_20260818_p4_orders from './20260818_p4_orders';
import * as migration_20260818_p5_bank_recon from './20260818_p5_bank_recon';
import * as migration_20260818_p6_fixed_assets from './20260818_p6_fixed_assets';
import * as migration_20260819_p1_transfers_audit from './20260819_p1_transfers_audit';
import * as migration_20260819_p2_tally_vouchers_tax from './20260819_p2_tally_vouchers_tax';
import * as migration_20260824_void_items from './20260824_void_items';
import * as migration_20260826_expense_claims from './20260826_expense_claims';
import * as migration_20260826_recurring_billing from './20260826_recurring_billing';
import * as migration_20260826_sales_quotes from './20260826_sales_quotes';
import * as migration_20260903_fiscal_years from './20260903_fiscal_years';
import * as migration_20260906_fy_date_fix from './20260906_fy_date_fix';
import * as migration_20261011_045410___name from './20261011_045410___name';
import * as migration_20261115_doc_sequences_order_types from './20261115_doc_sequences_order_types';
import * as migration_20261115_gl_accounts_normal_balance from './20261115_gl_accounts_normal_balance';
import * as migration_20261116_100000_coa_opening_balance_columns from './20261116_100000_coa_opening_balance_columns';
import * as migration_20261117_100000_coa_account_master_fields from './20261117_100000_coa_account_master_fields';
import * as migration_20261117_110000_coa_opening_balance_batches_lines from './20261117_110000_coa_opening_balance_batches_lines';
import * as migration_20261117_120000_account_groups_level from './20261117_120000_account_groups_level';

export const migrations = [
  {
    up: migration_20260210_080957.up,
    down: migration_20260210_080957.down,
    name: '20260210_080957',
  },
  {
    up: migration_20260226_085456.up,
    down: migration_20260226_085456.down,
    name: '20260226_085456',
  },
  {
    up: migration_20260812_111805.up,
    down: migration_20260812_111805.down,
    name: '20260812_111805',
  },
  {
    up: migration_20260812_122205.up,
    down: migration_20260812_122205.down,
    name: '20260812_122205',
  },
  {
    up: migration_20260812_154815.up,
    down: migration_20260812_154815.down,
    name: '20260812_154815',
  },
  {
    up: migration_20260812_161710.up,
    down: migration_20260812_161710.down,
    name: '20260812_161710',
  },
  {
    up: migration_20260818_p1_illaka.up,
    down: migration_20260818_p1_illaka.down,
    name: '20260818_p1_illaka',
  },
  {
    up: migration_20260818_p2_membership.up,
    down: migration_20260818_p2_membership.down,
    name: '20260818_p2_membership',
  },
  {
    up: migration_20260818_p3_donations.up,
    down: migration_20260818_p3_donations.down,
    name: '20260818_p3_donations',
  },
  {
    up: migration_20260818_p4_orders.up,
    down: migration_20260818_p4_orders.down,
    name: '20260818_p4_orders',
  },
  {
    up: migration_20260818_p5_bank_recon.up,
    down: migration_20260818_p5_bank_recon.down,
    name: '20260818_p5_bank_recon',
  },
  {
    up: migration_20260818_p6_fixed_assets.up,
    down: migration_20260818_p6_fixed_assets.down,
    name: '20260818_p6_fixed_assets',
  },
  {
    up: migration_20260819_p1_transfers_audit.up,
    down: migration_20260819_p1_transfers_audit.down,
    name: '20260819_p1_transfers_audit',
  },
  {
    up: migration_20260819_p2_tally_vouchers_tax.up,
    down: migration_20260819_p2_tally_vouchers_tax.down,
    name: '20260819_p2_tally_vouchers_tax',
  },
  {
    up: migration_20260824_void_items.up,
    down: migration_20260824_void_items.down,
    name: '20260824_void_items',
  },
  {
    up: migration_20260826_expense_claims.up,
    down: migration_20260826_expense_claims.down,
    name: '20260826_expense_claims',
  },
  {
    up: migration_20260826_recurring_billing.up,
    down: migration_20260826_recurring_billing.down,
    name: '20260826_recurring_billing',
  },
  {
    up: migration_20260826_sales_quotes.up,
    down: migration_20260826_sales_quotes.down,
    name: '20260826_sales_quotes',
  },
  {
    up: migration_20260903_fiscal_years.up,
    down: migration_20260903_fiscal_years.down,
    name: '20260903_fiscal_years',
  },
  {
    up: migration_20260906_fy_date_fix.up,
    down: migration_20260906_fy_date_fix.down,
    name: '20260906_fy_date_fix',
  },
  {
    up: migration_20261011_045410___name.up,
    down: migration_20261011_045410___name.down,
    name: '20261011_045410___name',
  },
  {
    up: migration_20261115_doc_sequences_order_types.up,
    down: migration_20261115_doc_sequences_order_types.down,
    name: '20261115_doc_sequences_order_types',
  },
  {
    up: migration_20261115_gl_accounts_normal_balance.up,
    down: migration_20261115_gl_accounts_normal_balance.down,
    name: '20261115_gl_accounts_normal_balance',
  },
  {
    up: migration_20261116_100000_coa_opening_balance_columns.up,
    down: migration_20261116_100000_coa_opening_balance_columns.down,
    name: '20261116_100000_coa_opening_balance_columns',
  },
  {
    up: migration_20261117_100000_coa_account_master_fields.up,
    down: migration_20261117_100000_coa_account_master_fields.down,
    name: '20261117_100000_coa_account_master_fields',
  },
  {
    up: migration_20261117_110000_coa_opening_balance_batches_lines.up,
    down: migration_20261117_110000_coa_opening_balance_batches_lines.down,
    name: '20261117_110000_coa_opening_balance_batches_lines',
  },
  {
    up: migration_20261117_120000_account_groups_level.up,
    down: migration_20261117_120000_account_groups_level.down,
    name: '20261117_120000_account_groups_level',
  },
];
