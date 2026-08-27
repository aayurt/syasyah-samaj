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
import * as migration_20260824_void_items from './20260824_void_items';
import * as migration_20260819_p2_tally_vouchers_tax from './20260819_p2_tally_vouchers_tax';
import * as migration_20260826_sales_quotes from './20260826_sales_quotes';
import * as migration_20260826_recurring_billing from './20260826_recurring_billing';
import * as migration_20260826_expense_claims from './20260826_expense_claims';

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
    name: '20260812_161710'
  },
  {
    up: migration_20260818_p1_illaka.up,
    down: migration_20260818_p1_illaka.down,
    name: '20260818_p1_illaka'
  },
  {
    up: migration_20260818_p2_membership.up,
    down: migration_20260818_p2_membership.down,
    name: '20260818_p2_membership'
  },
  {
    up: migration_20260818_p3_donations.up,
    down: migration_20260818_p3_donations.down,
    name: '20260818_p3_donations'
  },
  {
    up: migration_20260818_p4_orders.up,
    down: migration_20260818_p4_orders.down,
    name: '20260818_p4_orders'
  },
  {
    up: migration_20260818_p5_bank_recon.up,
    down: migration_20260818_p5_bank_recon.down,
    name: '20260818_p5_bank_recon'
  },
  {
    up: migration_20260818_p6_fixed_assets.up,
    down: migration_20260818_p6_fixed_assets.down,
    name: '20260818_p6_fixed_assets'
  },
  {
    up: migration_20260819_p1_transfers_audit.up,
    down: migration_20260819_p1_transfers_audit.down,
    name: '20260819_p1_transfers_audit'
  },
  {
    up: migration_20260824_void_items.up,
    down: migration_20260824_void_items.down,
    name: '20260824_void_items'
  },
  {
    up: migration_20260826_sales_quotes.up,
    down: migration_20260826_sales_quotes.down,
    name: '20260826_sales_quotes'
  },
  {
    up: migration_20260826_recurring_billing.up,
    down: migration_20260826_recurring_billing.down,
    name: '20260826_recurring_billing'
  },
  {
    up: migration_20260826_expense_claims.up,
    down: migration_20260826_expense_claims.down,
    name: '20260826_expense_claims'
  },
];
