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

                <div className="grid md:grid-cols-4 gap-8 px-4">
                    {[...members].reverse().map((member, idx) => {
                        const website = member.socialLinks?.website;
                        const CardContent = (
                            <>
                                {/* 🔥 spinning border layer */}
                                <div className="rotating-border-gradient" />
                                {/* 🧊 card content */}
                                <div className="relative bg-white dark:bg-slate-900 rounded-[14px] p-6 text-center shadow-md h-full transition-colors z-10">

                                    {/* Avatar */}
                                    <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-2 border-gray-200">
                                        <Media
                                            resource={member.profileImage}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Name */}
                                    <h4 className="font-semibold text-red-900 dark:text-slate-50">
                                        {member.fullName}
                                    </h4>

                                    {/* Bio */}
                                    <p className="text-sm text-gray-700 dark:text-gray-400 mt-1">
                                        {member.bio}
                                    </p>
                                </div>
                            </>
                        );

                        return website ? (
                            <a
                                key={idx}
                                href={website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rotating-border-container block hover:cursor-pointer"
                            >
                                {CardContent}
                            </a>
                        ) : (
                            <div key={idx} className="rotating-border-container">
                                {CardContent}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    )
}
