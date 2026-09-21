import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

export default async function TimelineSection({ locale }: { locale: Locale }) {
  const content = getHomeContent(locale)
  let milestones: Array<{ year: string; title: string; tag: string; description: string }> = [
    ...content.timeline.milestones,
  ]

  try {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'timeline',
      sort: 'order',
      limit: 10,
      locale,
    })

    if (docs && docs.length > 0) {
      milestones = docs.map((doc: any) => ({
        year: doc.year,
        title: doc.title,
        description: doc.description,
        tag: doc.tag || (locale === 'en' ? 'Historical' : 'ऐतिहासिक'),
      }))
    }
  } catch (err) {
    // Fall back to localized defaults
  }

  return (
    <section id="timeline" className="py-16 bg-background border-t border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 space-y-3">
          <span className="inline-block text-xs uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            {content.timeline.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-foreground tracking-tight">
            {content.timeline.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {content.timeline.subtitle}
          </p>
        </div>

        {/* 4-Era Milestones Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className="group border-t-4 border-primary pt-4 bg-card p-6 rounded-b-2xl border-x border-b border-border hover:shadow-lg transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl sm:text-2xl font-serif font-black text-primary tabular-nums">
                  {m.year}
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground rounded-full border border-border">
                  {m.tag}
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-card-foreground leading-snug group-hover:text-primary transition-colors">
                {m.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {m.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}