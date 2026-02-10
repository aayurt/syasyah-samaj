'use client'

import { resetPassword } from '@/lib/auth/client'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import './index.scss'

function ResetPasswordFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <div className="login-container">
        <Card className="login-card">
          <CardHeader className="login-header">
            <CardTitle className="login-title">Invalid Link</CardTitle>
            <CardDescription className="login-description">
              The password reset link is invalid or has expired.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!token) {
      setError('Invalid token')
      return
    }

    setLoading(true)

    try {
      const { error } = await resetPassword({
        newPassword: password,
        token,
      })

      if (error) {
        setError(error.message || 'Failed to reset password')
      } else {
        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/login')
        }, 3000)
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
            <CardTitle className="login-title">Password Reset</CardTitle>
            <CardDescription className="login-description">
              Your password has been successfully reset. Redirecting to login...
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
          <CardTitle className="login-title">Set new password</CardTitle>
          <CardDescription className="login-description">
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent className="login-content">
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            <div className="form-group">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <Button type="submit" className="submit-button" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset password'
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

export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="login-container">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  )
}
