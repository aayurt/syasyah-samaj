'use client'

import { requestPasswordReset } from '@/lib/auth/client'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import './index.scss'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await requestPasswordReset({
        email,
        redirectTo: '/admin/reset-password',
      })

      if (error) {
        setError(error.message || 'Failed to send reset email')
      } else {
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="login-container">
        <Card className="login-card">
          <CardHeader className="login-header">
            <CardTitle className="login-title">Check your email</CardTitle>
            <CardDescription className="login-description">
              We&apos;ve sent a password reset link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="login-content">
            <Link href="/admin/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <CardHeader className="login-header">
          <CardTitle className="login-title">Reset password</CardTitle>
          <CardDescription className="login-description">
            Enter your email address and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="login-content">
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" className="submit-button" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link href="/admin/login" className="flex items-center justify-center hover:underline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
