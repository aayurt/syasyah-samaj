import React from 'react'
import configPromise from '@payload-config'
import { getCurrentLocale, getI18n } from '@/locales/server'
import { getPayload } from 'payload'
import Link from 'next/link'
import { MapPin, Calendar, Clock, ArrowRight } from 'lucide-react'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

export default async function UpcomingEvents({
  title,
  description,
  showPadding = true,
  limit,
}: {
  title?: string
  description?: string
  showPadding?: boolean
  limit?: number
}) {
  const payload = await getPayload({ config: configPromise })
  const locale = (await getCurrentLocale()) as Locale
  const t = await getI18n()
  const content = getHomeContent(locale)

  const { docs: events } = await payload.find({
    collection: 'events',
    locale,
    limit: limit || 10,
  })

  const upcomingEvents = events.filter(
    (event) => event.enabled && event.startDatetime && new Date(event.startDatetime) > new Date(),
  )

  const eventItems = content.events.items

  return (
    <section id="upcoming-events" className={`${showPadding ? 'py-16' : ''} bg-transparent`}>
      <div className="w-full space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              {locale === 'en' ? 'Community Calendar' : 'सामुदायिक पात्रो'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight mt-2">
              {title || content.events.title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description || content.events.subtitle}
            </p>
          </div>

          <Link
            href="/events"
            className="text-xs font-bold text-primary hover:underline shrink-0 flex items-center gap-1"
          >
            <span>{locale === 'en' ? 'View All Events' : 'सबै कार्यक्रमहरू'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Restructured Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {eventItems.map((item, idx) => (
            <div
              key={idx}
              className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Event Photo with Floating Date Badge */}
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Calendar Date Badge */}
                  <div className="absolute top-3 left-3 bg-card/95 backdrop-blur-md border border-border text-card-foreground rounded-xl p-2 text-center min-w-[56px] shadow-md">
                    <span className="text-[10px] font-bold text-primary uppercase block leading-none">
                      {item.month}
                    </span>
                    <span className="text-xl font-serif font-black text-foreground leading-tight tabular-nums block mt-0.5">
                      {item.day}
                    </span>
                  </div>

                  {/* Event Category Badge */}
                  <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {item.type}
                  </div>

                  {/* Venue location pill */}
                  <div className="absolute bottom-3 left-3 text-white text-xs font-medium flex items-center gap-1.5 drop-shadow-sm line-clamp-1 pr-3">
                    <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </div>
                </div>

                {/* Event Details */}
                <div className="p-6 space-y-3">
                  <h3 className="text-lg font-serif font-bold text-card-foreground group-hover:text-primary transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {locale === 'en'
                      ? 'Annual formal gathering, community prasad distribution, and local service coordination in Lalitpur.'
                      : 'वार्षिक औपचारिक भेला, समय् बजि प्रसाद वितरण तथा ललितपुरका २४ इलाका स्तरीय समन्वय।'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 pt-0 border-t border-border mt-2 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  className="px-3.5 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors"
                >
                  {content.events.agendaBtn}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-xs transition-colors"
                >
                  {content.events.rsvpBtn} →
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}