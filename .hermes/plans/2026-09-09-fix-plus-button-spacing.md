# Plan: Fix "+" (Add Fiscal Year) Button Spacing

## Problem
The red "+" button next to the Fiscal Year selector sits flush against the dropdown with no visible gap. It looks cramped.

## Current Code (FiscalYearSwitcher.tsx line 133)
```tsx
className="pointer-events-auto absolute -right-5 top-1/2 -translate-y-1/2 rounded-full bg-crimson-600 text-white p-1 hover:bg-crimson-700 ..."
```

`-right-5` = -1.25rem = -20px — positions the button's center at the container's right edge, so it overlaps or sits flush.

## Fix
Change `-right-5` to `-right-8` (or `-right-9`) to add a visible gap (~12-16px) between the FY dropdown and the "+" button.

**File:** `apps/billing/src/components/FiscalYearSwitcher.tsx` line 133

**Before:**
```tsx
className="pointer-events-auto absolute -right-5 top-1/2 ..."
```

**After:**
```tsx
className="pointer-events-auto absolute -right-8 top-1/2 ..."
```

## Verification
- Toggle language to Nepali → confirm the "+" button still has the gap
- Click the "+" → should navigate to Setup Wizard fiscal year step
- No tsc errors
