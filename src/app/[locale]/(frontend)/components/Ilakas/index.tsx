
import { getI18n, getCurrentLocale } from '@/locales/server'
import { IlakaTabs } from './IlakaTabs'

export default async function Ilakas({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
    const t = await getI18n()
    return (
        <section id="ilakas" className="py-24 dark:bg-gray-900">
            <div>
                <div className="mb-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-red-900 dark:text-slate-50">
                        {t('home.ilakas')}
                    </h2>
                    <p className="text-gray-600 mt-3 max-w-2xl mx-auto dark:text-slate-50">
                        {t('home.ilakasDescription')}
                    </p>
                </div>


                <div className="max-w-5xl mx-auto mt-12 w-full">
                    <IlakaTabs />
                </div>


            </div>
        </section>
    )
}