# Task: Implement Fixed Assets Module – Manager.io Inspired UI

## Objective

Implement a simple, user-friendly Fixed Assets module inspired by Manager.io.

The objective is to provide a lightweight asset management experience while maintaining proper accounting integration and NFRS compliance.

Do not over-engineer the UI.

## 1. Navigation

Create four primary sections:

1. Fixed Assets – Asset register.
2. Depreciation – Depreciation calculation and posting.
3. Disposal – Asset sale, retirement and write-off.
4. Reports – Fixed asset reports.

Asset Categories and Accounting Configuration should be accessible through settings or configuration, not clutter the primary navigation.

## 2. Asset Register

Display the following columns:

- Asset Code
- Asset Name
- Category
- Purchase Date
- Acquisition Cost
- Accumulated Depreciation
- Net Book Value
- Status
- Actions

Allow users to:
- Create an asset.
- Edit asset details.
- View asset details.
- View depreciation history.
- View acquisition transactions.
- Dispose of an asset.

Keep the list clean with search, filters and pagination.

## 3. Asset Registration

Required fields:

- Asset Name
- Asset Code
- Category
- Purchase Date
- Acquisition Cost
- Depreciation Method
- Useful Life
- Residual Value
- Available-for-use Date

Optional fields:

- Description
- Supplier
- Invoice Reference
- Location
- Department
- Custodian
- Funding Source
- Serial Number
- Opening Accumulated Depreciation

Advanced accounting configuration should be optional.

Do not require users to manually select GL accounts for every asset. Inherit accounting mappings from the selected asset category.

## 4. Accounting Integration

Use Manager.io-inspired control account and subaccount architecture.

Maintain:

- Fixed Assets at Cost
- Accumulated Depreciation
- Depreciation Expense
- Gain/Loss on Disposal

Each individual asset should have an identifiable subaccount or equivalent asset-level accounting dimension.

The acquisition transaction must be recorded through the existing accounting transaction workflows.

Support:
- Purchase Invoice
- Payment
- Journal Entry

Link the acquisition transaction to the asset record.

Avoid creating a second independent purchase accounting workflow.

## 5. Depreciation

Support:

- Straight Line
- Diminishing Balance
- Units of Production
- Non-depreciable assets

Create a Depreciation Run workflow.

User selects:
- Financial Year
- Accounting Period
- Posting Date

The system:
1. Finds all eligible assets.
2. Calculates depreciation.
3. Checks previous depreciation postings.
4. Prevents duplicate calculations and postings.
5. Displays an asset-wise preview.
6. Allows approval.
7. Generates journal entries.
8. Updates accumulated depreciation and net book value.

Depreciation must be calculated from the available-for-use date.

Ensure residual value protection and period-level accuracy.

Allow individual depreciation adjustments through controlled accounting entries.

## 6. Asset Disposal

Provide a simple disposal action.

Fields:
- Disposal Date
- Disposal Type
- Disposal Proceeds
- Disposal Account
- Remarks

Automatically:
- Calculate depreciation up to disposal.
- Calculate net book value.
- Remove asset cost.
- Remove accumulated depreciation and impairment.
- Calculate disposal gain or loss.
- Generate journal entry.
- Mark asset as disposed.

Support sale, retirement, donation and write-off.

## 7. Asset Reports

Implement:

- Fixed Asset Register
- Fixed Asset Summary
- Depreciation Calculation Worksheet
- Depreciation Schedule
- Asset Movement Report
- Asset Disposal Report

Reports must reconcile with the General Ledger.

## 8. UI Principles

Follow these principles:

- Prefer simple forms.
- Avoid unnecessary mandatory fields.
- Use sensible defaults.
- Show advanced configuration only when needed.
- Automatically calculate book value and depreciation.
- Avoid exposing accounting complexity to ordinary users.
- Use clear status labels: Active, Fully Depreciated, Disposed.
- Provide confirmation before accounting postings.
- Display useful validation messages.
- Keep consistent with the existing application design system.

## 9. Technical Requirements

Before implementation, inspect:
- Existing Chart of Accounts.
- General Ledger.
- Journal Entry service.
- Purchase Invoice workflow.
- Payment workflow.
- Accounting period management.
- Organisation and branch isolation.

Reuse existing services.

Use decimal-safe calculations and database transactions.

Ensure posted transactions are immutable and corrected through reversals.

Add automated unit, integration and end-to-end tests.

## 10. Implementation Strategy

Implement in this order:

1. Asset categories and COA mappings.
2. Asset registration and register.
3. Acquisition transaction linking.
4. Depreciation calculation.
5. Depreciation posting.
6. Asset disposal.
7. Reports and reconciliation.
8. Testing.

First inspect the existing codebase and present an implementation plan. Then implement incrementally.

Do not introduce unnecessary abstractions, duplicate accounting services or complex UI workflows.

Acceptance criteria: A normal accounting user must be able to register an asset, record its purchase, calculate and post depreciation, dispose of it and generate asset reports without needing to understand the underlying accounting mechanics.