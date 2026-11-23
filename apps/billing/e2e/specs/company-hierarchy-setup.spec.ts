import { test, expect } from '@playwright/test'

/**
 * End-to-End Playwright Test:
 * - Multi-Company CRUD (Parent companies)
 * - Multi-Subcompany CRUD (Branches / Illakas under parent company)
 * - Sub-company Selection
 * - Setup Wizard generic flow:
 *     Step 1: Company Profile (Sub-company context & inheritance)
 *     Step 2: Fiscal Year (Inherited from parent)
 *     Step 3: Account Types & Groups (Seeding)
 *     Step 4: Chart of Accounts (Seeding)
 *     Step 5: Tax Types (Seeding)
 * - Books Ready completion verification
 */

test.describe.serial('Multi-Tenant Company Hierarchy & Setup Wizard Flow', () => {
  test.use({
    ignoreHTTPSErrors: true,
  })

  test.beforeEach(async ({ page }) => {
    // Enable bypass for seamless admin session in billing SPA and disable tour/modals
    await page.addInitScript(() => {
      window.localStorage.setItem('__e2e_bypass__', '1')
      window.localStorage.setItem('ui-lang', 'en')
      window.localStorage.setItem('tour-seen', '1')
      window.localStorage.setItem('setup-modal-dismissed', '1')
    })
  })

  test('Complete Multi-Company CRUD, Sub-Company CRUD, and Sub-Company Setup Wizard', async ({ page }) => {
    // Handle dialog confirmations for delete operations
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Navigate to Setup Wizard
    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')

    // Ensure super-admin session in browser cookie jar
    const authSuccess = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: 'aayurtshrestha@gmail.com',
            password: 'SyashaAdmin2026!',
          }),
        })
        return r.ok
      } catch {
        return false
      }
    })
    expect(authSuccess).toBeTruthy()

    // Clean up any leftover test companies from previous runs for idempotent repeatability
    await page.evaluate(async () => {
      try {
        const res = await fetch('/api/tenants?limit=100', { credentials: 'include' }).then((r) => r.json())
        const testTenants = (res?.docs || []).filter((t: any) =>
          t.name?.includes('ABC') ||
          t.name?.includes('DEF') ||
          ['ABC', 'ABC-01', 'ABC-02', 'DEF'].some(
            (code) => t.code === code || t.code?.startsWith('ABC') || t.code?.startsWith('DEF'),
          ),
        )
        for (const t of testTenants) {
          const delRes = await fetch(`/api/tenants/${t.id}`, { method: 'DELETE', credentials: 'include' })
          if (!delRes.ok) {
            await fetch(`/api/tenants/${t.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ code: `OLD-${t.id}-${Date.now().toString().slice(-4)}` }),
            })
          }
        }
      } catch {}
    })

    // Reload with authenticated cookie
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the main page content to load and sync spinner to finish
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('Syncing & loading setup facts…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

    // ─────────────────────────────────────────────────────────────
    // Phase 1: Parent Company Creation (ABC Company)
    // ─────────────────────────────────────────────────────────────
    // Check whether the company creator form or the consolidated cards are visible
    const createBtn = page.getByRole('button', { name: /Create Company & Continue/i })
    const isFormReady = await createBtn
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false)

    if (!isFormReady) {
      const switchBtn = page.getByRole('button', { name: /Switch \/ All Companies/i })
      if (await switchBtn.isVisible().catch(() => false)) {
        await switchBtn.click()
      }
      const addParentBtn = page.getByRole('button', { name: /Add Parent Company/i })
      await expect(addParentBtn).toBeVisible({ timeout: 10000 })
      await addParentBtn.click()
    }

    // Fill Company 1 details
    await expect(page.getByText(/Create Your Organization \/ Parent Company|Add New Parent Company/i)).toBeVisible()
    const nameInput = page.getByPlaceholder(/e\.g\. ABC Company or Syasyah Samaj/i)
    await nameInput.fill('ABC Company')

    const codeInput = page.getByPlaceholder(/e\.g\. ABC or SYASYA/i)
    await codeInput.fill('ABC')

    const panInput = page.getByPlaceholder(/e\.g\. 601234567/i)
    await panInput.fill('123456789')

    await createBtn.click()

    // Verify creator form closes and redirected to Step 1 for ABC Company
    await expect(page.getByText(/Create Your Organization \/ Parent Company/i)).not.toBeVisible({ timeout: 15000 })
    await expect(page.locator('.text-sm.font-bold:has-text("ABC Company")')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Parent Company|Parent Organization/i).first()).toBeVisible()

    // ─────────────────────────────────────────────────────────────
    // Phase 2: Toggle Children Company & Sub-Company CRUD under ABC Company
    // ─────────────────────────────────────────────────────────────
    // Toggle Children Companies ON
    const toggleChildren = page.getByLabel(/Toggle Children Companies/i)
    await expect(toggleChildren).toBeVisible({ timeout: 10000 })
    await toggleChildren.click()

    // 1. Add Sub-Company 1 (ABC sub-company -1)
    const addSubBtn = page.getByRole('button', { name: /Add Child Company|Add Sub-Company/i }).first()
    await expect(addSubBtn).toBeVisible({ timeout: 10000 })
    await addSubBtn.click()

    const subModal = page.locator('div.max-w-md:has-text("sub-company")')
    await expect(subModal).toBeVisible({ timeout: 5000 })

    const subNameInput = subModal.locator('input').first()
    await expect(subNameInput).toBeVisible()
    await subNameInput.fill('ABC sub-company -1')

    const subCodeInput = subModal.getByPlaceholder(/ABC-01/i)
    await subCodeInput.fill('ABC-01')

    const saveSubBtn = subModal.getByRole('button', { name: /Add sub-company|Create/i })
    await saveSubBtn.click()

    await expect(page.locator('table tr:has-text("ABC sub-company -1")')).toBeVisible({ timeout: 10000 })

    // 2. Add Sub-Company 2 (ABC sub-company -2)
    await addSubBtn.click()
    await expect(subModal).toBeVisible({ timeout: 5000 })
    await subNameInput.fill('ABC sub-company -2')
    await subCodeInput.fill('ABC-02')
    await saveSubBtn.click()

    await expect(page.locator('table tr:has-text("ABC sub-company -2")')).toBeVisible({ timeout: 10000 })

    // 3. Edit Sub-Company 2
    const editSubBtn = page.locator('table tr:has-text("ABC sub-company -2") button:has-text("Edit")')
    await editSubBtn.click()
    await expect(subModal).toBeVisible({ timeout: 5000 })
    await subNameInput.fill('ABC sub-company -2 Edited')
    const updateSubBtn = subModal.getByRole('button', { name: /Update/i })
    await updateSubBtn.click()

    await expect(page.locator('table tr:has-text("ABC sub-company -2 Edited")')).toBeVisible({ timeout: 10000 })

    // 4. Delete Sub-Company 2 Edited
    const deleteSubBtn = page.locator('table tr:has-text("ABC sub-company -2 Edited") button:has(svg)').last()
    await deleteSubBtn.click()

    await expect(page.locator('table tr:has-text("ABC sub-company -2 Edited")')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('table tr:has-text("ABC sub-company -1")')).toBeVisible()

    // Test toggle OFF with existing children -> Confirmation warning
    await toggleChildren.click()
    await expect(page.getByText(/Collapse Child Companies\?/i)).toBeVisible({ timeout: 5000 })
    // Cancel the collapse to leave children active
    await page.getByRole('button', { name: /Cancel/i }).click()
    await expect(page.getByText(/Collapse Child Companies\?/i)).not.toBeVisible()

    // Test Post-Save Choice Flow modal when children exist:
    const saveCompanyStepBtn = page.getByRole('button', { name: /Save & continue/i })
    await saveCompanyStepBtn.click()
    await expect(page.getByRole('heading', { name: 'Company Profile Saved' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Continue Parent Company Setup/i)).toBeVisible()
    await expect(page.getByText(/OR ONBOARD A CHILD COMPANY/i)).toBeVisible()

    // Close choice dialog so we can proceed to Phase 3 (Multi-Company CRUD)
    await page.getByRole('button', { name: /Decide Later/i }).click()
    await expect(page.getByRole('heading', { name: 'Company Profile Saved' })).not.toBeVisible()

    // ─────────────────────────────────────────────────────────────
    // Phase 3: Multi-Company CRUD (DEF Company)
    // ─────────────────────────────────────────────────────────────
    // Switch to consolidated mode
    const switchAllBtn = page.getByRole('button', { name: /Switch \/ All Companies/i })
    await switchAllBtn.click()

    await expect(page.getByText(/Select Company to Onboard & Configure/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('h3:has-text("ABC Company")').first()).toBeVisible()

    // Add Company 2 (DEF Company)
    const addSecondParentBtn = page.getByRole('button', { name: /Add Parent Company/i })
    await addSecondParentBtn.click()

    await expect(page.getByText(/Add New Parent Company/i)).toBeVisible()
    await nameInput.fill('DEF Company')
    await codeInput.fill('DEF')
    await panInput.fill('987654321')
    await createBtn.click()

    await expect(page.locator('h3:has-text("DEF Company"), .font-bold:has-text("DEF Company")').first()).toBeVisible({ timeout: 15000 })

    // Switch back to consolidated view
    await switchAllBtn.click()
    await expect(page.getByText(/Select Company to Onboard & Configure/i)).toBeVisible()

    // Both companies should be listed
    await expect(page.locator('h3:has-text("ABC Company")').first()).toBeVisible()
    await expect(page.locator('h3:has-text("DEF Company")').first()).toBeVisible()

    // Edit DEF Company from consolidated view
    const editDefBtn = page.getByTitle('Edit DEF Company')
    await editDefBtn.click()
    await expect(page.getByText(/Edit Parent Company: DEF Company/i)).toBeVisible()
    await nameInput.fill('DEF Global Holdings')
    const updateCompanyBtn = page.getByRole('button', { name: /Update Company & Continue/i })
    await updateCompanyBtn.click()

    await expect(page.locator('h3:has-text("DEF Global Holdings")').first()).toBeVisible({ timeout: 10000 })

    // Delete DEF Global Holdings
    const deleteDefBtn = page.getByTitle('Delete DEF Global Holdings')
    await deleteDefBtn.click()

    await expect(page.locator('h3:has-text("DEF Global Holdings")')).not.toBeVisible({ timeout: 10000 })
    await expect(page.locator('h3:has-text("ABC Company")').first()).toBeVisible()

    // ─────────────────────────────────────────────────────────────
    // Phase 4: Select Sub-Company & Run Complete Setup Wizard
    // ─────────────────────────────────────────────────────────────
    // Click on the sub-company pill or button for "ABC sub-company -1"
    const subCompanyPill = page.getByRole('button', { name: /ABC sub-company -1/i }).first()
    await subCompanyPill.click()

    // Step 1: Sub-Company Profile
    await expect(page.getByText('Company Profile').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Operating branch under ABC Company/i)).toBeVisible()

    // Save and continue Step 1
    const saveCompanyStep = page.getByRole('button', { name: /Save & continue/i })
    await saveCompanyStep.click()

    // Step 2: Fiscal Year (Inherited from Parent ABC Company)
    await expect(page.getByText('Fiscal Year').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Fiscal Periods Inherited from Parent/i)).toBeVisible()

    // If no fiscal year exists, add one
    const addYearBtn = page.getByRole('button', { name: /Add Year/i })
    if (await addYearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await addYearBtn.isEnabled()) {
        await addYearBtn.click()
        await page.waitForTimeout(1000)
      }
    }

    // Advance to Step 3 (Account Types & Groups)
    const nextStepBtn = page.getByRole('button', { name: /Next Step|Next/i }).last()
    await expect(nextStepBtn).toBeVisible({ timeout: 10000 })
    await nextStepBtn.click()

    // Step 3: Account Types & Groups
    await expect(page.getByRole('heading', { level: 2, name: /Account Types & Groups/i })).toBeVisible({ timeout: 10000 })
    await page.getByText(/Loading account types/i).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    const seedGroupsBtn = page.getByRole('button', { name: /Seed types & groups/i }).first()
    if (await seedGroupsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await seedGroupsBtn.click()
      await expect(page.getByText(/Asset|Liability|Income|Expense/i).first()).toBeVisible({ timeout: 15000 })
    }

    // Advance to Step 4 (Chart of Accounts)
    const nextStep3 = page.getByRole('button', { name: /Next Step|Next/i }).last()
    await expect(nextStep3).toBeVisible()
    await nextStep3.click()

    // Step 4: Chart of Accounts
    await expect(page.getByRole('heading', { level: 2, name: /Chart of Accounts/i })).toBeVisible({ timeout: 10000 })
    await page.getByText(/Loading chart/i).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    const chartHasRows = await page.locator('table tr, [role="row"]').filter({ hasText: /Cash|Bank|Receivable|1010/i }).first().isVisible().catch(() => false)
    if (!chartHasRows) {
      const seedChartBtn = page.getByRole('button', { name: /Seed chart/i }).first()
      if (await seedChartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await seedChartBtn.click()
        await expect(page.locator('table tr, [role="row"]').filter({ hasText: /Cash|Bank|Receivable|1010/i }).first()).toBeVisible({ timeout: 20000 })
      }
    }

    // Advance to Step 5 (Tax Types)
    const nextStep4 = page.getByRole('button', { name: /Next Step|Next/i }).last()
    await expect(nextStep4).toBeVisible()
    await nextStep4.click()

    // Step 5: Tax Types
    await expect(page.getByRole('heading', { level: 2, name: /Tax Types/i })).toBeVisible({ timeout: 10000 })
    await page.getByText(/Loading tax types/i).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    const taxHasRows = await page.locator('table tr, [role="row"]').filter({ hasText: /VAT|Value Added Tax|13/i }).first().isVisible().catch(() => false)
    if (!taxHasRows) {
      const seedTaxBtn = page.getByRole('button', { name: /Seed tax types/i }).first()
      if (await seedTaxBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await seedTaxBtn.click()
        await expect(page.locator('table tr, [role="row"]').filter({ hasText: /VAT|Value Added Tax|13/i }).first()).toBeVisible({ timeout: 20000 })
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Phase 5: Verification of Setup Completion
    // ─────────────────────────────────────────────────────────────
    await expect(
      page.getByText(/Your books are ready — the required setup is complete\./i)
    ).toBeVisible({ timeout: 15000 })

    const finishBtn = page.getByRole('button', { name: /Finish|Start using Billing/i })
    await expect(finishBtn).toBeVisible()
    await expect(finishBtn).toBeEnabled()
    await finishBtn.click()

    // Verify redirected to main billing app dashboard
    await expect(page).toHaveURL(/\/app(\/)?$/, { timeout: 10000 })
  })
})
