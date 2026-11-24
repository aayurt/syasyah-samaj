import { test, expect } from '@playwright/test'

/**
 * End-to-End Playwright Tests for Multi-Role Setup Wizard Behaviors:
 * 1. Super-Admin: Full access (create/manage parent companies, toggle children, CRUD sub-companies)
 * 2. Admin: Central switcher enabled, but children company management is view-only (no toggle, no add/delete)
 * 3. Illaka Accountant: Branch-scoped, locked to their branch (no central switcher, no children section)
 * 4. Viewer / Demo User: Read-only banner, disabled inputs, disabled seeding, disabled period creation, view-only row actions
 */

test.describe.serial('Role-Based Setup Wizard Access Controls', () => {
  test.use({
    ignoreHTTPSErrors: true,
  })

  let parentTenantId = ''
  let childTenantId = ''

  test.beforeAll(async ({ browser }) => {
    // Perform authentication and prepare test parent & child companies via API
    const page = await browser.newPage()
    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)

    await page.evaluate(async () => {
      try {
        await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: 'aayurtshrestha@gmail.com',
            password: 'SyashaAdmin2026!',
          }),
        })
      } catch {}
    })

    // Create or find test parent and child tenants
    const tenantInfo = await page.evaluate(async () => {
      const res = await fetch('/api/tenants?limit=100', { credentials: 'include' }).then((r) => r.json())
      let parent = (res?.docs || []).find((t: any) => t.code === 'ROLE-P')
      if (!parent) {
        const createRes = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: 'Role Test Parent Co',
            code: 'ROLE-P',
            type: 'central',
            active: true,
            pan: '998877665',
            slug: 'role-test-parent-co',
          }),
        }).then((r) => r.json())
        parent = createRes?.doc || createRes
      }

      let child = (res?.docs || []).find((t: any) => t.code === 'ROLE-C')
      if (!child && parent?.id) {
        const createChildRes = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: 'Role Test Child Branch',
            code: 'ROLE-C',
            type: 'illaka',
            parent: parent.id,
            active: true,
            pan: '998877664',
            slug: 'role-test-child-branch',
          }),
        }).then((r) => r.json())
        child = createChildRes?.doc || createChildRes
      }

      return { parentId: String(parent?.id || ''), childId: String(child?.id || '') }
    })

    parentTenantId = tenantInfo.parentId
    childTenantId = tenantInfo.childId
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    // Clean up created test tenants
    const page = await browser.newPage()
    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    await page.goto(baseURL.includes('/app') ? '/app/setup' : '/setup')
    await page.evaluate(async ({ pId, cId }) => {
      try {
        if (cId) await fetch(`/api/tenants/${cId}`, { method: 'DELETE', credentials: 'include' })
        if (pId) await fetch(`/api/tenants/${pId}`, { method: 'DELETE', credentials: 'include' })
      } catch {}
    }, { pId: parentTenantId, cId: childTenantId })
    await page.close()
  })

  test('Super-Admin: has full controls, can add companies, toggle children, and CRUD sub-companies', async ({ page }) => {
    await page.addInitScript(({ pId }) => {
      window.localStorage.setItem('__e2e_bypass__', '1')
      window.localStorage.setItem('__e2e_role__', 'super-admin')
      window.localStorage.setItem('ui-lang', 'en')
      window.localStorage.setItem('tour-seen', '1')
      window.localStorage.setItem('setup-modal-dismissed', '1')
      if (pId) window.localStorage.setItem('billing.tenant', pId)
    }, { pId: parentTenantId })

    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Syncing & loading setup facts…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

    // View-Only banner should NOT be present
    await expect(page.getByText('You are viewing the Setup Wizard in View-Only')).not.toBeVisible()

    // Step 0: Company Profile - Children Companies section is visible for central parent
    await expect(page.getByText('Children Companies').first()).toBeVisible({ timeout: 15000 })

    // Super-Admin can see Add Child Company button
    const addChildBtn = page.getByRole('button', { name: /Add Child Company/i })
    await expect(addChildBtn).toBeVisible()

    // Super-Admin can see Switch / All Companies button
    const switchBtn = page.getByRole('button', { name: /Switch \/ All Companies/i })
    await expect(switchBtn).toBeVisible()

    // Super-Admin does not see restriction banner
    await expect(
      page.getByText('Only Super-Admins have permission to toggle child branches'),
    ).not.toBeVisible()

    // Primary action button is enabled and says Save & continue
    const saveBtn = page.getByRole('button', { name: /Save & continue/i })
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
  })

  test('Admin: company profile is editable, children management locked, switch company is super-admin only', async ({ page }) => {
    await page.addInitScript(({ pId }) => {
      window.localStorage.setItem('__e2e_bypass__', '1')
      window.localStorage.setItem('__e2e_role__', 'admin')
      window.localStorage.setItem('ui-lang', 'en')
      window.localStorage.setItem('tour-seen', '1')
      window.localStorage.setItem('setup-modal-dismissed', '1')
      if (pId) window.localStorage.setItem('billing.tenant', pId)
    }, { pId: parentTenantId })

    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Syncing & loading setup facts…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

    // 1. Company Profile is admin level: inputs are ENABLED for admin
    const orgInput = page.getByPlaceholder(/e.g. Syasyah Sahakari/i)
    await expect(orgInput).toBeVisible({ timeout: 15000 })
    await expect(orgInput).toBeEnabled()

    // Save & continue button is ENABLED for admin
    const saveBtn = page.getByRole('button', { name: /Save & continue/i })
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()

    // 2. Switch company is super-admin ONLY: "Switch / All Companies" button is NOT visible for admin
    await expect(page.getByRole('button', { name: /Switch \/ All Companies/i })).not.toBeVisible()

    // 3. Children company section shows permission warning for admin
    await expect(
      page.getByText('Only Super-Admins have permission to toggle child branches and manage subsidiary structure.'),
    ).toBeVisible()

    // Add Child Company button is HIDDEN for admin
    await expect(page.getByRole('button', { name: /Add Child Company/i })).not.toBeVisible()

    // Toggle checkbox is disabled
    const toggleInput = page.locator('input[type="checkbox"]').first()
    await expect(toggleInput).toBeDisabled()
  })

  test('Illaka Accountant: branch-scoped without central switcher or children controls', async ({ page }) => {
    await page.addInitScript(({ cId }) => {
      window.localStorage.setItem('__e2e_bypass__', '1')
      window.localStorage.setItem('__e2e_role__', 'illaka-accountant')
      window.localStorage.setItem('__e2e_tenant_id__', cId)
      window.localStorage.setItem('__e2e_illaka_code__', 'ROLE-C')
      window.localStorage.setItem('billing.tenant', cId)
      window.localStorage.setItem('ui-lang', 'en')
      window.localStorage.setItem('tour-seen', '1')
      window.localStorage.setItem('setup-modal-dismissed', '1')
    }, { cId: childTenantId })

    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Syncing & loading setup facts…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

    // Illaka Accountant should NOT see "Switch / All Companies" button
    await expect(page.getByRole('button', { name: /Switch \/ All Companies/i })).not.toBeVisible()

    // Illaka Accountant operates on their branch: Children Companies parent management is not shown
    await expect(page.getByText('Only Super-Admins have permission to toggle child branches')).not.toBeVisible()

    // Branch context indicator should be visible
    await expect(page.getByText('Sub-Company').first()).toBeVisible({ timeout: 15000 })
  })

  test('Viewer: view-only demo banner, disabled inputs, and disabled seeding', async ({ page }) => {
    await page.addInitScript(({ pId }) => {
      window.localStorage.setItem('__e2e_bypass__', '1')
      window.localStorage.setItem('__e2e_role__', 'viewer')
      window.localStorage.setItem('ui-lang', 'en')
      window.localStorage.setItem('tour-seen', '1')
      window.localStorage.setItem('setup-modal-dismissed', '1')
      if (pId) window.localStorage.setItem('billing.tenant', pId)
    }, { pId: parentTenantId })

    const baseURL = (page.context()._options.baseURL as string) || process.env.E2E_WEB_URL || ''
    const setupUrl = baseURL.includes('/app') ? '/app/setup' : '/setup'
    await page.goto(setupUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.getByText('Syncing & loading setup facts…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

    // 1. Prominent View-Only Demo Banner is visible
    await expect(
      page.getByText('You are viewing the Setup Wizard in View-Only (Demo) mode. Modifications and seeding are disabled.'),
    ).toBeVisible({ timeout: 15000 })

    // 2. Company profile inputs are disabled
    const orgInput = page.getByPlaceholder(/e.g. Syasyah Sahakari/i)
    await expect(orgInput).toBeVisible()
    await expect(orgInput).toBeDisabled()

    // 3. AI Import Profile button is hidden
    await expect(page.getByRole('button', { name: /Import Profile/i })).not.toBeVisible()

    // 4. Primary button is "Next Step (View Only)" instead of "Save & continue"
    const nextBtn = page.getByRole('button', { name: /Next Step \(View Only\)/i })
    await expect(nextBtn).toBeVisible()
    await expect(page.getByRole('button', { name: /Save & continue/i })).not.toBeVisible()

    // 5. Navigate to Step 1 (Fiscal Year)
    await nextBtn.click()
    await page.waitForTimeout(500)

    // Step 1: Add Year button is disabled
    const addYearBtn = page.getByRole('button', { name: /Add Year/i })
    await expect(addYearBtn).toBeVisible()
    await expect(addYearBtn).toBeDisabled()

    // 6. Navigate to Step 2 (Account Types & Groups)
    const nextRailStep = page.getByRole('button', { name: /Next Step|Skip \/ Next/i })
    if (await nextRailStep.isVisible()) {
      await nextRailStep.click()
    } else {
      await page.getByText('Account Types & Groups').first().click()
    }
    await page.waitForTimeout(500)

    // AI Import for seed tables is hidden for viewer
    await expect(page.getByRole('button', { name: /Import.*with AI/i })).not.toBeVisible()

    // Bulk selection checkbox is not visible in table header
    await expect(page.locator('thead input[type="checkbox"]')).not.toBeVisible()
  })
})
