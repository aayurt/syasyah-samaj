import configPromise from '@payload-config'
import { getCurrentLocale, getI18n } from '@/locales/server'
import { getPayload } from 'payload'
import EventCard from './EventCard'

export default async function UpcomingEvents({
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
    const upcomingEvents = events.filter((event) => event.enabled && event.startDatetime && new Date(event.startDatetime) > new Date())

    return (
        <section id="upcoming-events" className={`${showPadding ? 'py-24' : ''} bg-white dark:bg-card`}>
            <div className="container mx-auto px-4">
                {(title || description) && (
                    <div className="text-center mb-16">
                        {title && <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">{title}</h2>}
                        {description && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{description}</p>}
                    </div>
                )}
                {!title && !description && (
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">{t('home.UpcomingEvents')}</h2>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('home.UpcomingEventsDescription')}</p>
                    </div>
                )}

                {upcomingEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                        {upcomingEvents.map((event) => (
                            <EventCard key={event.id} event={event as any} badgeLabel={t('home.UpcomingEvents')} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        <div className="bg-card rounded-2xl p-6 border border-border hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold px-2.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                                        {locale === 'en' ? 'Central Assembly' : 'केन्द्रीय सभा'}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {locale === 'en' ? 'Oct 10, 2026' : '२०८३ असोज १०'}
                                    </span>
                                </div>
                                <h3 className="font-serif font-bold text-lg text-card-foreground">
                                    {locale === 'en' ? '24th Annual General Assembly & Scholarship Awards' : '२४ औं वार्षिक साधारण सभा तथा छात्रवृत्ति वितरण'}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {locale === 'en' ? 'Annual financial report review, honor roll for outstanding students, and Ilaka council reports.' : 'वार्षिक आयव्यय समीक्षा, जेहेन्दार विद्यार्थी सम्मान तथा इलाका परिषद् प्रतिवेदन।'}
                                </p>
                            </div>
                            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                <span>{locale === 'en' ? 'Mangal Bazaar Hall' : 'मंगलबजार हल'}</span>
                                <span className="font-bold text-primary">{t('home.learnMore')} →</span>
                            </div>
                        </div>

                        <div className="bg-card rounded-2xl p-6 border border-border hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-500/20">
                                        {locale === 'en' ? 'Cultural Festival' : 'सांस्कृतिक पर्व'}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {locale === 'en' ? 'Oct 15, 2026' : '२०८३ असोज १५'}
                                    </span>
                                </div>
                                <h3 className="font-serif font-bold text-lg text-card-foreground">
                                    {locale === 'en' ? 'Yenya (Indra Jatra) Samay Baji & Musical Procession' : 'यँयाः समय् बजि वितरण तथा सांस्कृतिक परिक्रमा'}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {locale === 'en' ? 'Traditional Gunla baja musical circumambulation around Patan Durbar with prasad distribution.' : 'पाटन दरवार स्क्वायरमा परम्परागत गुँला बाजा सहित प्रसाद तथा समय् बजि वितरण।'}
                                </p>
                            </div>
                            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                <span>{locale === 'en' ? 'Patan Durbar' : 'पाटन दरवार क्षेत्र'}</span>
                                <span className="font-bold text-primary">{t('home.learnMore')} →</span>
                            </div>
                        </div>

                        <div className="bg-card rounded-2xl p-6 border border-border hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                                        {locale === 'en' ? 'Community Health' : 'स्वास्थ्य सेवा'}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {locale === 'en' ? 'Nov 02, 2026' : '२०८३ कात्तिक ०२'}
                                    </span>
                                </div>
                                <h3 className="font-serif font-bold text-lg text-card-foreground">
                                    {locale === 'en' ? 'Open Blood Donation & Senior Health Camp' : 'खुला रक्तदान तथा ज्येष्ठ नागरिक स्वास्थ्य परीक्षण'}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {locale === 'en' ? 'Free health checkups and blood drive in coordination with Red Cross Lalitpur chapter.' : 'रेडक्रस ललितपुर शाखासँगको समन्वयमा निःशुल्क स्वास्थ्य परीक्षण र रक्तदान कार्यक्रम।'}
                                </p>
                            </div>
                            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                                <span>{locale === 'en' ? 'Pulchowk Center' : 'पुल्चोक केन्द्र'}</span>
                                <span className="font-bold text-primary">{t('home.learnMore')} →</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
