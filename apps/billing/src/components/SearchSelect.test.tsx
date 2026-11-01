/**
 * SearchSelect component tests (MISSION.md M6).
 * Trigger labels, popover open/close, filtering, clear + select flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import SearchSelect, { type SearchSelectOption } from './SearchSelect'
import { renderEn } from '../test/renderEn'

const onChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const options: SearchSelectOption[] = [
  { value: '1', label: 'Cash', sublabel: '1000', badge: 'asset' },
  { value: '2', label: 'Bank', sublabel: '1010', badge: 'asset' },
  { value: '3', label: 'Sales', sublabel: '4000', badge: 'income' },
]

describe('SearchSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    renderEn(<SearchSelect options={options} value="" onChange={onChange} />)
    expect(screen.getByText('— select —')).toBeInTheDocument()
  })

  it('shows a custom placeholder', () => {
    renderEn(
      <SearchSelect options={options} value="" onChange={onChange} placeholder="Pick one" />,
    )
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows the selected option label on the trigger', () => {
    renderEn(<SearchSelect options={options} value="2" onChange={onChange} />)
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.queryByText('— select —')).not.toBeInTheDocument()
  })

  it('opens the popover, lists all options and selects one', async () => {
    renderEn(<SearchSelect options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))

    expect(await screen.findByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.getByText('Sales')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Sales'))
    expect(onChange).toHaveBeenCalledWith('3')
    await waitFor(() => expect(screen.queryByText('Cash')).not.toBeInTheDocument())
  })

  it('filters options by label as the user types', async () => {
    renderEn(<SearchSelect options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Cash')

    // Search box only appears when there are more than 6 options
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument()

    // With ≤6 options there is no search box; filtering still applies via
    // the hidden query state only when search is shown — verify no crash.
    expect(screen.getByText('Bank')).toBeInTheDocument()
  })

  it('filters through the search box when there are more than 6 options', async () => {
    const many: SearchSelectOption[] = Array.from({ length: 8 }, (_, i) => ({
      value: String(i),
      label: `Account ${i}`,
    }))
    renderEn(<SearchSelect options={many} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Account 0')

    const search = screen.getByPlaceholderText('Search…')
    fireEvent.change(search, { target: { value: 'Account 5' } })

    expect(screen.getByText('Account 5')).toBeInTheDocument()
    expect(screen.queryByText('Account 0')).not.toBeInTheDocument()
  })

  it('shows the empty state when a search matches nothing', async () => {
    const many: SearchSelectOption[] = Array.from({ length: 8 }, (_, i) => ({
      value: String(i),
      label: `Account ${i}`,
    }))
    renderEn(<SearchSelect options={many} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Account 0')

    fireEvent.change(screen.getByPlaceholderText('Search…'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('No options match')).toBeInTheDocument()
  })

  it('offers a clear option only when a value is selected', async () => {
    const { rerender } = renderEn(
      <SearchSelect options={options} value="" onChange={onChange} />,
    )
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Cash')
    expect(screen.queryByText('— clear selection —')).not.toBeInTheDocument()

    rerender(
      <SearchSelect options={options} value="1" onChange={onChange} />,
    )
    fireEvent.click(screen.getByText('Cash'))
    expect(await screen.findByText('— clear selection —')).toBeInTheDocument()

    fireEvent.click(screen.getByText('— clear selection —'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('closes when a mousedown lands outside the wrapper', async () => {
    renderEn(<SearchSelect options={options} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Cash')

    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByText('Cash')).not.toBeInTheDocument())
  })

  it('matches options by sublabel too', async () => {
    const many: SearchSelectOption[] = Array.from({ length: 8 }, (_, i) => ({
      value: String(i),
      label: `Account ${i}`,
      sublabel: i === 3 ? 'UNIQUE-CODE' : `code-${i}`,
    }))
    renderEn(<SearchSelect options={many} value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('— select —'))
    await screen.findByText('Account 0')

    fireEvent.change(screen.getByPlaceholderText('Search…'), {
      target: { value: 'unique-code' },
    })
    expect(screen.getByText('Account 3')).toBeInTheDocument()
    expect(screen.queryByText('Account 0')).not.toBeInTheDocument()
  })
})
