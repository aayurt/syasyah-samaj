# UX Copy & Flow Audit — Afno Billing

> Companion to `SETUP_AND_E2E_PLAN.md`. Purpose: check whether the flow and
> wording need changing **before** the E2E suite locks them in. Tests encode
> whatever wording exists, so we fix wording first, then write specs against the
> fixed copy.
> Status: **Option A (copy-only sweep) implemented** — see §9 changelog.

---

## 1. The vocabulary is inconsistent (biggest issue)

The same document types are called three different things in three different
places. A user sees "Vouchers" in the sidebar, "Sales Entry" in the type
dropdown, "Sales" on the create-form card, and the printed/numbered document is
`SI-…` (Sales **Invoice**). That's four names for one thing.

| Surface | Source | Example |
|---|---|---|
| Sidebar + page title | `App.tsx` | "Vouchers" |
| Type dropdown + table column | `DOC_TYPE_LABELS` (`types.ts`) | "Sales Entry", "Purchase Entry", "Payment Entry", "Receipt Entry", "Journal Entry" |
| Create-form cards | `DOC_TYPE_META.shortLabel` (`VoucherForm.tsx`) | "Quote", "Sales", "Purchase", "Payment", "Receipt", "GRN", "Challan", "Journal", "Contra" |
| Numbers / PDFs | `DOC_PREFIXES` (server) | `SI-`, `PI-`, `PV-`, `RV-`, `JV-` |

### Recommended unified vocabulary (one label everywhere)

| docType | Today (list) | Recommended |
|---|---|---|
| `sales-invoice` | Sales Entry | **Sales Invoice** |
| `purchase-invoice` | Purchase Entry | **Purchase Invoice** |
| `payment-voucher` | Payment Entry | **Payment** |
| `receipt-voucher` | Receipt Entry | **Receipt** |
| `journal-voucher` | Journal Entry | Journal Entry (keep) |
| `contra` | Contra Entry | Contra Entry (keep) |
| `credit-note` | Credit Note | Credit Note (keep) |
| `debit-note` | Debit Note | Debit Note (keep) |
| `petty-cash-voucher` | Petty Cash Voucher | Petty Cash |
| `grn` | Goods Received Note | Goods Received (GRN) |
| `delivery-challan` | Delivery Challan | Delivery Challan (keep) |
| `sales-quote` | (form card: "Quote") | Quote (keep) |
| `membership-receipt` | Membership Receipt | Membership Receipt (keep) |
| `donation-receipt` | Donation Receipt | Donation Receipt (keep) |

Rationale: "Entry" is vaguer than "Invoice"; the printed document and the number
prefix both say Invoice, so the UI should too. "Payment"/"Receipt" are the
manager.io-style names users already understand. Short form-card labels get
**full** names (`Sales Invoice`, `Purchase Invoice`, `Goods Received (GRN)`) so
the create step is unambiguous.

---

## 2. Button wording & capitalization is inconsistent

| Where | Today | Problem | Recommended |
|---|---|---|---|
| Vouchers inline form | `Save draft` / `Save & post` | sentence case | `Save draft` / `Save & post` (keep, make canonical) |
| VoucherForm bottom bar | `Save Draft` / `Save & Post` | title case, different from inline | `Save draft` / `Save & post` |
| VoucherForm quote button | `Save Quote` + disabled green **"Non-posting"** button | a disabled button that just says "Non-posting" is confusing | Hide the post button for quotes; show hint text: *"Quotes don't post — copy to an invoice when accepted"* |
| Journal save | (uses "Entry must be balanced to post" tooltip) | fine | keep |
| Edit draft banner | "Editing draft — changes apply to this voucher" | good | keep |

**Rule going forward:** primary action = `Save & post` (green), secondary =
`Save draft` (outline), sentence case, identical on every surface.

---

## 3. Status filter chips show raw values

The Vouchers status filter renders `draft`, `posted`, `void`, `all` — raw
enum strings, lowercase. Users see "void" and "draft" like debug output.

**Recommended:** `All` / `Draft` / `Posted` / `Void` (title case). Same pattern
on any other raw-enum chip (check Journal, Members, Recurring Billing).

---

## 4. Empty states have no call-to-action

| Where | Today | Recommended |
|---|---|---|
| Vouchers list | "No vouchers yet." | + button **"Create your first voucher"** |
| Accounts | (table only) | "No accounts yet — start by adding groups and accounts" + CTA |
| Parties / Items / Members | check | consistent "empty → one primary CTA" pattern |

A first-run user needs the *next action*, not just a blank message. This ties
into the Dashboard setup checklist (see plan M1).

---

## 5. Dashboard jargon (AR/AP)

Dashboard cards: `Receivable (AR)` / `Payable (AP)`.

**Recommended:** plain labels with the abbreviation as subtext —
**"Receivables — money owed to you"**, **"Payables — money you owe"**. Same
numbers, friendlier for non-accountants; keep AR/AP in report titles where
users expect the jargon.

---

## 6. Void copy mixes "Void" and "Voided"

Void modal: `Qty Voided`, `Total Voided`, `Void Items`, `Void Qty`,
`Total Void Amount:`. Verb/noun/adjective mixed.

**Recommended (one consistent set):**
- Action buttons: **Void** / **Void items**
- Labels: **Quantity to void**, **Total void amount**
- Result state (pill/modal): **Voided** (state) — already used in StatusPill
- Reason field: **Reason for void** (keep — good)

---

## 7. Flow recommendations (from the E2E plan, restated for this audit)

1. **Setup gate (M1)** — Dashboard onboarding card: Company → Fiscal year →
   Chart of accounts → Default accounts → Masters → First voucher; posting
   disabled until year + defaults exist, with a clear "Finish setup first"
   pointer. *This is the single biggest flow fix — it turns "stuck at 0 /
   draft forever" into a guided path.*
2. **One create path** — "New voucher" should always open the full
   `VoucherForm` (with type cards). The inline quick-form on the Vouchers list
   can stay for editing drafts, but avoid two competing "create" flows with
   different button text.
3. **Post feedback** — after `Save & post`, confirm with the assigned number:
   toast **"Posted as SI-2083-84-0001"** (verify toast exists today; if not,
   add it). This closes the loop on "did it actually post?"
4. **Draft visibility** — drafts already appear in the table with a status
   column; keep, plus the drafts-count badge proposed in the plan.
5. **RequiredChecklist pattern** (VoucherForm) is excellent — extend the same
   checklist idea to Settings and the setup gate so "what's missing" is always
   visible.

---

## 8. Scope decision

| Option | What it covers | Effort |
|---|---|---|
| **A. Copy-only sweep (recommended first)** | §1 vocabulary in `types.ts` + `VoucherForm.tsx` cards; §2 button text; §3 status chips; §5 dashboard labels; §6 void copy | small, no logic change |
| **B. A + empty states & CTA** | adds §4 CTAs on empty lists | small |
| **C. A + B + flow (setup gate, post feedback)** | full M1 from the E2E plan | medium — separate milestone |

**Recommendation:** do **A now** (pure wording, zero risk to logic, makes every
surface consistent), then **B** with the empty-state pass, then implement the
**setup gate** as its own milestone so Playwright specs (E2E plan) are written
against final copy and the guided flow.

---

## 9. Changelog — Option A implemented

Applied (commit pending):

- **§1 vocabulary** — `DOC_TYPE_LABELS` (`types.ts`) unified: Sales Invoice,
  Purchase Invoice, Payment, Receipt, Quote, Goods Received (GRN), Petty Cash;
  `DOC_TYPE_META.shortLabel` (`VoucherForm.tsx`) now shows full names on the
  create cards (Sales Invoice, Purchase Invoice, Goods Received (GRN), Delivery
  Challan, Journal Entry, Contra Entry); inline-form `DOC_TYPES` (`Vouchers.tsx`)
  and CommandPalette shortcuts updated to match.
- **§2 buttons** — VoucherForm bottom bar is now `Save draft` / `Save & post`
  (sentence case, matching the inline form); the disabled green **"Non-posting"**
  button is gone for quotes, replaced by the hint *"Quotes don't post — copy to
  an invoice when accepted"*.
- **§3 status chips** — Vouchers + Journal filters render `All / Draft / Posted /
  Void`; Parties filter renders `All / Customer / Vendor / Both`.
- **§5 dashboard** — cards read **Receivables (money owed to you)** and
  **Payables (money you owe)**.
- **§6 void copy** — modal labels now `Qty to void`, `Total void amount`; header
  row `Total Void Amount`.

Not done (deferred): §4 empty-state CTAs (Option B), §7 flow items (Option C).