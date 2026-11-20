# Upgrade Transaction Line Architecture & UI
## Dynamic Item, Account & Subaccount Selection

### Objective

Upgrade the existing accounting transaction-line implementation to support dynamic Item and Account selection, following the simplicity and usability philosophy of Manager.io.

**Important:** The application already has an implementation. Do not rebuild the transaction system from scratch. First inspect the existing architecture, components, database models, account relationships, transaction forms and posting logic. Identify what can be reused and incrementally improve it.

The primary goals are:
- Clean, minimal and intuitive accounting UI.
- Dynamic Item-to-Account mapping.
- Conditional Subaccount selection.
- Consistent quantity, pricing and tax calculations.
- Correct double-entry accounting.
- Reusable transaction-line component across all accounting documents.

---

# 1. Core Transaction Line Behaviour

Implement two primary workflows.

### Workflow A: Item selected

When a user selects an Item:

1. Automatically determine the appropriate Account using the item's account mapping.
2. Populate the default description.
3. Populate the default unit price based on transaction type.
4. Populate the applicable Tax Code.
5. Display quantity, unit price, tax and calculated total.
6. Allow Account override only if permitted by the transaction and accounting rules.
7. Validate that the selected account is compatible with the transaction.

Item types:
- Inventory Item
- Non-Inventory Item

Account mapping must be transaction-context-aware.

For example:

| Transaction | Item Account Mapping |
|---|---|
| Sales Invoice | Sales Revenue Account |
| Purchase Invoice | Purchase / Inventory Account |
| Sales Credit Note | Sales Return Account |
| Purchase Debit Note | Purchase Return Account |

Do not use one generic account mapping for all transaction types.

### Workflow B: Item not selected

If the Item field is empty:

1. Allow the user to select an Account manually.
2. Check whether the selected Account requires an additional subledger or subaccount.
3. Dynamically display the relevant selector.
4. Allow the user to enter a description, quantity, unit price and tax code.
5. Calculate the transaction line total normally.

Examples:

| Account | Additional Selector |
|---|---|
| Capital Accounts | Capital Account + Capital Subaccount |
| Accounts Receivable | Customer |
| Accounts Payable | Supplier |
| Fixed Assets | Fixed Asset |
| Bank Accounts | Bank Account |
| Employee Payable | Employee |
| Rent Expense | None |
| Sales Revenue | None |

Do not hardcode these selectors in the transaction-line component. Resolve them through existing account configuration and subledger relationships.

---

# 2. Item Selection Logic

Items should contain reusable default transaction information.

Inspect the existing Item model and extend it only where necessary.

Suggested properties:

- Item Name
- Item Type (Inventory / Non-Inventory)
- Sales Account
- Purchase Account
- Sales Tax Code
- Purchase Tax Code
- Sales Price
- Purchase Price
- Default Description
- Unit of Measurement (optional)

When an item is selected, populate its defaults without unnecessarily overwriting user-entered values.

### Important override behaviour

- Changing Item should refresh item-derived defaults.
- Clearing Item should not automatically clear the manually selected Account.
- Changing unrelated fields should never reset user overrides.
- If changing an Item would replace a manually overridden Account, preserve the override or request confirmation.
- Never silently discard user-entered transaction information.

---

# 3. Account & Subaccount Logic

The Account is the actual General Ledger posting destination.

Implement account-dependent field resolution.

Each account should be able to define whether it requires:

- No additional selection.
- A subledger entity.
- A capital account.
- A subaccount classification.
- Another supported subsidiary ledger.

Example:

Capital Accounts:

Capital Accounts
  └── Capital Account
       ├── Member A
       ├── Member B
       └── Member C

Capital Subaccounts:
- Paid Up Capital
- Additional Contributions
- Drawings
- Profit Distribution

Important:
- Do not confuse Subledger with Subaccount.
- Subledger identifies an entity, such as a member or supplier.
- Subaccount classifies the transaction.
- A transaction line should only allow valid combinations.
- Paid Up Capital and Drawings should be alternative classifications, not simultaneously selected classifications.

When Account changes:
- Re-evaluate dependent selectors.
- Clear only incompatible selections.
- Preserve compatible values.
- Validate the account/subledger relationship before saving.

---

# 4. Transaction Line UI — Clean Design

Upgrade the existing transaction-line UI with a minimal, professional accounting interface.

### Recommended column structure

| Column | Behaviour |
|---|---|
| Item | Optional searchable dropdown |
| Account | Searchable dropdown, auto-populated from Item |
| Subledger / Subaccount | Conditional selector |
| Description | Editable text |
| Qty | Numeric |
| Unit Price | Numeric / currency |
| Tax Code | Searchable dropdown |
| Tax Amount | Automatically calculated |
| Total | Automatically calculated |

### UI requirements

1. Keep the existing application's design system and component library.
2. Use compact controls with consistent heights and spacing.
3. Avoid unnecessary borders, background colours and visual clutter.
4. Use searchable dropdowns for Items and Accounts.
5. Show conditional selectors only when needed.
6. Avoid displaying empty or irrelevant fields.
7. Support keyboard navigation and fast data entry.
8. Use appropriate number and currency formatting.
9. Make the transaction table horizontally responsive.
10. Provide clear validation messages without overwhelming the user.

### Interaction design

- Item dropdown should be the first selection.
- Account should be automatically populated when an Item is selected.
- If Item is empty, Account remains manually selectable.
- Conditional selectors should appear only after Account selection.
- Quantity, Unit Price and Tax should remain consistent across both workflows.
- Add a new line action should create a clean empty row.
- Support adding, editing, deleting and duplicating transaction lines where the existing application supports these operations.

Do not introduce excessive modal dialogs or additional configuration steps.

---

# 5. Calculation Engine

Implement a consistent calculation engine for all transaction lines.

Base calculation:

Subtotal = Quantity × Unit Price

For VAT-exclusive transactions:

Tax Amount = Subtotal × Tax Rate

Line Total = Subtotal + Tax Amount

For VAT-inclusive transactions:

Tax Amount = Subtotal × Tax Rate / (100 + Tax Rate)

Subtotal = Line Total - Tax Amount

Consider:
- Tax-inclusive and tax-exclusive pricing.
- Multiple tax codes.
- No-tax transactions.
- Decimal precision.
- Currency rounding.
- Discounts, if already supported.
- Negative quantities or credit transactions where applicable.

Do not duplicate calculation logic across different transaction forms.

Quantity and Unit Price should be editable but should not be mandatory for every accounting transaction. Support direct amount entry where appropriate.

---

# 6. Accounting & Journal Posting

The UI must not determine accounting correctness by itself.

Every transaction line must produce correct General Ledger postings.

Examples:

### Sales Invoice

Dr Accounts Receivable
Cr Sales Revenue
Cr VAT Payable

For inventory items, additionally:

Dr Cost of Goods Sold
Cr Inventory on Hand

### Purchase Invoice

Dr Expense / Inventory
Dr VAT Receivable (where recoverable)
Cr Accounts Payable

### Member Capital Contribution

Dr Cash / Bank
Cr Capital Accounts

The capital account and subaccount must retain the correct member-level attribution.

### Drawings

Dr Capital Account - Drawings
Cr Cash / Bank

Ensure all journal entries balance.

Do not create duplicate postings when an item automatically maps to an account.

---

# 7. Reusable Architecture

Create or upgrade a shared Dynamic Transaction Line component.

It should be reusable across:

- Sales Invoice
- Purchase Invoice
- Sales Receipt
- Payment
- Receipt
- Journal Voucher
- Credit Note
- Debit Note
- Other applicable accounting documents.

Each transaction should pass its context to the shared component.

For example:

transactionType = SALES_INVOICE
transactionType = PURCHASE_INVOICE
transactionType = RECEIPT
transactionType = PAYMENT
transactionType = JOURNAL

The component should resolve:
- Item mapping.
- Account selection.
- Subledger requirements.
- Tax defaults.
- Pricing defaults.
- Calculation rules.

Avoid creating separate, duplicated transaction-line implementations.

---

# 8. Data Integrity & Validation

Implement the following safeguards:

- Account is required.
- Item is optional.
- Selected Item must be valid for the transaction type.
- Item-to-account mapping must be valid.
- Required subledger selections cannot be omitted.
- Subaccounts must belong to the selected account.
- Tax Code must be valid for the transaction.
- Quantity and price must follow the existing numeric validation rules.
- Posted transactions must preserve historical account and price information.
- Editing a transaction must not unexpectedly change previous postings.
- Recalculate totals consistently on both frontend and backend.
- Validate journal balance before posting.

Use database transactions when saving accounting entries and their associated ledger postings.

---

# 9. Testing Requirements

Do not consider the task complete after implementing the UI.

Test the following scenarios:

1. Select an inventory item on a Sales Invoice.
2. Select a non-inventory item on a Sales Invoice.
3. Select an item on a Purchase Invoice.
4. Change an item's default account.
5. Clear an Item and manually select an Account.
6. Select Capital Accounts and verify conditional selectors.
7. Select Drawings and verify correct posting.
8. Select Rent Expense and verify no unnecessary subaccount selector.
9. Select Accounts Receivable and verify Customer selection.
10. Change Account after selecting a Subaccount.
11. Change Item after manually overriding Account.
12. Change Quantity and Unit Price.
13. Change Tax Code and verify recalculation.
14. Save, reopen and edit a transaction.
15. Verify balanced journal entries.
16. Verify inventory quantities and valuation where applicable.

Add automated tests for account resolution, item mapping, dependent selectors, calculations and journal posting.

---

# 10. Implementation Instructions

Follow this implementation sequence:

**Phase 1 — Audit**
- Inspect the existing transaction-line component.
- Inspect Item, Account, Subaccount and Subledger models.
- Inspect account mapping and journal posting services.
- Identify duplicated or conflicting logic.
- Document the existing behaviour and gaps.

**Phase 2 — Architecture**
- Define the shared item/account resolution logic.
- Define conditional selector configuration.
- Reuse existing database entities wherever possible.
- Implement a common calculation engine.

**Phase 3 — UI Upgrade**
- Upgrade the existing transaction-line interface.
- Implement dynamic Item-to-Account mapping.
- Implement conditional Account-dependent selectors.
- Improve keyboard navigation and responsive layout.

**Phase 4 — Accounting Integration**
- Connect the new line behaviour to existing journal posting.
- Preserve double-entry accounting.
- Verify inventory and tax postings.

**Phase 5 — Verification**
- Run existing tests.
- Add missing unit and integration tests.
- Run end-to-end tests for all relevant transaction types.
- Fix regressions and verify existing workflows.

### Critical Instructions

- Do not rewrite the application.
- Do not introduce unnecessary database migrations.
- Do not duplicate existing business logic.
- Do not break existing transaction forms or historical transactions.
- Do not change unrelated UI components.
- Follow existing coding conventions and architectural patterns.
- Prefer incremental refactoring over replacing working implementations.
- Do not use mock data to claim successful implementation.
- Run actual tests and report their results.

### Expected Deliverables

1. Summary of the existing implementation and identified gaps.
2. Updated shared transaction-line component.
3. Dynamic Item-to-Account mapping.
4. Conditional Account/Subledger/Subaccount selection.
5. Consistent calculation and tax logic.
6. Correct journal posting integration.
7. Automated tests.
8. List of modified files and any database migrations.
9. Verification results and remaining limitations.

**Definition of Done:** A user can create an accounting transaction by either selecting an Item (which automatically resolves its Account) or selecting an Account directly (which conditionally reveals the appropriate subsidiary selectors). Both workflows must use the same clean transaction-line UI, calculation engine and reliable double-entry posting system.