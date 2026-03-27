import React from 'react'
import { getI18n } from '@/locales/server'
import UpcomingEvents from '../components/Events/upcomingEvents'
import PastEvents from '../components/Events/pastEvents'
import { generateMeta } from '@/utilities/generateMeta'
import { Metadata } from 'next'
import { getStaticParams, setStaticParamsLocale } from '@/locales/server'

export function generateStaticParams() {
    return getStaticParams()
}

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await paramsPromise
    setStaticParamsLocale(locale)
    const t = await getI18n()
    return generateMeta({
        doc: {
            meta: {
                title: t('events.metaTitle'),
                description: t('events.metaDescription'),
            },
        },
    })
}

export default async function EventsPage({ params: paramsPromise }: { params: Promise<{ locale: string }> }) {
    const { locale } = await paramsPromise
    setStaticParamsLocale(locale)
    const t = await getI18n()

    return (
        <div className="pt-24">
            <div className="container mx-auto px-4 py-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-red-900 dark:text-slate-50 mb-6">
                    {t('home.UpcomingEvents')} & {t('home.pastEvents')}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    {t('events.pageDescription')}
                </p>
            </div>

            <div>
                <UpcomingEvents showPadding={true} />
                <PastEvents showPadding={true} />
            </div>
        </div>
    )
}
