# Variant 010: Split-Screen Civic Desk (010-org-login-split-desk)

## Design Stance
- **Principle:** Asymmetric split-screen layout pairing civic governance clarity on the left with a focused dual-persona login card on the right.
- **Target Audience:** Community members, 24 Ilaka coordinators, and Samaj administrative staff.
- **Layout Axis:** 5/12 institutional sidebar (official seals, role definitions, security advisories, telephone helpdesk) + 7/12 interactive authentication container.

## Key Choices
- **Dual Persona Switcher:** Clean tab toggle separating **सदस्य लगइन (Member)** from **संस्थागत / इलाका (Staff/Coordinator)**, which dynamically swaps identifier input placeholders and hints.
- **Elder-Accessible Fast SMS OTP:** Secondary action button to receive a 6-digit SMS verification code on mobile without needing to remember complex passwords.
- **Clear Isolation from `/admin`:** Explicit disclaimer footer keeping regular users in community channels while directing developers/super-admins to `/admin`.
- **Strict Grayscale Architecture:** High-contrast 1px borders, bold Devanagari labels, and tactile button outlines.

## Trade-offs
- **Strong at:** Explaining user roles, contextual help, institutional trust, split-desktop aesthetic.
- **Weak at:** Ultra-minimalist single-card mobile flows (left sidebar wraps on small viewports).

## Best For
A comprehensive institutional entry point where visitors need to know exactly which credentials to use and where they are being routed.
