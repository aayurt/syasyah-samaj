# Stance B: Operator & Daily Cashier Stance (002-operator-cashier)

## Design Stance
- **Audience:** Samaj billing accountant, cashier, or office operator sitting at the counter.
- **Goal:** Fast, tactile throughput. Minimize clicks needed to create receipts for walking-in members, check today's petty cash balance, print vouchers, and approve drafts.
- **Layout Axis:** 3-Column command dashboard (Left: Cash Drawer & Bank Balances / Center: Dense Live Transaction Ledger / Right: Pending Drafts Queue & Keyboard Shortcuts).

## Key Choices
1. **Prominent Top Command Bar:** 1-click access to Receipt (रसिद), Payment (भुक्तानी), and Journal (जर्नल) with F1/F2/F3 key hints.
2. **Real-time Drawer Counter:** Cash-in-hand tracking with today's collections vs payouts and a direct Day-Close (reconcile) action.
3. **Pending Drafts Triage Panel:** Directly shows vouchers awaiting review so drafts don't get forgotten.
4. **Instant In-line Filtering & Search:** Quick pills to filter by Receipt/Payment/Journal and live member search.

## Trade-offs
- Less focused on long-term 12-month analytics and visual bar charts. Centers around the "now" (today's cash, today's transactions, unposted drafts).
