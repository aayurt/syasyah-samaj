'use client'

import Link from 'next/link'
import { useState } from 'react'

export function IlakaTabs() {
    const ilakas = [1, 2, 3, 4, 5, 6, 7]
    const [activeTab, setActiveTab] = useState(1)
    const hostname =
        typeof window !== "undefined" ? window.location.hostname : "";

    return (
        <div className="md:flex md:space-x-4">
            <ul className="flex flex-col space-y-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 md:mb-0 w-full md:w-64 shrink-0">
                {ilakas.map((ilaka) => {
                    const isActive = activeTab === ilaka
                    return (
                        <li key={ilaka}>
                            <button
                                onClick={() => setActiveTab(ilaka)}
                                className={`inline-flex items-center px-4 py-3 rounded-lg w-full transition-colors ${isActive
                                    ? 'text-white bg-red-900 dark:bg-red-800'
                                    : 'hover:text-gray-900 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white'
                                    }`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                Ilaka {ilaka}
                            </button>
                        </li>
                    )
                })}
            </ul>
            <div className="p-6 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg w-full min-h-[300px] flex flex-col justify-between">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Ilaka {activeTab} Details</h3>
                    <p className="mb-2">This is some placeholder content for the Ilaka {activeTab} tab. Clicking another tab will toggle the visibility of this one.</p>
                    <p>The tab JavaScript swaps classes to control the content visibility and styling dynamically.</p>
                </div>
                <div className='flex justify-end'>
                    <Link href={`https://illaka${activeTab}.${hostname}`} className="bg-red-900 text-white px-4 py-2 rounded-lg mt-4">Go to Ilaka {activeTab}</Link>
                </div>
            </div>
        </div>
    )
}
