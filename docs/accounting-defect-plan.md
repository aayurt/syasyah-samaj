# Accounting App - Implementation Plan

## Source
Google Doc defect report: https://docs.google.com/document/d/1lNPRNs0kSyJpP-9LHHHlMfSMM2PRmUs8ahsAJPFxQcA

## Phase 1: Fiscal Year Fixes
1. Cache clearing on window close (`fiscalYear.tsx`)
2. BS date validation for invalid dates (2082-03-32)
3. UI validation message for active year conflict

## Phase 2: Series Management UI
1. Build series management in Settings.tsx
2. Protect posted series from deletion
3. Auto-assign codes per document type

## Phase 3: Transaction Entry
1. Rename Journal to "Transaction Entry"
2. Add tabs: Posting | Reopen | Delete | Void
3. Reopen functionality for posted entries
4. Remark field for void/reopen actions

## Phase 4: Chart of Accounts
1. Verify default accounts seed data
2. Account head mapping verification

## Status: In Progress
