
import { getI18n, getCurrentLocale } from '@/locales/server'
import { IlakaTabs } from './IlakaTabs'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default async function Ilakas({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
    const t = await getI18n()
    const locale = propLocale || await getCurrentLocale()
    const payload = await getPayload({ config: configPromise })

    const { docs: ilakas } = await payload.find({
        collection: 'tenants',
        locale: locale as 'en' | 'ne' | 'new',
        limit: 10,
        where: {
            enabled: {
                equals: true
            }
        }
    })

    return (
        <section id="ilakas" className="py-24 dark:bg-gray-900">
            <div className="container mx-auto px-4">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-red-900 dark:text-slate-50">
                        {t('home.ilakas')}
                    </h2>
                    <p className="text-gray-600 mt-3 max-w-2xl mx-auto dark:text-slate-50">
                        {t('home.ilakasDescription')}
                    </p>
                </div>


                <div className="max-w-5xl mx-auto mt-12 w-full">
                    <IlakaTabs ilakas={ilakas.map(ilaka => ({
                        id: ilaka.id,
                        name: ilaka.name,
                        slug: ilaka.slug,
                        description: ilaka.description || `Explore more about ${ilaka.name} and its contribution to the community.`
                    }))} />
                </div>

                <div className="mt-16 text-center">
                    <Link
                        href="/ilakas"
                        className="inline-flex items-center gap-2 px-8 py-3 bg-red-900 text-white rounded-full font-bold hover:bg-red-800 transition-colors"
                    >
                        View All Ilakas
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        </section>
    )
}