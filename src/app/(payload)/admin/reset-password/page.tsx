import ResetPasswordForm from '@/components/auth/reset-password-form'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: `Reset Password | ${process.env.NEXT_PUBLIC_APP_NAME || 'Afno Event'}`,
  description: 'Set a new password',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
