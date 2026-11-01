/**
 * SearchBox component tests (MISSION.md M6).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchBox from './SearchBox'

const onChange = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SearchBox', () => {
  it('renders the current value and default placeholder', () => {
    render(<SearchBox value="kiran" onChange={onChange} />)
    expect(screen.getByPlaceholderText('Search…')).toHaveValue('kiran')
    // Clear button only shows when there is a value
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('uses a custom placeholder and hides clear when empty', () => {
    render(<SearchBox value="" onChange={onChange} placeholder="Find party…" />)
    expect(screen.getByPlaceholderText('Find party…')).toHaveValue('')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('emits onChange as the user types', () => {
    render(<SearchBox value="" onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('Search…'), {
      target: { value: 'kamala' },
    })
    expect(onChange).toHaveBeenCalledWith('kamala')
  })

  it('clears the value when the × button is clicked', () => {
    render(<SearchBox value="kamala" onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Clear search'))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
