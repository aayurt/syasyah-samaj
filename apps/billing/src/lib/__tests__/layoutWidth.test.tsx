import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import SetupWizard from '../../pages/SetupWizard'
import { renderWithProviders } from '../../test/testUtils'

describe('page-level content containers', () => {
  it('renders the SetupWizard loading container full-width without a width cap', () => {
    // Provide a tenant so SetupWizard passes the tenant-selection gate and
    // reaches the loading/syncing container (syncing === true on first render).
    renderWithProviders(<SetupWizard />, { tenantId: 'C00' })

    const loading = screen.getByText(/Syncing & loading setup facts…/)
    const container = loading.closest('div')
    expect(container).not.toBeNull()

    const classes = (container as HTMLElement).className

    // Full-width: fills the viewport, not capped at a fixed max-w.
    expect(classes).toContain('w-full')
    // No hard width cap on the page-level outer container.
    expect(classes).not.toMatch(/max-w-/)
  })
})
