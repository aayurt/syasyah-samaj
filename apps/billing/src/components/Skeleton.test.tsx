import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sk, TableSkeleton, ReportSkeleton } from './Skeleton'

describe('Sk', () => {
  it('renders a pulsing block with the custom class', () => {
    const { container } = render(<Sk className="h-5 w-10" />)
    const el = container.firstElementChild
    expect(el).toHaveClass('animate-pulse')
    expect(el).toHaveClass('h-5', 'w-10')
  })

  it('renders with no class by default', () => {
    const { container } = render(<Sk />)
    expect(container.firstElementChild).toHaveClass('animate-pulse')
  })
})

describe('TableSkeleton', () => {
  it('renders header row plus the requested number of body rows', () => {
    const { container } = render(<TableSkeleton rows={3} />)
    // 7 bars per row × (1 header + 3 body rows)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(28)
  })

  it('defaults to 6 body rows', () => {
    const { container } = render(<TableSkeleton />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(7 * 7)
  })
})

describe('ReportSkeleton', () => {
  it('renders banner plus the requested sections', () => {
    const { container } = render(<ReportSkeleton sections={2} />)
    // 1 banner bar + 2 sections × (1 title bar + 3 rows × 4 bars)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1 + 2 * 13)
  })

  it('defaults to 3 sections', () => {
    const { container } = render(<ReportSkeleton />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1 + 3 * 13)
  })
})
