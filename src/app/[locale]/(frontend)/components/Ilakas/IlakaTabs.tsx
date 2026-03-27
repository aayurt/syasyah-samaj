'use client'

import { useI18n } from '@/locales/client'
import Link from 'next/link'
import { useState } from 'react'

export interface IlakaInfo {
    id: number
    name: string
    slug: string
    description: string
}

export function IlakaTabs({ ilakas }: { ilakas: IlakaInfo[] }) {
    const [activeTab, setActiveTab] = useState(ilakas[0]?.id)
    const activeIlaka = ilakas.find(i => i.id === activeTab) || ilakas[0]
    const t = useI18n()

    if (ilakas.length === 0) return null

    return (
        <div className="md:flex md:space-x-4">
            <ul className="flex flex-col space-y-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 md:mb-0 w-full md:w-64 shrink-0">
                {ilakas.map((ilaka) => {
                    const isActive = activeTab === ilaka.id
                    return (
                        <li key={ilaka.id}>
                            <button
                                onClick={() => setActiveTab(ilaka.id)}
                                className={`inline-flex items-center px-4 py-3 rounded-lg w-full transition-colors text-left ${isActive
                                    ? 'text-white bg-red-900 dark:bg-red-800'
                                    : 'hover:text-gray-900 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white'
                                    }`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {ilaka.name}
                            </button>
                        </li>
                    )
                })}
            </ul>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg w-full min-h-[300px] flex flex-col justify-between">
                {activeIlaka && (
                    <>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{activeIlaka.name} Details</h3>
                            <p className="mb-4 text-lg">{activeIlaka.description}</p>
                        </div>
                        <div className='flex justify-end'>
                            <Link href={`/ilakas/${activeIlaka.slug}`} className="bg-red-900 text-white px-6 py-2 rounded-lg mt-4 font-semibold hover:bg-red-800 transition-colors">
                                {t('ilaka.viewFullDetails')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
