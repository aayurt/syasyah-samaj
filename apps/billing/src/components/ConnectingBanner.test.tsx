/**
 * ConnectingBanner component tests (MISSION.md M6).
 * Cold-boot "Connecting…" banner: warm cache hides it, cold cache shows it,
 * polling + timeout hide it again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import ConnectingBanner from './ConnectingBanner'
import { LangContext } from '../lib/i18n'

const getKeyMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/offline', () => ({
  getEngine: () => ({ getKey: getKeyMock }),
}))

function renderBanner() {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <ConnectingBanner />
    </LangContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ConnectingBanner', () => {
  it('renders nothing when the cache is already warm', async () => {
    getKeyMock.mockResolvedValue('2026-10-01')
    const { container } = renderBanner()
    // 200ms init delay before the cache check
    await act(() => new Promise((r) => setTimeout(r, 250)))
    expect(container.innerHTML).toBe('')
  })

  it('shows Connecting on a cold boot then hides once the cache warms', async () => {
    // First check: cold (null) → banner shows. Poll: warm → hides.
    getKeyMock.mockResolvedValueOnce(null).mockResolvedValue('warm')
    const { container } = renderBanner()

    await act(() => new Promise((r) => setTimeout(r, 250)))
    expect(screen.getByText(/Connecting/)).toBeInTheDocument()

    // Poll interval (500ms) sees the warm cache and hides the banner
    await act(() => new Promise((r) => setTimeout(r, 600)))
    expect(container.innerHTML).toBe('')
  })

  it('hides after the 5s safety timeout even if the cache never warms', async () => {
    getKeyMock.mockResolvedValue(null)
    vi.useFakeTimers()
    const { container } = renderBanner()

    // 200ms init delay → check() runs (async) → banner shows
    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.getByText(/Connecting/)).toBeInTheDocument()

    // Safety net at 5500ms hides it even though the cache never warmed
    await act(async () => {
      vi.advanceTimersByTime(5600)
    })
    expect(container.innerHTML).toBe('')
  })
})
