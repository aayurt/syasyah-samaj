---
name: nextjs-vite-react19-import-patterns
description: Import path resolution and component build patterns for Next.js 15 + Vite + React 19 billing SPAs, with syasyah-samaj conventions
category: devops
---

# Next.js/Vite React 19 Import Path Resolution

## Trigger
When adding, moving, or refactoring imports in Next.js 15 or Vite + React 19 projects and the build fails with module not found errors.

## Procedure
1. **Identify the import pattern** — check if the project uses `@/` aliases (via `vite.config.ts`/`jsconfig.json`) or relative paths (`./`, `../`)
2. **For `@/` alias projects**: verify the alias is configured in `vite.config.ts` or `jsconfig.json`; the alias must resolve to an absolute path under `src/`
3. **For relative-path projects**: from the file being edited, count directory segments to `src/`:
   - In `src/components/`: use `../` to go up to `src/`, then relative paths within `src/`
   - In `src/pages/`: use `../lib/` or `../components/` to reach other `src/` subdirectories
   - Never use `@/` unless explicitly confirmed in config
4. **Run the build** — `pnpm --dir apps/billing build` — exit 0 confirms paths are correct
5. **Run tests** — `pnpm --dir apps/billing test` — 542/542 pass confirms no regressions
6. **Deploy** — rsync dist/ to PersonalVPS and `pm2 reload syasha-samaj && pm2 reload syasha-samaj-staging`

## Pitfalls & Rules
- **Pitfall**: Using `@/imports` when the project configures relative paths, or vice versa — build exits 2 with `Cannot find module` or `Module not found`
  - **Why**: The module resolution strategy is project-specific; `@/` is not a universal Node/JSX alias
- **Pitfall**: `import LiquidButton from './LiquidButton'` from `CoaSetupModal.tsx` when the file lives in `components/` and `LiquidButton` is in `components/ui/` — must be `import { LiquidButton } from './ui/LiquidButton'`
  - **Why**: Relative paths are resolved from the file's directory, not the project root
- **Pitfall**: Duplicate `import { useT }` lines crash Vite — remove the duplicate
  - **Why**: Vite's module resolver cannot handle two default imports from the same module in one file
- **Pitfall**: `motion.div` loses `className` with `framer-motion@11 + @types/react@19` — use the typed alias `MotionDiv` instead of `div`
  - **Why**: Type conflict between motion component and React div props

## Build/Test/Deploy Commands
```bash
pnpm --dir apps/billing build     # exit 0
pnpm --dir apps/billing test      # 542/542 pass
rsync -az --delete apps/billing/dist/ PersonalVPS:/var/www/syasyah-samaj/apps/billing/dist/
rsync -az --delete apps/billing/dist/ PersonalVPS:/var/www/syasyah-samaj-staging/apps/billing/dist/
ssh PersonalVPS "pm2 reload syasha-samaj && pm2 reload syasha-samaj-staging"
```

## syasyah-samaj Conventions (from memory)
1. SPA follows `apps/billing/src/AGENTS.md` — cache-first `useCachedList`, never `Promise.all(list())`
2. CRITICAL: `.map()` loop variable `t` shadows `i18n useT()` → crash (hit 3x)
3. Duplicate `import { useT }` lines crash Vite
4. `framer-motion@11 + @types/react@19`: `motion.div` loses `className`; use typed alias `MotionDiv`
5. `bloodGroup` stayed `text` — enum migration failed on legacy data; SPA enforces values
6. Docker postgres `:5433` (`syasha_e2e`) is E2E DB
