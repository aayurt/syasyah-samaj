'use client'

import { Media } from '@/components/Media'
import { useI18n } from '@/locales/client'
import { Tenant } from '@/payload-types'
import Link from 'next/link'
import { useState } from 'react'



export function IlakaTabs({ ilakas }: { ilakas: Tenant[] }) {
    const t = useI18n()
    const [activeTab, setActiveTab] = useState(ilakas.find(i => i.id === 3)?.id)
    const activeIlaka = ilakas.find(i => i.id === activeTab) || ilakas[0]

    if (ilakas.length === 0) return null

    return (
        <div className="md:flex md:space-x-4">
            <ul className="flex flex-col space-y-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 md:mb-0 w-full md:w-64 shrink-0">
                {ilakas.filter(i => (i.id !== 2)).map((ilaka) => {
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
                            {(
                                activeIlaka.coverImage ? <Media
                                    resource={activeIlaka.coverImage}
                                    className="w-full h-60 object-cover rounded-lg mb-4"
                                />
                                    : <img
                                        src={'https://images.unsplash.com/photo-1611516491426-03025e6043c8?q=80&w=2233&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'}
                                        alt={activeIlaka.name}
                                        className="w-full h-60 object-cover rounded-lg mb-4"
                                    />
                            )}
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{activeIlaka.name}</h3>
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
