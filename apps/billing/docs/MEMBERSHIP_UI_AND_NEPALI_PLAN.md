# Plan: Membership Entry UI (Paper-Form Style) + Nepali UI Language

Source: the physical "साधारण/स्थायी/आजीवन दुज़ (सदस्य) आवेदन फाराम" of स्यस्यः समाज, यल.

Two workstreams, independent but sharing groundwork:

- **A. Membership Application form UI** — a form that mirrors the paper application, so a
  data-entry clerk transcribes a filled paper form top-to-bottom without hunting for fields.
- **B. Nepali UI language** — all labels, menus, buttons, statuses, and printed output in
  Nepali. **Inputs stay English-only** (data entry in English; display in Nepali).

---

## A. Membership Application Form (paper-form parity)

### A1. Field mapping — paper → schema

The current `members` collection lacks most paper fields. Add a `application` group
(all text, English input):

| Paper field (Nepali) | English meaning | New field |
|---|---|---|
| ल्या: (सि.न.) | Reg. no. | `memberId` (exists) |
| नां (नाम) | Name | `fullName` (exists) |
| नागरिकता ल्या: (नं.) | Citizenship no. | `application.citizenshipNo` |
| नागरिकता का.मु दि (लिएको मिति) | Citizenship issued date (BS) | `application.citizenshipIssuedDateBs` (text `YYYY-MM-DD`, compact NepaliDateInput) |
| नागरिकता का.मु (लिएको) जिल्ला | Citizenship issue district | `application.citizenshipDistrict` (select of 77 districts) |
| ठेगाना: स्थायी | Permanent address | `application.addressPermanent` |
| अस्थाई | Temporary address | `application.addressTemporary` |
| इमेल ठेगाना | Email | `email` (exists) |
| फोन ल्या: | Phone | `phoneNumber` (exists) |
| मोबाइल ल्या: | Mobile | `application.mobile` |
| रक्ता (सिसिदा) | Blood group | `idCardDetails.bloodGroup` (exists) — select (A/B/AB/O × +/−) |
| विशिष्टता | Special qualifications | `application.specialQualification` |
| लजगा (पेशा) | Occupation | `application.occupation` |
| ज्याकृषिया नां (कार्यालयको नाम) | Office name | `application.officeName` |
| बेंया नां (बाबुको नाम) | Father's name | `application.fatherName` |
| बाज्यया नां (बाजेको नाम) | Grandfather's name | `application.grandfatherName` |
| वा:जुया नां (ससुराको नाम) | Father-in-law's name | `application.fatherInLawName` |
| तिरी भाजु/म्याजुया नां (पति/पत्नीको नाम) | Spouse name | `application.spouseName` |
| काय्या नां (छोराको नाम) | Son's name | `application.sonName` |
| म्यायायुया नां (छोरीको नाम) | Daughter's name | `application.daughterName` |
| दुज़ (साधारण/स्थायी/आजीवन) | Membership tier | `membershipType` relation (exists) |
| फोटो | Photo | `profileImage` upload (exists) — square crop preview |
| रसिद नं / दां (रकम) | Receipt no / amount | via existing **Pay fee** action (`pay-fee` endpoint) |
| मिति: २०८ / / | Application date (BS) | `application.appliedDateBs` |

### A2. UX design (Members page)

**Will the UI look the same as the paper?** Yes — that's the goal, with one deliberate
split:

- **On-screen (entry mode)**: a form that *mirrors the paper's layout* — same field
  order, same dotted-line groupings, same two-column rows (e.g. ना (नाम) on the left,
  नागरिकता ल्या: on the right) — but rendered as proper inputs so a clerk can type fast.
  Fields are placed exactly where they sit on the paper, including the फोटो box in the
  top-right corner and the receipt/date block at the bottom. Familiar = fewer
  transcription errors.
- **Print mode**: a **pixel-faithful replica of the original paper form** — the exact
  फाराम with the entered data shown in the dotted blanks. This is what the office
  prints/archives; it looks like the physical document, not like a web form.

So: same *layout and vocabulary*, two renderings — editable inputs on screen, exact
paper replica on print.

- **Two view modes** on `/members`, toggled by a segmented control:
  1. **Table** (current list) — default.
  2. **Application Form** (नयाँ आवेदन) — full-page form styled like the paper:
     org header (logo, स्यस्यः समाज, यल / Syasyah Samaj, Yala, phone), the red
     "साधारण/स्थायी/आजीवन दुज़: (सदस्य) आवेदन फाराम" title, then sections:
     - **Identity**: name, citizenship no / date (NepaliDateInput compact) / district
     - **Address & contact**: permanent, temporary, email, phone, mobile
     - **Personal**: blood group, special qualification, occupation, office name
     - **Family**: grandfather → father → father-in-law → spouse → son → daughter
       (paper order, one row per relationship)
     - **Membership & fee**: tier select (filters to type list), photo upload with
       preview in a "फोटो" frame, receipt no + amount (auto-filled by Pay fee),
       applied date (BS)
     - Footer note: "दस्तखत: नागरिकताका फोटो कापि संलग्न यानादिस ।"

### A3. Printable format (print view) — M3 detail

A dedicated **print replica** of the paper form, rendered from the same saved member
record:

- **One component, two skins**: `ApplicationForm.tsx` holds the data + a shared layout;
  it renders as inputs on screen and switches to a static `print:true` rendering when
  printing. No duplicated markup to keep in sync.
- `window.print()` with a scoped `@media print` stylesheet:
  - Hide app chrome (sidebar, header, banners, buttons) — only the form sheet prints.
  - Sheet: A4 portrait, the org letterhead (logo, bilingual name, phone), red underlined
    फाराम title, fields drawn as the original dotted lines with the data in-line
    (e.g. `ना (नाम) : राम बहादुर श्रेष्ठ`), the empty फोटो box top-right, signature/
    रसिद/मिति block at the bottom, and the bordered footer note.
- **Blank-form printing**: a "Print blank form" action renders the same replica with no
  data — so the office can also print empty paper forms from the app.
- **Where the print button lives**: on the Application Form view ("प्रिन्ट") and as a
  "Print form" row action in the Members table for any saved member.
- Photo: if uploaded, the print replica draws the photo inside the फोटो box; otherwise
  the box stays empty exactly like the paper.
- Fonts: Devanagari webfont already used by the app; print CSS forces black-on-white
  and disables shadows/hover states.

### A4. Server changes

- Extend `src/collections/Members/index.ts` with the `application` group + district
  options + blood-group select (convert `idCardDetails.bloodGroup` from text→select).
- Optional: `application.formNo` auto-numbering (per-tenant sequence, like voucher
  numbering) — mark **phase 2**.
- Save creates/updates a `member`; the existing **Pay fee** endpoint stays the money path
  (no double entry — the form only records fee amount/receipt no for reference).

---

## B. Nepali UI language (display-only; inputs stay English)

### B1. Approach — lightweight i18n layer (no heavy library)

- New `apps/billing/src/lib/i18n.tsx`:
  - `LangProvider` + `useT()` hook; `t('key')` resolves against a dictionary.
  - Language stored in localStorage (`ui-lang`: `en` | `ne`), default `ne`.
  - Two dictionaries: `en.ts`, `ne.ts` — flat key maps, grouped per page
    (`nav.*`, `voucher.*`, `members.*`, `settings.*`, `common.*` …).
- Settings gets a **Language / भाषा** toggle (English / नेपाली) + persisted.

### B2. Translation scope (priority order)

1. **Shell**: sidebar groups + items, header, sync banner texts, command palette, Tour.
2. **Common**: buttons (Save, Cancel, Delete, Edit, Add, Search), toasts, confirm
   dialogs, status chips (Draft/Posted/Void/Paid/Unpaid…), date/calendar labels
   (month names already Nepali in BS mode), empty-state text.
3. **Pages**: Vouchers, VoucherForm, Journal, Transfers, Members (incl. the new
   application form), Parties, Accounts, Settings, Dashboard.
4. **Reports**: titles + column headers (numbers/codes stay as-is).
5. **Print outputs**: voucher/receipt print headers already Nepali-branded; extend to
   fully Nepali when `ne`.

### B3. Rules

- **Inputs, codes, names, amounts, emails, phone numbers: never translated.**
  Only UI chrome (labels, menus, messages).
- Status **values** in the DB stay English (`draft`, `posted`…); only labels translate.
- `t()` falls back to the English string when a `ne` key is missing — so translation can
  land incrementally page-by-page without breaking anything.

---

## Milestones

| # | Deliverable | Est. |
|---|---|---|
| M1 | Members schema extension (`application` group, districts, blood group) + server validation | ½ day |
| M2 | Application-form UI (paper-layout, sections, photo, BS dates, save/edit) | 1 day |
| M3 | Print view matching the paper form (A4 replica, blank-form option) | ½ day |
| M4 | i18n layer + language toggle + `en`/`ne` dictionaries for shell & common | 1 day |
| M5 | Page-by-page Nepali translation (shell → vouchers → masters → reports) | 1–2 days |
| M6 | E2E: application-form spec (fill → save → pay fee → print) + `ne`-mode smoke spec | ½ day |

Total ≈ 4–5 working days. M1–M3 and M4–M5 can run in parallel.
