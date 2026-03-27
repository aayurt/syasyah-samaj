import React from 'react'
import { getI18n } from '@/locales/server'
import UpcomingEvents from '../components/Events/upcomingEvents'
import PastEvents from '../components/Events/pastEvents'
import { generateMeta } from '@/utilities/generateMeta'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
    return generateMeta({
        doc: {
            meta: {
                title: 'Events - Syasyah Samaj',
                description: 'Stay updated with upcoming and past events of Syasyah Samaj.',
            },
        },
    })
}

export default async function EventsPage() {
    const t = await getI18n()

    return (
        <div className="pt-24">
            <div className="container mx-auto px-4 py-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-red-900 dark:text-slate-50 mb-6">
                    {t('home.UpcomingEvents' as any, { count: 0 })} & {t('home.pastEvents' as any, { count: 0 })}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Explore all our events, from future community gatherings to our historical celebrations.
                </p>
            </div>

            <div>
                <UpcomingEvents showPadding={true} />
                <PastEvents showPadding={true} />
            </div>
        </div>
    )
}
