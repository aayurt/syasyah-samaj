# Remaining AI Import todos — direct import from external LLM

## AI models missing from schemas.ts (parties/items/members wrongly use aiModel="gl-accounts")
- [ ] Add `parties` model to REQUIRED + AI_MODELS (name, type[customer/vendor/both], email, phone, active)
- [ ] Add `items` model to REQUIRED + AI_MODELS (code, name, unit, salePrice, active)
- [ ] Add `members` model to REQUIRED + AI_MODELS (fullName, email, role, status[active/inactive])
- [ ] Fix `seed-parties` aiModel: `"gl-accounts"` → `"parties"` (SetupWizard.tsx:1335)
- [ ] Fix `seed-items` aiModel: `"gl-accounts"` → `"items"` (SetupWizard.tsx:1358)
- [ ] Fix `seed-members` aiModel: `"gl-accounts"` → `"members"` (SetupWizard.tsx:1381)

## Validation
- [ ] Add `parties`/`items`/`members` cases to `validate.ts` `validateAgainstModel`
- [ ] Add test cases for new models in `__checks__.test.ts`

## Build + deploy
- [ ] Build exit 0
- [ ] vitest pass
- [ ] Commit + push + rsync + PM2 reload PersonalVPS
