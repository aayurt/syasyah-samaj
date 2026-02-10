'use client'
/* eslint-disable */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/lib/auth/client'
import {
  createPayloadAuthClient,
  type PayloadAuthClient,
} from '@delmaredigital/payload-better-auth/client'
import { Apple, ArrowRight, Loader2, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import './index.scss'
export type LoginViewProps = {
  /** Optional pre-configured auth client */
  authClient?: PayloadAuthClient
  /** Custom logo element */
  logo?: React.ReactNode
  /** Login page title. Default: 'Login' */
  title?: string
  /** Path to redirect after successful login. Default: '/admin' */
  afterLoginPath?: string
  /**
   * Required role(s) for admin access.
   * - string: Single role required (default: 'admin')
   * - string[]: Multiple roles (behavior depends on requireAllRoles)
   * - null/undefined: Disable role checking
   * For complex RBAC beyond these options, disable the login view and create your own.
   */
  requiredRole?: string | string[] | null
  /**
   * When requiredRole is an array, require ALL roles (true) or ANY role (false).
   * Default: false (any matching role grants access)
   */
  requireAllRoles?: boolean
  /**
   * Enable passkey (WebAuthn) sign-in option.
   * - true: Always show passkey button
   * - false: Never show passkey button
   * - 'auto' (default): Auto-detect if passkey plugin is available
   */
  enablePasskey?: boolean | 'auto'
  /**
   * Enable user registration (sign up) option.
   * - true: Always show "Create account" link
   * - false: Never show registration option
   * - 'auto' (default): Auto-detect if sign-up endpoint is available
   */
  enableSignUp?: boolean | 'auto'
  /**
   * Default role to assign to new users during registration.
   * Default: 'user'
   */
  defaultSignUpRole?: string
  /**
   * Enable forgot password option.
   * - true: Always show "Forgot password?" link
   * - false: Never show forgot password option
   * - 'auto' (default): Auto-detect if forget-password endpoint is available
   */
  enableForgotPassword?: boolean | 'auto'
  /**
   * Custom URL for password reset page. If provided, users will be redirected here
   * instead of showing the inline password reset form.
   * The reset token will be appended as ?token=xxx
   */
  resetPasswordUrl?: string
}

export default function LoginForm({
  authClient: providedClient,
  afterLoginPath = '/admin',
  requiredRole = 'admin',
  requireAllRoles = false,
}: LoginViewProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const getClient = () => providedClient ?? createPayloadAuthClient()
  const [accessDenied, setAccessDenied] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const client = getClient()
        const result = await client.getSession()

        if (result.data?.user) {
          const user = result.data.user as { role?: unknown }
          // User is logged in, check role
          if (user.role && user.role === requiredRole) {
            router.push(afterLoginPath)
            return
          } else {
            setAccessDenied(true)
          }
        }
      } catch {
        // No session, show login form
      }
      setCheckingSession(false)
    }
    checkSession()
  }, [afterLoginPath, requiredRole, requireAllRoles, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn.email({ email, password })

      if ((result as any)?.error) {
        setError((result as any).error?.message || 'Failed to sign in')
        return
      }

      // Success - redirect to admin/dashboard depending on role
      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    const client = getClient()
    await client.signOut()
    setAccessDenied(false)
    router.refresh()
  }

  const handleSocial = async (provider: 'google' | 'apple') => {
    setError(null)
    setLoading(true)
    try {
      const currentURL = typeof window !== 'undefined' ? window.location.href : ''
      await signIn.social({ provider, callbackURL: currentURL })
      // social sign-in typically redirects; if it returns, refresh
      router.refresh()
    } catch (err: any) {
      setError(err?.message || `Failed to sign in with ${provider}`)
    } finally {
      setLoading(false)
    }
  }
  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="login-container">
        <Card className="w-full max-w-md">
          <CardContent className="loading-card">
            <Loader2 className="spinner" />
            <span className="text">Loading...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="login-container">
        <Card className="access-denied-card w-full max-w-md">
          <CardHeader className="access-denied-header">
            <CardTitle className="access-denied-title">Access Denied</CardTitle>
            <CardDescription className="access-denied-description">
              You don't have permission to access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="access-denied-content">
            <p>Please contact an administrator if you believe this is an error.</p>
            <button onClick={handleSignOut}>Sign out and try again</button>
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <div className="login-container">
      <Card className="login-card">
        <CardHeader className="login-header">
          <CardTitle className="login-title">Sign in to Payload</CardTitle>
          <CardDescription className="login-description">
            Enter your credentials or continue with a social provider
          </CardDescription>
        </CardHeader>
        <CardContent className="login-content">
          {/* Social Login Buttons */}
          <div className="social-buttons">
            <button
              type="button"
              className="social-btn"
              onClick={() => handleSocial('google')}
              disabled={loading}
            >
              <Zap className="icon" />
              <span className="text">Google</span>
            </button>

            <button
              type="button"
              className="social-btn"
              onClick={() => handleSocial('apple')}
              disabled={loading}
            >
              <Apple className="icon" />
              <span className="text">Apple</span>
            </button>
          </div>

          <div className="divider-container">
            <div className="divider-line"></div>
            <div className="divider-text">
              <span>Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? (
                <>
                  <Loader2 className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
