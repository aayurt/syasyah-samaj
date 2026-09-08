# Syasyah Samaj - UI Cleanup & Improvement Plan

## Overview

Comprehensive cleanup of the Syasyah Samaj (Afno Event) public website UI. Focus: code quality, styling consistency, TypeScript safety, accessibility, and removing dead code.

**Stack:** Next.js 15 (App Router) + Payload CMS 3 + Tailwind CSS 3.4 + shadcn/ui + Framer Motion + TypeScript

---

## Phase 1: Dead Code & Stray Files (CRITICAL)

### 1.1 Delete stray duplicate directories
- Delete `src/app/%5Blocale%5D/` (URL-encoded duplicate)
- Delete `src/app/\[locale\]/` (backslash-escaped duplicate)

### 1.2 Delete stray files
- Delete `…ndex.tsx` at project root (duplicate of DigitalIDCard)
- Delete `src/components/MemberEntryForm.tsx` (broken: `await` in `'use client'`, wrong imports)

---

## Phase 2: TypeScript & Type Safety Fixes

### 2.1 DigitalIDCard motion props (`src/components/DigitalIDCard/index.tsx`)
- Remove `as any` cast on motion props (lines 96-100)
- Use proper Framer Motion `motion.div` types directly

### 2.2 ChatInterface deprecated API (`src/components/ChatInterface/index.tsx`)
- Replace `onKeyPress` with `onKeyDown` (line 133) — `onKeyPress` is deprecated

### 2.3 Locale type casts
- Multiple files use `locale as 'en' | 'ne' | 'new'` — keep as-is (needed for Payload typing)

---

## Phase 3: Styling Consistency (Theme Variables)

### 3.1 Homepage Hero CTA button (`src/app/[locale]/(frontend)/components/homepageHero.tsx`)
- **Issue:** `bg-yellow-500 text-black hover:bg-yellow-400` — hardcoded
- **Fix:** Replace with `bg-accent text-accent-foreground hover:bg-accent/90` (soft blue accent defined in CSS vars)

### 3.2 Hero section CTA (`src/app/[locale]/(frontend)/components/Hero/index.tsx`)
- **Issue:** `bg-yellow-400 text-black hover:bg-yellow-300` — same hardcoded yellow
- **Fix:** Replace with `bg-accent text-accent-foreground hover:bg-accent/90`

### 3.3 EventCard (`src/app/[locale]/(frontend)/components/Events/EventCard.tsx`)
- **Issue:** `bg-white dark:bg-card` — use `bg-card` consistently (already handles dark mode)
- **Fix:** Replace `bg-white dark:bg-card` with just `bg-card`

### 3.4 Members section double padding (`src/app/[locale]/(frontend)/components/Members/index.tsx`)
- **Issue:** `<Card className="p-6">` wraps inner `<div className="p-6">` — double padding
- **Fix:** Remove `p-6` from inner div (line 34)

### 3.5 DigitalIDCard hardcoded status colors (`src/components/DigitalIDCard/index.tsx`)
- **Issue:** `bg-green-100 text-green-800`, `bg-red-100 text-red-800`, `bg-orange-100 text-orange-800`
- **Fix:** Replace with theme-aware classes:
  - paid: `bg-success/20 text-success`
  - unpaid: `bg-error/20 text-error`
  - overdue: `bg-warning/20 text-warning`
- Also fix `text-yellow-400` on line 126 → `text-warning`

### 3.6 Fix duplicate keyframes in tailwind.config.mjs
- **Issue:** `keyframes` defined twice (lines 53-58 and 106-115), second overrides first
- **Fix:** Merge into single `keyframes` block

---

## Phase 4: Component Quality

### 4.1 Logo CLS fix (`src/components/Logo/Logo.tsx`)
- Add `width` and `height` attributes to both `<img>` tags to prevent layout shift
- Consider adding `priority="high"` default for header logo

### 4.2 ChatInterface input accessibility (`src/components/ChatInterface/index.tsx`)
- Add `aria-label="Type a message"` to the input element

---

## Phase 5: FOUC Prevention

### 5.1 Fix html opacity hack (`src/app/[locale]/(frontend)/globals.css`)
- **Issue:** `html { opacity: 0; }` then restored when `data-theme` is set — causes brief invisible page
- **Fix:** Remove the `html { opacity: 0; }` rule and the `[data-theme]` opacity restore. The theme system should work without hiding the page.

---

## Execution Order

| Step | Phase | Files Modified | Risk |
|------|-------|----------------|------|
| 1 | 1.1 | Delete stray dirs | Low |
| 2 | 1.2 | Delete stray files | Low |
| 3 | 2.1 | DigitalIDCard | Low |
| 4 | 2.2 | ChatInterface | Low |
| 5 | 3.1 | homepageHero.tsx | Low |
| 6 | 3.2 | Hero/index.tsx | Low |
| 7 | 3.3 | EventCard.tsx | Low |
| 8 | 3.4 | Members/index.tsx | Low |
| 9 | 3.5 | DigitalIDCard | Low |
| 10 | 3.6 | tailwind.config.mjs | Low |
| 11 | 4.1 | Logo.tsx | Low |
| 12 | 4.2 | ChatInterface | Low |
| 13 | 5.1 | globals.css | Low |

## Verification

After all changes, run: `pnpm build` to ensure no build errors.

## Files NOT to modify
- `apps/billing/` — separate app, own Tailwind v4
- `src/app/(payload)/` — Payload CMS admin, managed by CMS
- `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `memory/` — agent config files
