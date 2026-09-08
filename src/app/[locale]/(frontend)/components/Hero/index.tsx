import { Media } from '@/components/Media'
import { getCurrentLocale, getI18n } from '@/locales/server'
import configPromise from '@payload-config'
import Link from 'next/link'
import { getPayload } from 'payload'
import { Button } from '@/components/ui/button'

export default async function Hero() {
    const payload = await getPayload({ config: configPromise })
    const locale = await getCurrentLocale()
    const t = await getI18n()

    const { docs: events } = await payload.find({
        collection: 'events',
        locale: locale as 'en' | 'ne' | 'new',
    })
    const UpcomingEvents = events.filter((event) => event.enabled && event.startDatetime && new Date(event.startDatetime) > new Date())

    return (
        <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />

            <div className="max-w-7xl mx-auto px-6">
                <div className="relative text-white py-28 md:py-36 grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-primary-foreground">
                            {t('homepageTitle')}
                        </h1>

                        <p className="text-primary-foreground/80 mb-8 text-lg">
                            {t('homepageDescription')}
                        </p>

                        <div className="flex gap-4">
                            <Button asChild size="lg" className="bg-yellow-400 text-black hover:bg-yellow-300">
                                <Link href="/members">
                                    {t('home.becomeMember')}
                                </Link>
                            </Button>

                            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                                <Link href="/events">
                                    {t('home.upcomingEvents')}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
                            <h3 className="text-xl font-semibold mb-4">{t('home.nextEvent')}</h3>

                            <div className="space-y-4">
                                {UpcomingEvents.slice(0, 2).map((event) => (
                                    <div key={event.title} className="border-b border-white/20 pb-3">
                                        <p className="font-medium">{event.title}</p>
                                        {event.startDatetime && <p className="text-sm text-primary-foreground/80">{new Date(event.startDatetime).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
