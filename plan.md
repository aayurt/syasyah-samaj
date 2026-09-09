# Accounting Defects + Membership Plan

## Confirmed Defects

### 1. Offline Stale Cache
- **Issue:** `cacheVersion` doesn't bump on FY change
- **Impact:** Users see stale data after fiscal year transitions

### 2. Dropdown Visibility
- **Issue:** z-30 absolute positioning, breaks in `overflow: hidden` ancestors
- **Impact:** Dropdown menus clipped/unreachable in constrained containers

---

## Membership Plan (M1–M6)

| Phase | Description | Status |
|-------|-------------|--------|
| M1 | Schema | — |
| M2 | Form UI | — |
| M3 | Print | — |
| M4 | i18n | — |
| M5 | Translate | — |
| M6 | E2E | — |

**Flow:** M1 → M2 → M3 → M4 → M5 → M6

---

## Current Work

- [ ] Uncommitted changes in 6 collections + billing app
- [ ] Create automation to validate + test the two confirmed defects
- [ ] Fix: offline cacheVersion bump on fiscal year change
- [ ] Fix: dropdown z-index / mount-portal issue
- [ ] Membership UI M1: schema
- [ ] Create validation results summary

---

*Created: 2026-09-08*