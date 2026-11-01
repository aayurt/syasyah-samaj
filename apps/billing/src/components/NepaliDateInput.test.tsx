/**
 * NepaliDateInput component tests (MISSION.md M6).
 * BS/AD dual-calendar entry: trigger label, mode toggle, calendar popup,
 * day pick, Today button, previews.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import NepaliDateInput from './NepaliDateInput'
import { renderEn } from '../test/renderEn'
import { adToBsString, todayAD, todayBS, BS_MONTHS } from '../lib/nepaliDate'
import { CalendarProvider } from '../lib/calendar'

vi.mock('../lib/api', () => ({
  api: vi.fn().mockResolvedValue({}),
  fmt: (n: number | undefined | null) => (n ?? 0).toFixed(2),
  getEngine: vi.fn(),
  useSyncState: vi.fn(),
}))

const onChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.removeItem('billing.calendar')
})

describe('NepaliDateInput (full variant, BS default)', () => {
  it('shows the "Select BS date" placeholder when empty', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    expect(screen.getByText('Select BS date')).toBeInTheDocument()
  })

  it('renders the BS date from the AD value with an AD preview', () => {
    const bs = adToBsString('2026-01-15')!
    const [y, m, d] = bs.split('-').map(Number)
    renderEn(<NepaliDateInput value="2026-01-15" onChange={onChange} />)
    expect(
      screen.getByText(`${d} ${BS_MONTHS[m - 1]} ${y}`),
    ).toBeInTheDocument()
    // Preview line under the trigger (no label given)
    expect(screen.getByText('AD: 2026-01-15')).toBeInTheDocument()
  })

  it('renders label with required marker and BS preview when a label is given', () => {
    renderEn(<NepaliDateInput value="2026-01-15" onChange={onChange} label="Date" required />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText(`(AD: 2026-01-15)`)).toBeInTheDocument()
  })

  it('opens the BS calendar and picks a day', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('Select BS date'))

    // Calendar popup with weekday headers + day grid
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByTitle('Previous month')).toBeInTheDocument()
    expect(screen.getByTitle('Next month')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '15' }))
    expect(onChange).toHaveBeenCalled()
    const [ad] = onChange.mock.calls[0]
    expect(ad).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Popup closed after the pick
    expect(screen.queryByText('Sun')).not.toBeInTheDocument()
  })

  it('navigates months via prev/next', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('Select BS date'))
    const header = () => screen.getByText(/\d{4}$/)

    const before = header().textContent
    fireEvent.click(screen.getByTitle('Next month'))
    expect(header().textContent).not.toBe(before)
    fireEvent.click(screen.getByTitle('Previous month'))
    expect(header().textContent).toBe(before)
  })

  it('closes the calendar on Escape', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('Select BS date'))
    expect(screen.getByText('Sun')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Sun')).not.toBeInTheDocument()
  })

  it('sets today via the Today button in BS mode', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Set to today'))
    expect(onChange).toHaveBeenCalledWith(todayAD())
  })

  it('toggles to AD mode and back', () => {
    renderEn(<NepaliDateInput value="2026-01-15" onChange={onChange} />)
    // Mode toggle shows the current mode
    fireEvent.click(screen.getByTitle('Currently entering BS date. Click to switch.'))
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput).not.toBeNull()
    expect(dateInput.value).toBe('2026-01-15')

    fireEvent.change(dateInput, { target: { value: '2026-02-20' } })
    expect(onChange).toHaveBeenCalledWith('2026-02-20')

    fireEvent.click(screen.getByTitle('Currently entering AD date. Click to switch.'))
    expect(document.querySelector('input[type="date"]')).toBeNull()
    // Controlled: value prop is unchanged (2026-01-15) — BS mode previews the AD date
    expect(screen.getByText('AD: 2026-01-15')).toBeInTheDocument()
  })

  it('emits today from AD mode too', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Currently entering BS date. Click to switch.'))
    fireEvent.click(screen.getByTitle('Set to today'))
    expect(onChange).toHaveBeenCalledWith(todayAD())
  })
})

describe('NepaliDateInput (compact variant)', () => {
  it('shows the BS trigger without label/preview lines', () => {
    const { container } = renderEn(<NepaliDateInput value="2026-01-15" onChange={onChange} compact />)
    const bs = adToBsString('2026-01-15')!
    const [y, m, d] = bs.split('-').map(Number)
    expect(screen.getByText(`${d} ${BS_MONTHS[m - 1]} ${y}`)).toBeInTheDocument()
    expect(screen.queryByText(/AD:/)).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('Date')
  })

  it('shows the "Select date" placeholder when empty', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} compact />)
    expect(screen.getByText('Select date')).toBeInTheDocument()
  })

  it('toggles AD/BS with the short-mode button', () => {
    renderEn(<NepaliDateInput value="2026-01-15" onChange={onChange} compact />)
    fireEvent.click(screen.getByTitle('Currently entering BS. Click to switch.'))
    expect(document.querySelector('input[type="date"]')).not.toBeNull()
    fireEvent.click(screen.getByTitle('Currently entering AD. Click to switch.'))
    expect(document.querySelector('input[type="date"]')).toBeNull()
  })

  it('picks a day from the compact calendar popup', () => {
    renderEn(<NepaliDateInput value="" onChange={onChange} compact />)
    fireEvent.click(screen.getByText('Select date'))
    expect(screen.getByText('Sun')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('NepaliDateInput (AD global calendar setting)', () => {
  it('starts in AD mode when calendarType is AD', () => {
    window.localStorage.setItem(
      'billing.calendar',
      JSON.stringify({ calendarType: 'AD', dateFormat: 'YYYY-MM-DD', timeFormat: '12h' }),
    )
    renderEn(
      <CalendarProvider>
        <NepaliDateInput value="" onChange={onChange} />
      </CalendarProvider>,
    )
    expect(document.querySelector('input[type="date"]')).not.toBeNull()
    // todayBS is still available for the BS conversion preview
    expect(todayBS()).toBeTruthy()
  })
})
