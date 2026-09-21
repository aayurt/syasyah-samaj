import React from 'react'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'
import { getCurrentLocale } from '@/locales/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { getHomeContent, Locale } from '@/lib/homeTranslations'
import { Spotlight } from '@/components/ui/aceternity/spotlight'
import { FlipWords } from '@/components/ui/aceternity/flip-words'

export default async function HomepageHero({ locale: propLocale }: { locale?: Locale }) {
  const locale = (propLocale || (await getCurrentLocale())) as Locale
  const content = getHomeContent(locale)

  const payload = await getPayload({ config: configPromise })
  const host = (await headers()).get('host') || ''
  const domain = host.split('.')[0]

  const { docs: tenants } = await payload.find({
    collection: 'tenants',
    where: {
      domain: {
        equals: domain === 'localhost:3000' || domain === 'syasyahsamaj' ? null : domain,
      },
    },
    limit: 1,
    locale,
  })

  const tenant = tenants[0]
  if (!tenant) return null

  const rotatingWords =
    locale === 'en'
      ? ['Cultural Heritage', 'Guthi Solidarity', 'Civic Community', '24 Local Ilakas']
      : locale === 'new'
      ? ['झीगु तजिलजि', 'गुथि मंकाः ज्या', 'दुजः सेवा', '२४ गू इलाका']
      : ['सांस्कृतिक सम्पदा', 'गुठी ऐक्यबद्धता', 'नागरिक सेवा', '२४ इलाका सहकार्य']

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/50 via-background to-background pt-16 pb-12 border-b border-border">
      {/* Aceternity Spotlight Aura */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20 text-primary" />

      {/* Subtle Background Radial Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-60 pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        
        {/* Editorial Masthead */}
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border shadow-xs hover:border-primary/50 transition-colors">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <span className="text-xs font-bold text-foreground tracking-wide">
              {content.hero.badge}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight text-foreground leading-[1.18]">
              {content.hero.headline}
            </h1>
            <div className="text-2xl sm:text-4xl font-serif font-bold text-muted-foreground flex items-center justify-center flex-wrap gap-1">
              <span>{locale === 'en' ? 'Empowering' : 'संवर्धन गर्दै:'}</span>
              <FlipWords words={rotatingWords} className="text-primary font-black" />
            </div>
          </div>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {content.hero.description}
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/login"
              className="px-6 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[44px] flex items-center justify-center"
            >
              {content.hero.actionPrimary}
            </Link>

            <a
              href="#ilakas"
              className="px-5 py-3.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-semibold text-sm transition-all shadow-xs min-h-[44px] flex items-center justify-center"
            >
              {content.hero.actionSecondary}
            </a>

            <Link
              href="/app"
              className="px-5 py-3.5 rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold text-sm shadow-xs transition-all min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <span>{content.hero.actionBilling}</span>
              <span>↗</span>
            </Link>
          </div>
        </div>

        {/* 4-Stat Community Pulse Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-card/90 backdrop-blur-md rounded-2xl border border-border shadow-md">
          <div className="border-r border-border/80 last:border-0 pr-4">
            <span className="text-[11px] text-muted-foreground font-medium block">
              {content.metrics.ilakasLabel}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              २४
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {content.metrics.ilakasSub}
            </span>
          </div>

          <div className="border-r border-border/80 last:border-0 pr-4">
            <span className="text-[11px] text-muted-foreground font-medium block">
              {content.metrics.familiesLabel}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              १,८४२
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {content.metrics.familiesSub}
            </span>
          </div>

          <div className="border-r border-border/80 last:border-0 pr-4">
            <span className="text-[11px] text-muted-foreground font-medium block">
              {content.metrics.archivesLabel}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              १२०+
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {content.metrics.archivesSub}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-muted-foreground font-medium block">
              {content.metrics.donorsLabel}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-primary tabular-nums">
              २१०+
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {content.metrics.donorsSub}
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}