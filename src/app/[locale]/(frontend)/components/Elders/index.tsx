import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

export default async function EldersSection({ locale = 'en' }: { locale?: Locale }) {
  const content = getHomeContent(locale)
  let elders: Array<{ name: string; honorificTitle: string; field: string; bio: string; initial: string }> = [
    ...content.elders.elders,
  ]

  try {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'elders',
      sort: 'order',
      limit: 6,
      locale,
    })

    if (docs && docs.length > 0) {
      elders = docs.map((d: any) => ({
        name: d.name,
        honorificTitle: d.honorificTitle || (locale === 'en' ? 'Distinguished Elder' : 'सम्मानित व्यक्तित्व'),
        field: d.field || (locale === 'en' ? 'Community Service' : 'सामुदायिक सेवा'),
        bio: d.bio || '',
        initial: (d.name || 'A')[0],
      }))
    }
  } catch (err) {
    // Fall back to localized defaults
  }

  return (
    <section id="elders" className="py-16 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-2">
          <span className="inline-block text-xs uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            {content.elders.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-foreground tracking-tight">
            {content.elders.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {content.elders.subtitle}
          </p>
        </div>

        {/* Elders Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {elders.map((elder, idx) => (
            <div
              key={idx}
              className="group border border-border rounded-2xl p-6 bg-card text-center hover:border-primary/50 hover:shadow-md transition-all flex flex-col items-center justify-between space-y-4"
            >
              <div className="space-y-3 flex flex-col items-center w-full">
                {/* Monogram Portrait */}
                <div className="w-20 h-20 rounded-full border-2 border-primary flex items-center justify-center bg-muted text-primary text-2xl font-serif font-black shadow-xs group-hover:scale-105 transition-transform">
                  {elder.initial}
                </div>

                <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full border border-border">
                  {elder.honorificTitle}
                </span>

                <h3 className="font-serif font-bold text-base sm:text-lg text-card-foreground group-hover:text-primary transition-colors">
                  {elder.name}
                </h3>

                <p className="text-xs text-primary font-semibold">
                  {elder.field}
                </p>

                <p className="text-xs text-muted-foreground leading-relaxed text-center line-clamp-3">
                  {elder.bio}
                </p>
              </div>

              <div className="pt-4 border-t border-border w-full text-center">
                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                  {content.elders.honorRoll}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}