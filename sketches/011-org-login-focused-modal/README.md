# Variant 011: Focused Trust Card (011-org-login-focused-modal)

## Design Stance
- **Principle:** High-trust, ultra-accessible single elevated card (Gov.uk / Stripe checkout simplicity).
- **Target Audience:** General public, elders needing friction-free entry, and committee members on mobile devices.
- **Layout Axis:** Centered single-column container with intelligent smart identifier detection.

## Key Choices
- **Smart Identifier Auto-Detection:** Automatically detects whether the user is typing a Member ID (`SS-...`), Mobile Number (`98...`), or Staff Email (`...@...`) and renders a live badge.
- **First-Class SMS OTP Support:** Seamless tab switch to passwordless SMS OTP for elders who struggle with password remembering.
- **High Visual Discipline:** Strict 2px solid border, 0 distraction, and maximum mobile responsiveness.

## Trade-offs
- **Strong at:** Simplicity, speed, mobile ergonomics, universal accessibility.
- **Weak at:** Providing deep educational / institutional context about the 24 Ilakas.

## Best For
A clean, universal login screen that works instantly across all devices and technical literacy levels.
