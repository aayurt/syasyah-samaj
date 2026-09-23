import React from 'react'
import { getI18n, getCurrentLocale } from '@/locales/server'
import { IlakaShowcase } from './IlakaShowcase'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Locale } from '@/lib/homeTranslations'

export default async function Ilakas({ locale: propLocale }: { locale?: Locale }) {
  const t = await getI18n()
  const locale = (propLocale || (await getCurrentLocale())) as Locale

  return (
    <section id="ilakas" className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{locale === 'en' ? 'Neighborhood Governance' : 'विकेन्द्रीकृत टोल समन्वय'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-foreground tracking-tight">
            {t('home.ilakas')}
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t('home.ilakasDescription')}
          </p>
        </div>

        {/* Aceternity Interactive Showcase */}
        <div className="w-full">
          <IlakaShowcase locale={locale} />
        </div>

        {/* All Ilakas Button */}
        <div className="text-center pt-4">
          <Link
            href="/ilakas"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <span>{t('ilaka.viewAllIlakas')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  )
}
