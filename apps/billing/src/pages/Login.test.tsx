import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './Login'

const navigateMock = vi.hoisted(() => vi.fn())
const signInMock = vi.hoisted(() => vi.fn())
const signOutMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../lib/auth', () => ({
  authClient: {
    signIn: { email: signInMock },
    signOut: signOutMock,
  },
  isAdminUser: (role?: string) => role === 'admin',
}))

vi.mock('../lib/i18n', () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Login', () => {
  it('renders the heading and sign-in form', () => {
    render(<Login />)
    expect(screen.getByText('स्यस्यः धुकू')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('fills the form with demo credentials when "Use demo" is clicked', async () => {
    const user = userEvent.setup()
    render(<Login />)
    await user.click(screen.getByTitle('Fill the sign-in form with the demo credentials'))
    expect(screen.getByPlaceholderText('you@example.com')).toHaveValue('demo@syasyahsamaj.com')
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('SyashaDemo2026!')
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<Login />)
    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')
    await user.click(screen.getByLabelText('Show password'))
    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument()
  })

  it('navigates to the dashboard after an admin sign-in', async () => {
    signInMock.mockResolvedValue({ data: { user: { role: 'admin' } }, error: null })
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByPlaceholderText('you@example.com'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signInMock).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'secret123',
    })
    await vi.waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'))
  })

  it('rejects non-admin users and signs them out', async () => {
    signInMock.mockResolvedValue({ data: { user: { role: 'user' } }, error: null })
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByPlaceholderText('you@example.com'), 'member@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You need an admin account to use Billing.',
    )
    expect(signOutMock).toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows an error when sign-in fails', async () => {
    signInMock.mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } })
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByPlaceholderText('you@example.com'), 'wrong@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Error: Invalid credentials')
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
