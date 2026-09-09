import { expect, test } from '@playwright/test'

/**
 * S10 — Membership application form journey + Nepali mode smoke.
 *
 * Covers:
 *  - E6: Application form: fill → save → verify in table → edit → verify
 *  - M6: Nepali mode: toggle language, assert sidebar nav labels + form title
 *
 * Depends on 03-masters (has auth + seeded DB). Runs in serial mode.
 */
test.describe.serial('S10 — Membership application form', () => {
  /** Unique email to avoid collisions across runs. */
  const EMAIL = `e2e-member-${Date.now()}@test.com`
  const FULL_NAME = 'E2E Test Member'
  const UPDATED_OCCUPATION = 'Software Engineer'

  /** Navigate to Members page and dismiss tour. */
  async function goToMembers(page: import('@playwright/test').Page) {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
    await page.goto('/members')
    await page.waitForLoadState('networkidle')
  }

  /** Switch to the Application Form view via the segmented control. */
  async function switchToApplicationForm(page: import('@playwright/test').Page) {
    const appFormBtn = page.getByRole('button', { name: 'Application Form' })
    await expect(appFormBtn).toBeVisible({ timeout: 15_000 })
    await appFormBtn.click()
    // Wait for the application form to render
    await expect(page.locator('form')).toBeVisible({ timeout: 10_000 })
  }

  /** Switch to the Table view via the segmented control. */
  async function switchToTable(page: import('@playwright/test').Page) {
    const tableBtn = page.getByRole('button', { name: 'Table' })
    await tableBtn.click()
  }

  /** Fill the application form with test data. */
  async function fillApplicationForm(page: import('@playwright/test').Page) {
    // Section A: Identity
    const fullNameInput = page.locator('input[placeholder*="Ram Bahadur"]')
    await fullNameInput.fill(FULL_NAME)

    const citizenshipNoInput = page.locator('input[placeholder*="12-34-56"]')
    await citizenshipNoInput.fill('12-34-56-78901')

    const citizenshipDateInput = page.locator('input[placeholder*="2080-01"]')
    await citizenshipDateInput.fill('2080-01-15')

    // Citizenship District — select from dropdown
    const districtSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Kathmandu' }) }).first()
    if (await districtSelect.count()) {
      await districtSelect.selectOption({ label: 'Kathmandu' })
    }

    // Section B: Address & Contact
    await page.locator('textarea').nth(0).fill('Ward 12, Kathmandu Metropolitan')
    await page.locator('textarea').nth(1).fill('Lalitpur, Nepal')

    const emailInput = page.locator('input[placeholder*="ram@example"]')
    await emailInput.fill(EMAIL)

    const phoneInput = page.locator('input[placeholder*="01-XXXXXXX"]')
    await phoneInput.fill('01-4567890')

    const mobileInput = page.locator('input[placeholder*="98XXXXXXXX"]')
    await mobileInput.fill('9841234567')

    // Section C: Personal
    // Blood Group
    const bloodSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'B+' }) }).first()
    if (await bloodSelect.count()) {
      await bloodSelect.selectOption('B+')
    }

    const qualInput = page.locator('input[placeholder*="MBA"]')
    await qualInput.fill('BSc Computer Science')

    const occupationInput = page.locator('input[placeholder*="Engineer"]')
    await occupationInput.fill('Developer')

    const officeInput = page.locator('input[placeholder*="Nepal Telecom"]')
    await officeInput.fill('Tech Corp Nepal')

    // Section D: Family
    const familyFields = [
      { placeholder: /^$/, index: 0 }, // grandfather — no placeholder, just label
      { placeholder: /^$/, index: 1 }, // father
      { placeholder: /^$/, index: 2 }, // father-in-law
      { placeholder: /^$/, index: 3 }, // spouse
      { placeholder: /^$/, index: 4 }, // son
      { placeholder: /^$/, index: 5 }, // daughter
    ]
    // Family text inputs are the ones without placeholders in the form.
    // They are inside the Family section, after the Personal section.
    // Use labels to find them.
    const familyLabels = [
      "Grandfather's Name",
      "Father's Name",
      "Father-in-law's Name",
      "Spouse's Name",
      "Son's Name",
      "Daughter's Name",
    ]
    for (let i = 0; i < familyLabels.length; i++) {
      const label = page.getByText(familyLabels[i], { exact: false }).first()
      if (await label.count()) {
        const container = label.locator('xpath=..')
        const input = container.locator('input[type="text"]')
        if (await input.count()) {
          await input.fill(`Family Member ${i}`)
        }
      }
    }

    // Section E: Membership & Fee
    const appliedDateInput = page.locator('input[placeholder*="2082-05"]')
    await appliedDateInput.fill('2082-05-15')
  }

  // ─────────────────────────────────────────────────────────────
  // Test 1: Fill, save, verify in table
  // ─────────────────────────────────────────────────────────────
  test('E6 — Application form: fill, save, verify in table', async ({ page }) => {
    await goToMembers(page)
    await switchToApplicationForm(page)

    // Fill all fields
    await fillApplicationForm(page)

    // Save the application
    const saveBtn = page.getByRole('button', { name: 'Save Application' })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Wait for success toast
    await expect(page.getByText('Member created')).toBeVisible({ timeout: 15_000 })

    // Switch to Table view
    await switchToTable(page)

    // Verify the new member appears in the table
    await expect(page.getByText(FULL_NAME).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(EMAIL).first()).toBeVisible({ timeout: 10_000 })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 2: Edit existing member via the Application Form picker
  // ─────────────────────────────────────────────────────────────
  test('E6 — Application form: edit existing member', async ({ page }) => {
    await goToMembers(page)
    await switchToApplicationForm(page)

    // Use the edit-existing picker to search for the member we just created
    const searchInput = page.getByPlaceholder('Search by name or email to edit')
    await searchInput.fill(FULL_NAME)
    await page.waitForTimeout(500)

    // Click the member in the dropdown
    const memberOption = page.locator('button', { hasText: FULL_NAME }).first()
    await expect(memberOption).toBeVisible({ timeout: 10_000 })
    await memberOption.click()

    // The form should now say "Editing existing member"
    await expect(page.getByText('Editing existing member')).toBeVisible()

    // Change the occupation
    const occupationInput = page.locator('input[placeholder*="Engineer"]')
    await occupationInput.fill(UPDATED_OCCUPATION)

    // Save the update
    const updateBtn = page.getByRole('button', { name: 'Update Member' })
    await expect(updateBtn).toBeVisible()
    await updateBtn.click()

    // Wait for success toast
    await expect(page.getByText('Member updated')).toBeVisible({ timeout: 15_000 })

    // Switch to Table view and verify the change persisted
    await switchToTable(page)
    // The table shows the member name — we can verify the row exists
    await expect(page.getByText(FULL_NAME).first()).toBeVisible({ timeout: 10_000 })

    // Switch back to Application Form and verify the occupation is updated
    await switchToApplicationForm(page)
    const searchInput2 = page.getByPlaceholder('Search by name or email to edit')
    await searchInput2.fill(FULL_NAME)
    await page.waitForTimeout(500)
    const memberOption2 = page.locator('button', { hasText: FULL_NAME }).first()
    await expect(memberOption2).toBeVisible({ timeout: 10_000 })
    await memberOption2.click()

    const occupationField = page.locator('input[placeholder*="Engineer"]')
    await expect(occupationField).toHaveValue(UPDATED_OCCUPATION, { timeout: 10_000 })
  })

  // ─────────────────────────────────────────────────────────────
  // Test 3: Nepali mode smoke — toggle language, verify labels
  // ─────────────────────────────────────────────────────────────
  test('M6 — Nepali mode: toggle language and verify labels', async ({ page }) => {
    // Go to Settings and toggle to Nepali
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('tour-seen', '1'))
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // The language section should be visible; expand it if needed
    const langSection = page.getByText('Language', { exact: false }).first()
    if (await langSection.count()) {
      // Click the section header to expand
      const sectionBtn = page.locator('button', { hasText: 'Language' }).first()
      if (await sectionBtn.count()) {
        await sectionBtn.click()
      }
    }

    // Click the Nepali button
    const nepaliBtn = page.locator('button', { hasText: 'नेपाली' }).first()
    await expect(nepaliBtn).toBeVisible({ timeout: 10_000 })
    await nepaliBtn.click()

    // Verify sidebar nav labels are in Nepali
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check that key nav items are now in Nepali
    // Members → सदस्यहरू
    await expect(page.getByText('सदस्यहरू')).toBeVisible({ timeout: 10_000 })
    // Dashboard → डैशबोर्ड
    await expect(page.getByText('डैशबोर्ड').first()).toBeVisible({ timeout: 10_000 })
    // Settings → सेटिङहरू
    await expect(page.getByText('सेटिङहरू').first()).toBeVisible({ timeout: 10_000 })

    // Navigate to Members and verify the Application Form section title is in Nepali
    const membersLink = page.getByText('सदस्यहरू').first()
    await membersLink.click()
    await page.waitForLoadState('networkidle')

    // Switch to Application Form view (label is localized: आवेदन फाराम in
    // Nepali mode, Application Form in English — match either real label).
    const appFormBtn = page.getByRole('button', { name: /आवेदन फाराम|Application Form/ })
    await expect(appFormBtn).toBeVisible({ timeout: 10_000 })
    await appFormBtn.click()

    // The form title contains Nepali text (साधारण/स्थायी/आजीवन दुज़)
    await expect(page.getByText('साधारण/स्थायी/आजीवन दुज़')).toBeVisible({ timeout: 10_000 })

    // Toggle back to English
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    const langSection2 = page.getByText('Language', { exact: false }).first()
    if (await langSection2.count()) {
      const sectionBtn2 = page.locator('button', { hasText: 'Language' }).first()
      if (await sectionBtn2.count()) {
        await sectionBtn2.click()
      }
    }
    const englishBtn = page.locator('button', { hasText: 'English' }).first()
    await expect(englishBtn).toBeVisible({ timeout: 10_000 })
    await englishBtn.click()

    // Verify sidebar nav labels revert to English
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Members → Members
    await expect(page.getByRole('link', { name: 'Members' })).toBeVisible({ timeout: 10_000 })
    // Dashboard → Dashboard
    await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  })
})
