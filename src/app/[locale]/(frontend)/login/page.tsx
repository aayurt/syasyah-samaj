import React, { Suspense } from 'react'
import OrganisationLoginForm from '@/components/auth/OrganisationLoginForm'
import { setStaticParamsLocale } from '@/locales/server'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'नागरिक तथा संस्थागत लगइन — स्यस्यः समाज',
  description: 'स्यस्यः समाज नागरिक, इलाका सचिवालय तथा लेखा प्रणाली प्रवेशद्वार',
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setStaticParamsLocale(locale)

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-stone-50 to-white dark:from-stone-950 dark:to-stone-900 flex items-center justify-center py-10 transition-colors">
      <Suspense fallback={<div className="p-12 text-center text-xs text-stone-500 dark:text-stone-400">फारम लोड हुँदैछ...</div>}>
        <OrganisationLoginForm />
      </Suspense>
    </div>
  )
}