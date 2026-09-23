import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Lock, Mail, Eye, EyeOff } from 'lucide-react'
import { authClient, isAdminUser } from '../lib/auth'
import { useT } from '../lib/i18n'

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
  const [showPassword, setShowPassword] = useState(false)
  const t = useT()
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
    setLoading(true)
    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      })
      if (signInError) throw new Error(signInError.message || 'Sign in failed')
      if (data?.user && !isAdminUser((data.user as { role?: string }).role)) {
        await authClient.signOut()
        setError(t('login.needAdmin', 'You need an admin account to use Billing.'))
        setLoading(false)
        return
      }
      navigate('/')
    } catch (err: unknown) {
      setError(`${t('login.errorPrefix', 'Error: ')}${err instanceof Error ? err.message : 'Sign in failed'}`)
    }
    setLoading(false)
  }

  const CopyRow = ({ field, label, value }: { field: 'email' | 'password'; label: string; value: string }) => (
    <button
      type="button"
      onClick={() => void copy(field, value)}
      title={`Copy ${label.toLowerCase()}`}
      className="group flex w-full items-center justify-between gap-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-left text-xs hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span className="block truncate font-mono text-slate-700 dark:text-slate-200">{value}</span>
      </span>
      {copied === field ? (
        <Check size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy size={13} className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
      )}
    </button>
  )

  return (
    <div className="grid h-screen place-items-center bg-slate-100 dark:bg-slate-900 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg dark:shadow-xl"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('login.title', 'स्यस्यः धुकू')}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('login.subtitle', 'Sign in to access the billing dashboard')}
          </p>
        </div>

        {/* ── Demo login (public) ─────────────────────────────── */}
        <div className="mb-6 rounded-lg border border-crimson-200 dark:border-crimson-800 bg-crimson-50 dark:bg-crimson-900/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-crimson-700 dark:text-crimson-300">
              {t('login.demoTitle', 'Try the demo — click to copy')}
            </p>
            <button
              type="button"
              onClick={useDemo}
              title="Fill the sign-in form with the demo credentials"
              className="rounded border border-crimson-200 dark:border-crimson-800 bg-white dark:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-crimson-700 dark:text-crimson-300 hover:bg-crimson-100 dark:hover:bg-crimson-900/30"
            >
              {t('login.demoUse', 'Use demo')}
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            <CopyRow field="email" label={t('login.demoEmail', 'Email')} value={DEMO_EMAIL} />
            <CopyRow field="password" label={t('login.demoPassword', 'Password')} value={DEMO_PASSWORD} />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('login.emailLabel', 'Email')}
          <div className="relative mt-1">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder', 'you@example.com')}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 transition-colors"
            />
          </div>
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('login.passwordLabel', 'Password')}
          <div className="relative mt-1">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder', '••••••••')}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-crimson-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-crimson-700 focus:outline-none focus:ring-2 focus:ring-crimson-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('login.signingIn', 'Signing in…') : t('login.signIn', 'Sign in')}
        </button>
      </form>
    </div>
  )
}