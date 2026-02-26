'use client'

import { signUp } from '@/lib/auth/client'
import { createPayloadAuthClient } from '@delmaredigital/payload-better-auth/client'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import './index.scss'

export default function SignUpForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        callbackURL: '/admin',
      })

      if ((result as any)?.error) {
        setError((result as any).error?.message || 'Failed to sign up')
        return
      }

      // Success - redirect to admin
      router.push('/admin')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <CardHeader className="login-header">
          <CardTitle className="login-title">Create an Account</CardTitle>
          <CardDescription className="login-description">
            Enter your details to create a new account
          </CardDescription>
        </CardHeader>
        <CardContent className="login-content">
          <form onSubmit={handleSignUp} className="login-form">
            <div className="form-group">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

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
              <div className="password-header">
                <Label htmlFor="password">Password</Label>
              </div>
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
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="arrow-icon" />
                </>
              )}
            </button>
          </form>

          <div className="signup-container">
            Already have an account?{' '}
            <Link href="/admin/login" className="signup-link">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
