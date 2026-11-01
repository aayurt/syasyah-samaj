/**
 * AccountSelect component tests (MISSION.md M6).
 * Trigger shows code·name, type-ahead filtering, clear, outside-click close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import AccountSelect from './AccountSelect'
import { renderEn } from '../test/renderEn'
import type { Account } from '../lib/types'

const onChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const accounts: Account[] = [
  { id: 1, code: '1000', name: 'Cash in Hand', type: 'asset' },
  { id: 2, code: '1010', name: 'Bank Account', type: 'asset' },
  { id: 3, code: '5000', name: 'Rent Expense', type: 'expense' },
]

describe('AccountSelect', () => {
  it('shows the default placeholder when nothing is selected', () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    expect(screen.getByText('— select account —')).toBeInTheDocument()
  })

  it('shows the selected account code and name on the trigger', () => {
    renderEn(<AccountSelect accounts={accounts} value="2" onChange={onChange} />)
    expect(screen.getByText('1010')).toBeInTheDocument()
    expect(screen.getByText('Bank Account')).toBeInTheDocument()
    expect(screen.queryByText('— select account —')).not.toBeInTheDocument()
  })

  it('opens with the full account list including type badges', async () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select account —'))

    expect(await screen.findByText('Cash in Hand')).toBeInTheDocument()
    expect(screen.getByText('Rent Expense')).toBeInTheDocument()
    // Two asset accounts → both badges present
    expect(screen.getAllByText('asset')).toHaveLength(2)
    expect(screen.getByText('expense')).toBeInTheDocument()
  })

  it('filters by name and by code', async () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select account —'))
    await screen.findByText('Cash in Hand')

    const search = screen.getByPlaceholderText('Search accounts…')
    fireEvent.change(search, { target: { value: 'rent' } })
    expect(screen.getByText('Rent Expense')).toBeInTheDocument()
    expect(screen.queryByText('Cash in Hand')).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: '1010' } })
    expect(screen.getByText('Bank Account')).toBeInTheDocument()
    expect(screen.queryByText('Rent Expense')).not.toBeInTheDocument()

    // Clearing the query restores all options
    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Cash in Hand')).toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', async () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select account —'))
    await screen.findByText('Cash in Hand')

    fireEvent.change(screen.getByPlaceholderText('Search accounts…'), {
      target: { value: 'zzzzz' },
    })
    expect(screen.getByText('No accounts match')).toBeInTheDocument()
  })

  it('selects an account and closes the popover', async () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select account —'))
    await screen.findByText('Cash in Hand')

    fireEvent.click(screen.getByText('Cash in Hand'))
    expect(onChange).toHaveBeenCalledWith('1')
    await waitFor(() =>
      expect(screen.queryByText('Rent Expense')).not.toBeInTheDocument(),
    )
  })

  it('clears the selection from the clear option', async () => {
    renderEn(<AccountSelect accounts={accounts} value="1" onChange={onChange} />)
    fireEvent.click(screen.getByText('Cash in Hand'))
    await screen.findByText('Rent Expense')

    fireEvent.click(screen.getByText('— clear selection —'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes on outside mousedown', async () => {
    renderEn(<AccountSelect accounts={accounts} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select account —'))
    await screen.findByText('Cash in Hand')

    fireEvent.mouseDown(document.body)
    await waitFor(() =>
      expect(screen.queryByText('Rent Expense')).not.toBeInTheDocument(),
    )
  })

  it('renders accounts without a code or type without crashing', async () => {
    renderEn(
      <AccountSelect
        accounts={[{ id: 9, name: 'Bare Account', type: 'asset' }]}
        value=""
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText('— select account —'))
    expect(await screen.findByText('Bare Account')).toBeInTheDocument()
  })
})
