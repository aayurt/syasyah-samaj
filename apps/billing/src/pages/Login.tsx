import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { authClient, isAdminUser } from '../lib/auth'

// Public demo credentials — shown on the login card so anyone can try the
// app. To revoke, remove this demo user from the database (or change the
// password) and delete this section.
const DEMO_EMAIL = 'demo@syasyahsamaj.com'
const DEMO_PASSWORD = 'SyashaDemo2026!'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<'email' | 'password' | null>(null)

  const copy = async (field: 'email' | 'password', value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(field)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — nothing to do
    }
  }

  const useDemo = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      })
      if (signInError) throw new Error(signInError.message || 'Sign in failed')
      if (data?.user && !isAdminUser((data.user as { role?: string }).role)) {
        await authClient.signOut()
        setError('This account does not have admin access to Billing.')
        setLoading(false)
        return
      }
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    }
    setLoading(false)
  }

  const CopyRow = ({ field, label, value }: { field: 'email' | 'password'; label: string; value: string }) => (
    <button
      type="button"
      onClick={() => void copy(field, value)}
      title={`Copy ${label.toLowerCase()}`}
      className="group flex w-full items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs hover:border-slate-300 hover:bg-slate-100"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="block truncate font-mono text-slate-700">{value}</span>
      </span>
      {copied === field ? (
        <Check size={13} className="shrink-0 text-emerald-600" />
      ) : (
        <Copy size={13} className="shrink-0 text-slate-400 group-hover:text-slate-600" />
      )}
    </button>
  )

  return (
    <div className="grid h-screen place-items-center bg-slate-100">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">स्यस्यः धुकू</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your admin account
        </p>

        {/* ── Demo login (public) ─────────────────────────────── */}
        <div className="mt-6 rounded-lg border border-crimson-200 bg-crimson-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-crimson-700">
              Try the demo — click to copy
            </p>
            <button
              type="button"
              onClick={useDemo}
              title="Fill the sign-in form with the demo credentials"
              className="rounded border border-crimson-200 bg-white px-2 py-0.5 text-[11px] font-medium text-crimson-700 hover:bg-crimson-100"
            >
              Use demo
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            <CopyRow field="email" label="Email" value={DEMO_EMAIL} />
            <CopyRow field="password" label="Password" value={DEMO_PASSWORD} />
          </div>
        </div>

        <label className="mt-6 block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>

        {error && (
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}