# Variant 012: Multi-Portal Command Hub (012-org-login-command-portal)

## Design Stance
- **Principle:** Portal/Domain-first selection before entering credentials. Ensures users know exactly which surface they are entering.
- **Target Audience:** Multi-role organization users: regular members, Ilaka coordinators, and treasury/billing cashiers.
- **Layout Axis:** 3 prominent portal gateway selection cards on top + dynamic contextual authentication box below.

## Key Choices
- **3-Portal Domain Cards:**
  1. **नागरिक तथा सदस्य पोर्टल (Citizen & Member Desk):** Digital ID, dues renewal, family records.
  2. **इलाका सचिवालय डेस्क (Ilaka Coordinator Desk):** Local 24 Ilaka approvals, local census, blood donor coordination.
  3. **स्यस्यः धुकू (Accounting & Billing SPA /app):** Receipts, payments, journals, cashier desk.
- **Contextual Form Adaptation:** Clicking a portal card re-labels the login form, explains what credentials to use, and shows the exact post-login destination.

## Trade-offs
- **Strong at:** Mental model clarity, zero ambiguity on where credentials will take the user, enterprise multi-portal feel.
- **Weak at:** Adds one extra click (selecting a portal) for users who just want to enter their password immediately.

## Best For
A multi-faceted community institution where users often get confused about whether they are logging into the member directory, their local Ilaka desk, or the accounting system.
