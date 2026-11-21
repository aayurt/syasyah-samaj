import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReportFilterBar from './ReportFilterBar'
import { ReportBreakdownBar, ReportTrendChart, ReportMetricGauge } from './ReportCharts'

// Mock FiscalYear context
vi.mock('../lib/fiscalYear', () => ({
  useFiscalYear: () => ({
    years: [
      { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
      { id: 2, label: '2082-83', startDate: '2025-07-16', endDate: '2026-07-15', isActive: false },
    ],
    selectedYear: { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
    activeYear: { id: 1, label: '2083-84', startDate: '2026-07-16', endDate: '2027-07-15', isActive: true },
    selectYear: vi.fn(),
    loading: false,
    refresh: vi.fn(),
  }),
}))

// Mock Calendar context
vi.mock('../lib/calendar', () => ({
  useCalendar: () => ({
    calendarType: 'BS',
    formatDate: (d: string) => d,
  }),
}))

// Mock i18n
vi.mock('../lib/i18n', () => ({
  useT: () => (key: string, def?: string) => def || key,
}))

describe('ReportFilterBar', () => {
  it('renders fiscal year selector, quick pills, and date inputs', () => {
    const handleFrom = vi.fn()
    const handleTo = vi.fn()

    render(
      <ReportFilterBar
        from="2026-07-16"
        to="2027-07-15"
        onFromChange={handleFrom}
        onToChange={handleTo}
      />
    )

    expect(screen.getByLabelText('Fiscal Year')).toBeDefined()
    expect(screen.getByText('Today')).toBeDefined()
    expect(screen.getByText('Yesterday')).toBeDefined()
    expect(screen.getByText('This Month')).toBeDefined()
    expect(screen.getByText('Last Month')).toBeDefined()
    expect(screen.getByText('Q1')).toBeDefined()
    expect(screen.getByText('Q4')).toBeDefined()
    expect(screen.getByText(/Full FY/)).toBeDefined()
    expect(screen.getByText('All Time')).toBeDefined()
  })

  it('selects quick pill and updates date range', () => {
    const handleFrom = vi.fn()
    const handleTo = vi.fn()

    render(
      <ReportFilterBar
        from=""
        to=""
        onFromChange={handleFrom}
        onToChange={handleTo}
      />
    )

    // Click "All Time"
    fireEvent.click(screen.getByText('All Time'))
    expect(handleFrom).toHaveBeenCalledWith('')
    expect(handleTo).toHaveBeenCalledWith('')

    // Click "Today"
    fireEvent.click(screen.getByText('Today'))
    expect(handleFrom).toHaveBeenCalled()
    expect(handleTo).toHaveBeenCalled()
  })
})

describe('ReportCharts', () => {
  it('renders ReportBreakdownBar with segments and proportions', () => {
    render(
      <ReportBreakdownBar
        title="Income vs Expenses"
        segments={[
          { label: 'Revenue', value: 10000, color: 'bg-emerald-500' },
          { label: 'Expenses', value: 4000, color: 'bg-rose-500' },
        ]}
      />
    )

    expect(screen.getByText('Income vs Expenses')).toBeDefined()
    expect(screen.getByText('Revenue')).toBeDefined()
    expect(screen.getByText('Expenses')).toBeDefined()
    expect(screen.getByText('71.4%')).toBeDefined()
    expect(screen.getByText('28.6%')).toBeDefined()
  })

  it('renders ReportTrendChart with bars', () => {
    render(
      <ReportTrendChart
        title="Sales Trend"
        items={[
          { label: 'Shr', primaryValue: 5000, secondaryValue: 1000, primaryLabel: 'Sales', secondaryLabel: 'Returns' },
          { label: 'Bha', primaryValue: 8000, secondaryValue: 500, primaryLabel: 'Sales', secondaryLabel: 'Returns' },
        ]}
      />
    )

    expect(screen.getByText('Sales Trend')).toBeDefined()
    expect(screen.getAllByText('Shr').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bha').length).toBeGreaterThanOrEqual(1)
  })

  it('renders ReportMetricGauge with percentage and value', () => {
    render(
      <ReportMetricGauge
        label="Gross Profit Margin"
        value={15000}
        percentage={65.5}
        statusColor="text-emerald-700"
      />
    )

    expect(screen.getByText('Gross Profit Margin')).toBeDefined()
    expect(screen.getByText('65.5%')).toBeDefined()
  })
})
