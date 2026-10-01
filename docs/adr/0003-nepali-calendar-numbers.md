# ADR-0003: Nepali Calendar (BS) and Number Formatting

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Architecture team

## Context

The syasyah-samaj application serves Nepali communities and must support:
- **Bikram Sambat (BS)** calendar alongside Gregorian (AD)
- **Devanagari digits** (०-९) for number display
- **Nepali amount-in-words** (लाख/करोड़ grouping) for vouchers and reports

## Decision

### Dual Date System
- All date fields store **both** AD (ISO 8601) and BS (YYYY-MM-DD) formats
- `nepali-date-converter` library for conversion
- `NepaliDateInput` component for unified AD/BS entry
- Fiscal years defined in BS (e.g., 2081/04/01 – 2082/03/31)

### Number Formatting
- `fmt(value, options)` in `apps/billing/src/lib/api.ts` — single formatting function
- `nepaliDigits` setting in BillingSettings (per-tenant toggle)
- `toNepaliDigits(str)` / `fromNepaliDigits(str)` utilities
- Amount-in-words: English (`numberToWords`) + Nepali (`numberToNepaliWords`)

### Implementation Locations
- `apps/billing/src/lib/numbers.ts` — core formatting utilities
- `apps/billing/src/lib/nepaliNumbers.ts` — Nepali-specific conversions
- `apps/billing/src/components/NepaliDateInput.tsx` — date picker
- `apps/billing/src/components/PrintVoucher.tsx` — amount in words
- `apps/billing/src/pages/Settings.tsx` — nepaliDigits toggle

### Import/Export
- Excel export: columns for both AD and BS dates
- Excel import: parse both formats, prefer BS if present
- CSV export: UTF-8 BOM for Excel Devanagari support

## Consequences

**Positive:**
- Native Nepali UX
- Audit-compliant (BS dates required for Nepali govt)
- Single source of truth for formatting

**Negative:**
- Dual date storage increases schema complexity
- Conversion library adds bundle size
- Testing matrix doubles (AD + BS)

## Related

- ADR-0004: Import/Export (Nepali digits in Excel)
- `apps/billing/src/lib/numbers.ts` — formatting implementation
- `apps/billing/src/components/NepaliDateInput.tsx` — UI component
- BillingSettings global — `nepaliDigits` toggle