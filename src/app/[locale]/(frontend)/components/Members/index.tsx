import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getI18n, getCurrentLocale } from '@/locales/server'
import { Media } from '@/components/Media'


export default async function Members({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
    const payload = await getPayload({ config: configPromise })
    const locale = propLocale || await getCurrentLocale()
    const t = await getI18n()

    const { docs: members } = await payload.find({
        collection: 'members',
        locale: locale as 'en' | 'ne',
    })

    return (
        <section id="committee" className="py-24 dark:bg-gray-900">
            <div>
                <div className="mb-12 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-red-900 dark:text-slate-50">
                        {t('home.committeeMembers', { count: members.length })}
                    </h2>
                    <p className="text-gray-600 mt-3 max-w-2xl mx-auto dark:text-slate-50">
                        {t('home.communityActivities', { count: members.length })}
                    </p>
                </div>

                <div className="grid md:grid-cols-4 gap-10">
                    {members.map((member) => (
                        <div className="text-center group">
                            <div className="w-28 h-28 mx-auto mb-4 overflow-hidden rounded-full border-2 border-gray-200">
                                <Media
                                    resource={member.profileImage}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h4 className="font-semibold text-red-900 dark:text-slate-50">{member.fullName}</h4>
                            <p className="text-sm text-gray-800 dark:text-gray-500">{member.bio}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
