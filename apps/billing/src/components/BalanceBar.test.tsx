/**
 * BalanceBar component tests (MISSION.md M6).
 * Presentational footer: totals, balanced/unbalanced states, snap pulse.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import BalanceBar, { useBalanceSnap } from './BalanceBar'
import { LangContext } from '../lib/i18n'

function renderBar(debit: number, credit: number, actions?: React.ReactNode) {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <BalanceBar debit={debit} credit={credit} actions={actions ?? <button>Save</button>} />
    </LangContext.Provider>,
  )
}

describe('BalanceBar', () => {
  it('shows formatted Dr and Cr totals', () => {
    renderBar(1500.5, 1500.5)
    // Same value appears for both Dr and Cr — format the same way as the
    // component so the assertion is locale-independent.
    const shown = (1500.5).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })
    expect(screen.getAllByText(shown)).toHaveLength(2)
  })

  it('shows the balanced badge when difference is zero', () => {
    renderBar(1000, 1000)
    expect(screen.getByText(/✓ balanced/)).toBeInTheDocument()
    expect(screen.queryByText(/difference/i)).not.toBeInTheDocument()
  })

  it('shows the difference when unbalanced', () => {
    renderBar(1200, 1000)
    expect(screen.getByText(/difference 200/)).toBeInTheDocument()
    expect(screen.queryByText(/✓ balanced/)).not.toBeInTheDocument()
  })

  it('shows a negative difference with a minus sign', () => {
    renderBar(900, 1000)
    expect(screen.getByText(/difference -100/)).toBeInTheDocument()
  })

  it('renders children and actions', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <BalanceBar debit={1} credit={1} actions={<button>Save</button>}>
          <span>Post button</span>
        </BalanceBar>
      </LangContext.Provider>,
    )
    expect(screen.getByText('Post button')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('treats sub-cent differences as balanced', () => {
    renderBar(1000.001, 1000)
    expect(screen.getByText(/✓ balanced/)).toBeInTheDocument()
  })
})

describe('useBalanceSnap', () => {
  it('returns false initially and only snaps on unbalanced → balanced transition', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(({ diff }) => useBalanceSnap(diff), {
        initialProps: { diff: 100 },
      })
      expect(result.current).toBe(false)

      // unbalanced → balanced transition triggers the pulse
      rerender({ diff: 0 })
      expect(result.current).toBe(true)

      // pulse clears itself after 250ms
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(result.current).toBe(false)

      // going unbalanced does not re-snap
      rerender({ diff: 50 })
      expect(result.current).toBe(false)

      // …but a new unbalanced → balanced transition snaps again
      rerender({ diff: 0 })
      expect(result.current).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not snap when starting balanced then going unbalanced', () => {
    const { result, rerender } = renderHook(({ diff }) => useBalanceSnap(diff), {
      initialProps: { diff: 0 },
    })
    rerender({ diff: 10 })
    expect(result.current).toBe(false)
  })
})
