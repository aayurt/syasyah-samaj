import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TooltipWrapper, Tooltip } from '../ui/Tooltip'
import { TooltipsProvider, useTooltips } from '../../hooks/useTooltips'

describe('TooltipWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const renderWithTooltips = (ui: React.ReactElement, enabled = true) => {
    return render(
      <TooltipsProvider initialEnabled={enabled}>
        {ui}
      </TooltipsProvider>
    )
  }

  describe('Basic Rendering', () => {
    it('renders children without tooltip initially', () => {
      renderWithTooltips(
        <TooltipWrapper tooltipKey="test.key">
          <button>Hover me</button>
        </TooltipWrapper>
      )
      
      expect(screen.getByText('Hover me')).toBeInTheDocument()
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('shows tooltip on hover', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Test tooltip">
          <button>Hover me</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Hover me')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Test tooltip')
      })
    })

    it('hides tooltip on mouse leave', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Test tooltip">
          <button>Hover me</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Hover me')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      })
      
      fireEvent.mouseLeave(button)
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })
    })

    it('shows tooltip on focus', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Focus tooltip">
          <button>Focus me</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Focus me')
      fireEvent.focus(button)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Focus tooltip')
      })
    })

    it('hides tooltip on blur', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Focus tooltip">
          <button>Focus me</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Focus me')
      fireEvent.focus(button)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      })
      
      fireEvent.blur(button)
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })
    })
  })

  describe('Keyboard Accessibility', () => {
    it('shows tooltip on Enter key', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Keyboard tooltip">
          <button>Press Enter</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Press Enter')
      fireEvent.keyDown(button, { key: 'Enter' })
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Keyboard tooltip')
      })
    })

    it('shows tooltip on Space key', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Space tooltip">
          <button>Press Space</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Press Space')
      fireEvent.keyDown(button, { key: ' ' })
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Space tooltip')
      })
    })

    it('hides tooltip on Escape key', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Escape tooltip">
          <button>Press Escape</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Press Escape')
      fireEvent.keyDown(button, { key: 'Enter' })
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      })
      
      fireEvent.keyDown(button, { key: 'Escape' })
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      })
    })
  })

  describe('Tooltip Toggle', () => {
    it('does not show tooltip when disabled', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Should not show">
          <button>Hover me</button>
        </TooltipWrapper>,
        false
      )
      
      const button = screen.getByText('Hover me')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('shows tooltip when enabled', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Should show">
          <button>Hover me</button>
        </TooltipWrapper>,
        true
      )
      
      const button = screen.getByText('Hover me')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Should show')
      })
    })
  })

  describe('Position', () => {
    it('renders tooltip at top by default', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Top tooltip" position="top">
          <button>Top</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Top')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip).toHaveClass('bottom-full')
      })
    })

    it('renders tooltip at bottom', async () => {
      renderWithTooltips(
        <TooltipWrapper content="Bottom tooltip" position="bottom">
          <button>Bottom</button>
        </TooltipWrapper>
      )
      
      const button = screen.getByText('Bottom')
      fireEvent.mouseEnter(button)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip).toHaveClass('top-full')
      })
    })
  })

  describe('Tooltip Component', () => {
    it('Tooltip component works as shorthand', async () => {
      renderWithTooltips(
        <Tooltip content="Shorthand tooltip">
          <span>ℹ️</span>
        </Tooltip>
      )
      
      const span = screen.getByText('ℹ️')
      fireEvent.mouseEnter(span)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Shorthand tooltip')
      })
    })
  })

  describe('useTooltips Hook', () => {
    it('provides enabled state and setter', () => {
      const TestComponent = () => {
        const { enabled, setEnabled } = useTooltips()
        return (
          <div>
            <span data-testid="enabled">{String(enabled)}</span>
            <button onClick={() => setEnabled(!enabled)} data-testid="toggle">Toggle</button>
          </div>
        )
      }
      
      renderWithTooltips(<TestComponent />, true)
      
      expect(screen.getByTestId('enabled')).toHaveTextContent('true')
      
      fireEvent.click(screen.getByTestId('toggle'))
      
      expect(screen.getByTestId('enabled')).toHaveTextContent('false')
    })
  })
})