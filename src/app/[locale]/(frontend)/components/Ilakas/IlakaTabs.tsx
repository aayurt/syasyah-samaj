'use client'

import { Media } from '@/components/Media'
import { useI18n } from '@/locales/client'
import { Tenant } from '@/payload-types'
import Link from 'next/link'
import { useState } from 'react'

// Some tenants are intentionally hidden from the ilaka tabs (historical exclusions).
const EXCLUDED_TENANT_IDS = new Set([2])

export function IlakaTabs({ ilakas }: { ilakas: Tenant[] }) {
    const t = useI18n()
    const [activeTab, setActiveTab] = useState(ilakas[0]?.id)
    const activeIlaka = ilakas.find(i => i.id === activeTab) || ilakas[0]

    if (ilakas.length === 0) return null

    return (
        <div className="md:flex md:space-x-4">
            <ul className="flex flex-col space-y-2 text-sm font-medium text-muted-foreground mb-4 md:mb-0 w-full md:w-64 shrink-0">
                {ilakas.filter(i => !EXCLUDED_TENANT_IDS.has(i.id)).map((ilaka) => {
                    const isActive = activeTab === ilaka.id
                    return (
                        <li key={ilaka.id}>
                            <button
                                onClick={() => setActiveTab(ilaka.id)}
                                className={`inline-flex items-center px-4 py-3 rounded-lg w-full transition-colors text-left text-foreground ${isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted bg-muted/50'
                                    }`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {ilaka.name}
                            </button>
                        </li>
                    )
                })}
            </ul>
            <div className="p-6 bg-muted/50 dark:bg-muted text-muted-foreground rounded-lg w-full min-h-[300px] flex flex-col justify-between">
                {activeIlaka && (
                    <>
                        <div>
                            {activeIlaka.coverImage && typeof activeIlaka.coverImage === 'object' ? (
                                <Media
                                    resource={activeIlaka.coverImage}
                                    className="w-full h-60 object-cover rounded-lg mb-4"
                                />
                            ) : (
                                <div className="w-full h-60 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg mb-4 flex items-center justify-center">
                                    <span className="text-primary/50 font-semibold">{activeIlaka.name}</span>
                                </div>
                            )}
                            <h3 className="text-xl font-semibold text-foreground mb-4">{activeIlaka.name}</h3>
                            <p className="mb-4 text-lg text-muted-foreground">{activeIlaka.description}</p>
                        </div>
                        <div className='flex justify-end'>
                            <Link href={`/ilakas/${activeIlaka.slug}`} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg mt-4 font-semibold hover:bg-primary/90 transition-colors">
                                {t('ilaka.viewFullDetails')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
