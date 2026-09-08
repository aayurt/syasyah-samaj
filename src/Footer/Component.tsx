import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { getCurrentLocale, getI18n } from '@/locales/server'

export async function Footer({ locale }: { locale?: string }) {
  const currentLocale = locale || await getCurrentLocale()
  const t = await getI18n()
  const footerData: Footer = await getCachedGlobal('footer', 1, currentLocale as 'en' | 'ne' | 'new')()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-muted dark:bg-card text-foreground">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href="/">
          <Logo />
        </Link>

        <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
          <ThemeSelector />
          <nav className="flex flex-col md:flex-row gap-4">
            {navItems.map(({ link }, i) => {
              return <CMSLink className="text-foreground" key={i} {...link} />
            })}
          </nav>
        </div>
      </div>
      <div className="container border-t border-border mt-6 py-2">
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
          <p>{t('copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
