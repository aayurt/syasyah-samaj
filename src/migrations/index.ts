import * as migration_20260210_080957 from './20260210_080957';
import * as migration_20260226_085456 from './20260226_085456';
import * as migration_20260812_111805 from './20260812_111805';
import * as migration_20260812_122205 from './20260812_122205';
import * as migration_20260812_154815 from './20260812_154815';
import * as migration_20260812_161710 from './20260812_161710';
import * as migration_20260818_p1_illaka from './20260818_p1_illaka';

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
];
