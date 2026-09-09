import { Media } from '@/components/Media'
import { getCurrentLocale, getI18n } from '@/locales/server'
import { ArrowRight, Calendar } from 'lucide-react'
import Link from 'next/link'

type EventType = {
    id: string
    slug: string
    title: string
    description: string
    startDatetime?: string | null
    coverImage?: any
}

export default async function EventCard({ event, badgeLabel }: { event: EventType; badgeLabel: string }) {
    const locale = await getCurrentLocale()
    const t = await getI18n()

    return (
        <Link
            key={event.id}
            href={`/events/${event.slug}`}
            className="group bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 flex flex-col h-full"
        >
            <div className="relative h-48 overflow-hidden">
                {event.coverImage && typeof event.coverImage !== 'string' && (
                    <Media
                        resource={event.coverImage}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                )}
                <div className="absolute top-4 right-4 bg-primary/90 dark:bg-primary/80 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground">
                    {badgeLabel}
                </div>
            </div>
            <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center text-sm text-muted-foreground mb-3">
                    <Calendar className="w-4 h-4 mr-2 text-primary" />
                    {event.startDatetime && new Date(event.startDatetime).toLocaleDateString(locale, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </div>
                <h3 className="text-xl font-bold mb-3 text-primary dark:text-foreground group-hover:text-primary dark:group-hover:text-primary transition-colors">
                    {event.title}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-grow">
                    {event.description}
                </p>
                <div className="flex items-center text-primary font-semibold text-sm group-hover:translate-x-1 transition-transform">
                    {t('home.learnMore')} <ArrowRight className="w-4 h-4 ml-1" />
                </div>
            </div>
        </Link>
    )
}
