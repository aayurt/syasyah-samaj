# Contributing to syasyah-samaj

Thank you for contributing! This guide helps you make effective contributions.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Follow the [architecture decisions](docs/adr/) — they exist for good reasons

## How to Contribute

### 1. Find or Create an Issue
- Check existing issues first
- Create new issue with:
  - Clear title
  - Steps to reproduce (for bugs)
  - Expected vs actual behavior
  - Screenshots if UI-related

### 2. Fork & Branch
```bash
git fork https://github.com/aayurt/syasyah-samaj
git clone https://github.com/YOUR-USERNAME/syasyah-samaj.git
cd syasyah-samaj
git checkout -b feat/your-feature-name
```

### 3. Development Setup
Follow [DEVELOPMENT.md](docs/DEVELOPMENT.md) for local setup.

### 4. Write Tests First (TDD)
- Unit tests for new utilities (`src/lib/__tests__/`)
- Component tests for new UI (`src/components/__tests__/`)
- Integration tests for new pages (`src/pages/__tests__/`)
- E2E tests for critical flows (`apps/billing/e2e/specs/`)

### 5. Follow Conventions
See [CONVENTIONS.md](docs/CONVENTIONS.md) for:
- TypeScript/React patterns
- Naming conventions
- i18n requirements
- Error handling

### 6. Validate with Kritikka-MCP
```bash
# Before committing, validate your changes
npx kritikka-mcp validate-change --changed-files "apps/billing/src/pages/YourPage.tsx"
```

### 7. Commit with Convention
```bash
git commit -m "feat(vouchers): add recurring voucher template

- Add RecurringVoucherTemplate collection
- Add scheduler for auto-generation
- Update import/export for templates

Refs: #123"
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`

### 8. Push & Open PR
```bash
git push origin feat/your-feature-name
```
Open PR against `main` branch.

## Pull Request Checklist

- [ ] Tests pass locally (`pnpm test`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Build passes (`pnpm build`)
- [ ] E2E passes if UI changes (`pnpm test:e2e`)
- [ ] Kritikka-MCP validation passes
- [ ] Documentation updated (ARCHITECTURE.md, ADRs if needed)
- [ ] i18n keys added for both EN and NE
- [ ] No console.log / debugger left in code
- [ ] PR description explains what and why

## Review Process

1. **Automated checks** (CI): lint, typecheck, test, build, e2e, kritikka-mcp
2. **Human review**: At least 1 approval required
3. **Merge**: Squash and merge to `main`

## Governance Rules (Enforced by Kritikka-MCP)

| Rule | What It Means |
|------|---------------|
| `forbidden` | Don't touch build output, secrets, generated files |
| `requireAdr` | Collection/offline/accounting changes need ADR reference |
| `requireTest` | Every source file needs tests |
| `requireDocUpdate` | Core changes need doc updates |
| `layerDependency` | UI → lib → foundation only (no reverse) |

## Adding Dependencies

### Runtime Dependencies
```bash
cd apps/billing
pnpm add package-name
```
- Must be in `dependencies` (not devDependencies)
- Prefer well-maintained, popular packages
- Check bundle size impact

### Dev Dependencies
```bash
pnpm add -D package-name
```
- For build, test, lint tools only

## Translation Workflow

All user-facing strings must be in translation files:

```bash
# 1. Add keys to English
# apps/billing/src/lib/i18n/en.json (or appropriate namespace)

# 2. Auto-translate to Nepali
pnpm translate

# 3. Verify NE translation (manual review)
# apps/billing/src/lib/i18n/ne.json
```

## Reporting Security Issues

**Do not open public issues** for security vulnerabilities.

Email: security@syasyah.org (or create private security advisory on GitHub)

## Questions?

- Check [DEVELOPMENT.md](docs/DEVELOPMENT.md) for common tasks
- Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system understanding
- Open a Discussion on GitHub for design questions