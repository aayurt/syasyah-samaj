import { Media } from '@/components/Media'
import { getCurrentLocale, getI18n } from '@/locales/server'
import configPromise from '@payload-config'
import { ArrowRight, Calendar } from 'lucide-react'
import Link from 'next/link'
import { getPayload } from 'payload'

export default async function PastEvents({
    title,
    description,
    showPadding = true,
    limit
}: {
    title?: string,
    description?: string,
    showPadding?: boolean,
    limit?: number
}) {
    const payload = await getPayload({ config: configPromise })
    const locale = await getCurrentLocale()
    const t = await getI18n()

    const { docs: events } = await payload.find({
        collection: 'events',
        locale: locale as 'en' | 'ne' | 'new',
        limit: limit || 100
    })
    const pastEvents = events.filter((event) => event.enabled && event.startDatetime && new Date(event.startDatetime) < new Date())

    return (
        <section id="past-events" className={`${showPadding ? 'py-24' : ''} bg-gray-50 dark:bg-gray-900`}>
            <div className="container mx-auto px-4">
                {(title || description) && (
                    <div className="text-center mb-16">
                        {title && <h2 className="text-3xl md:text-4xl font-bold text-red-900 dark:text-slate-50 mb-4">{title}</h2>}
                        {description && <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{description}</p>}
                    </div>
                )}
                {!title && !description && (
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-red-900 dark:text-slate-50 mb-4">{t('home.pastEvents' as any, { count: 0 })}</h2>
                        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">{t('home.pastEventsDescription' as any, { count: 0 })}</p>
                    </div>
                )}

                {pastEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {pastEvents.map((event: any) => (
                            <Link
                                key={event.id}
                                href={`/events/${event.slug}`}
                                className="group bg-white dark:bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 flex flex-col h-full"
                            >
                                <div className="relative h-48 overflow-hidden">
                                    {event.coverImage && typeof event.coverImage !== 'string' && (
                                        <Media
                                            resource={event.coverImage}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    )}
                                    <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-red-900 dark:text-red-400">
                                        {t('home.pastEvents' as any, { count: 0 })}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3">
                                        <Calendar className="w-4 h-4 mr-2 text-red-700" />
                                        {event.startDatetime && new Date(event.startDatetime).toLocaleDateString(locale, {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3 group-hover:text-red-900 dark:group-hover:text-red-400 transition-colors">
                                        {event.title}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">
                                        {event.description}
                                    </p>
                                    <div className="flex items-center text-red-900 dark:text-red-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                                        {t('home.learnMore' as any, { count: 0 })} <ArrowRight className="w-4 h-4 ml-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-card rounded-3xl border border-dashed border-border">
                        <p className="text-gray-500">{t('home.noPastEvents' as any, { count: 0 })}</p>
                    </div>
                )}
            </div>
        </section>
    )
}