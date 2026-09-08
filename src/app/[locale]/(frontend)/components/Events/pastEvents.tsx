import configPromise from '@payload-config'
import { getCurrentLocale, getI18n } from '@/locales/server'
import { getPayload } from 'payload'
import EventCard from './EventCard'

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
        <section id="past-events" className={`${showPadding ? 'py-24' : ''} bg-muted`}>
            <div className="container mx-auto px-4">
                {(title || description) && (
                    <div className="text-center mb-16">
                        {title && <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">{title}</h2>}
                        {description && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{description}</p>}
                    </div>
                )}
                {!title && !description && (
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">{t('home.pastEvents' as any, { count: 0 })}</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('home.pastEventsDescription' as any, { count: 0 })}</p>
                    </div>
                )}

                {pastEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {pastEvents.map((event) => (
                            <EventCard key={event.id} event={event as any} badgeLabel={t('home.pastEvents' as any, { count: 1 })} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-muted rounded-3xl border border-dashed border-border">
                        <p className="text-muted-foreground">{t('home.noPastEvents')}</p>
                    </div>
                )}
            </div>
        </section>
    )
}
