/**
 * MemberViewModal component tests (MISSION.md M6).
 * Read-only member detail sheet with screen + print replicas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import MemberViewModal from './MemberViewModal'
import { renderEn } from '../test/renderEn'

const onClose = vi.fn()
const onEdit = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const member = {
  id: 1,
  fullName: 'Aama Gurung',
  email: 'aama@example.com',
  phoneNumber: '9841000001',
  membershipType: { id: 2, name: 'Lifetime', fee: 5000 },
  paymentStatus: 'paid',
  renewalDate: '2027-01-01',
  idCardDetails: { bloodGroup: 'B+' },
  application: {
    citizenshipNo: '12-34-567890',
    citizenshipDistrict: 'Lalitpur',
    addressPermanent: 'Patan, Lalitpur',
    occupation: 'Teacher',
    fatherName: 'Hari Gurung',
    appliedDateBs: '2082-09-15',
  },
}

describe('MemberViewModal', () => {
  it('renders the member identity and application fields', () => {
    renderEn(<MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />)
    expect(screen.getByText('Member Details')).toBeInTheDocument()
    // Screen + print replicas both render most fields.
    expect(screen.getAllByText('Aama Gurung').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('aama@example.com').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('12-34-567890').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Patan, Lalitpur').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('B+').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Lifetime').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('paid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hari Gurung').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the photo placeholder when there is no profile image', () => {
    renderEn(<MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />)
    // Two replicas (screen + print) both show the placeholder
    expect(screen.getAllByText('फोटो').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByAltText('Photo')).not.toBeInTheDocument()
  })

  it('renders the photo when profileImage is an object with a url', () => {
    renderEn(
      <MemberViewModal
        member={{ ...member, profileImage: { id: 9, url: 'https://cdn.example/p.jpg' } }}
        onClose={onClose}
        onEdit={onEdit}
      />,
    )
    expect(screen.getByAltText('Photo')).toHaveAttribute(
      'src',
      'https://cdn.example/p.jpg',
    )
  })

  it('renders blank field values without crashing when application data is missing', () => {
    renderEn(
      <MemberViewModal
        member={{ id: 3, fullName: 'New Member', email: '' }}
        onClose={onClose}
        onEdit={onEdit}
      />,
    )
    expect(screen.getAllByText('New Member').length).toBeGreaterThanOrEqual(1)
    // Empty values render as nbsp, not "undefined"
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  })

  it('calls onEdit with the member when Edit is clicked', () => {
    renderEn(<MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(member)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose from the X button', () => {
    renderEn(<MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />)
    const buttons = screen.getAllByRole('button')
    const closeBtn = buttons.find((b) => b.querySelector('svg.lucide-x'))!
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('schedules window.print when Print is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    renderEn(<MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: /Print/ }))
    // rAF → setTimeout(150) → window.print
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(printSpy).toHaveBeenCalledTimes(1)
        vi.unstubAllGlobals()
        printSpy.mockRestore()
        resolve()
      }, 250)
    })
  })

  it('renders the print-only replica sheet', () => {
    const { container } = renderEn(
      <MemberViewModal member={member} onClose={onClose} onEdit={onEdit} />,
    )
    const sheet = container.querySelector('.member-print-sheet')
    expect(sheet).not.toBeNull()
    expect(sheet!.textContent).toContain('Aama Gurung')
    expect(sheet!.textContent).toContain('12-34-567890')
  })
})
