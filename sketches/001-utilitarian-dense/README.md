## Variant: Utilitarian Dense

### Design stance
A dense, tool-like accounting screen built for speed and scannability — the Dr/Cr balance is always visible, numbers are monospace, and the type selector is a compact grid on step 1.

### Key choices
- Layout: full-width stepper header, step 1 type grid (4 cols), step 2 split into meta (left) + lines table (right)
- Typography: system monospace, small, uppercase labels
- Color: crimson primary on neutral slate/white
- Interaction: type chips toggle active state, Continue enables only after selection, live balance recomputes on every input

### Trade-offs
- Strong at: data entry speed, balance visibility, power users who live in the ledger
- Weak at: first-time users (dense), smaller screens (grid cramps)

### Best for
- Daily bookkeeping volume; accountants who value information density over guidance
