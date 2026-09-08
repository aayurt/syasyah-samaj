
import { getI18n, getCurrentLocale } from '@/locales/server'
import { IlakaTabs } from './IlakaTabs'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <section id="ilakas" className="py-24 dark:bg-muted">
            <div className="container mx-auto px-4">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-primary dark:text-foreground">
                        {t('home.ilakas')}
                    </h2>
                    <p className="text-muted-foreground mt-3 max-w-2xl mx-auto dark:text-muted-foreground">
                        {t('home.ilakasDescription')}
                    </p>
                </div>

                <div className="max-w-5xl mx-auto mt-12 w-full">
                    <IlakaTabs ilakas={ilakas} />
                </div>

                <div className="mt-16 text-center">
                    <Button asChild size="lg" className="rounded-full">
                        <Link href="/ilakas" className="inline-flex items-center gap-2">
                            {t('ilaka.viewAllIlakas')}
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    )
}
