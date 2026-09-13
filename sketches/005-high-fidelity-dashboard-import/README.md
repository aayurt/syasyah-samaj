# Tier 2 High Fidelity: Operator Dashboard & Data Import/Export Hub (005)

## Surface Archetype
- **Operate / Monitor Hybrid:** Designed for high tactile throughput by the community office accountant/cashier.
- **Brand System:**
  - Base: Warm stone neutral ramp (`stone-50` to `stone-900`).
  - Brand Primary: Deep crimson (`#be1a1a` / `crimson-600` - 700).
  - Monospace Accounting Alignment: Tabular numerals with right alignment for currency figures.

## Anti-Slop Audit Checklist (Completed)
1. **No nested cards:** Panels contain direct content strips without container-within-container wrappers.
2. **No arbitrary gradients or AI purple:** Strictly authentic community palette (crimson + stone).
3. **Realistic Devanagari Typography:** Clear hierarchy with bilingual English micro-labels for audit readability.
4. **Interactive Action Bar:** Quick receipt (F1), payment (F2), and journal (F3) keyboard cues.
5. **Integrated Import / Export Modal:**
   - 3-step CSV / Excel / JSON import with conflict resolution rules.
   - Pre-flight table validation preview before database write.
   - 1-click Excel and CSV collection exports.

## How to Test
Open `index.html` and:
- Click **📥 डाटा आयात (Import)** or **📊 थोक निर्यात (Export)** in the top header.
- Test the interactive tabs, duplicate rules, and preview table.
- Test the live filter pills (**सबै**, **रसिद**, **भुक्तानी**, **जर्नल**) and search box.
- Test **प्रमाणित गर्नुहोस्** on pending draft items.
