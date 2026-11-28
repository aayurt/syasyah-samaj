import { test, expect } from '@playwright/test'

test('inspect tax summary page', async ({ page }) => {
  // Navigate directly to tax summary page
  await page.goto('http://localhost:5173/app/reports/tax-summary')
  await page.waitForLoadState('networkidle')
  
  // Check for headings
  const headings = page.locator('h1, h2, h3')
  const headingCount = await headings.count()
  console.log('Headings count:', headingCount)
  for (let i = 0; i < headingCount; i++) {
    const text = await headings.nth(i).textContent()
    console.log('Heading', i, ':', text)
  }
  
  // Check for tax code
  const taxCode = page.getByText(/Tax Code/i)
  console.log('Tax code visible:', await taxCode.isVisible())
  
  // Check for buttons
  const buttons = page.locator('button')
  const buttonCount = await buttons.count()
  console.log('Button count:', buttonCount)
  for (let i = 0; i < buttonCount; i++) {
    const text = await buttons.nth(i).textContent()
    console.log('Button', i, ':', text)
  }
  
  // Check for data-testid attributes
  const testids = page.locator('[data-testid]')
  const testidCount = await testids.count()
  console.log('data-testid count:', testidCount)
  for (let i = 0; i < testidCount; i++) {
    const id = await testids.nth(i).getAttribute('data-testid')
    const text = await testids.nth(i).textContent()
    console.log('data-testid', i, ':', id, ' - ', text)
  }
})
