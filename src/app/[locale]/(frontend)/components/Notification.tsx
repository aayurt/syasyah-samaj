'use client'

import { useI18n } from '@/locales/client'
import { useState, useEffect } from 'react'
import { X, Info } from 'lucide-react'

const NOTIFICATION_KEY = 'syasyah_samaj_notification_dismissed'

export default function Notification() {
    const t = useI18n()
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Check if the notification was previously dismissed
        const isDismissed = localStorage.getItem(NOTIFICATION_KEY)
        if (!isDismissed) {
            setIsVisible(true)
        }
    }, [])

    const handleDismiss = () => {
        localStorage.setItem(NOTIFICATION_KEY, 'true')
        setIsVisible(false)
    }

    if (!isVisible) return null

    return (
        <div
            role="alert"
            aria-live="polite"
            className="bg-red-900 text-white py-3 px-4 relative transition-all duration-300 ease-in-out"
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* <div className="hidden sm:flex items-center justify-center bg-white/20 p-1 rounded-full">
                        <Info size={16} className="text-white" />
                    </div> */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <div className='flex items-center'>
                            <span className="inline-flex items-center self-start font-bold bg-white text-red-900 px-2 py-0.5 rounded text-[10px] md:text-xs uppercase tracking-wider">
                                INFO
                            </span>
                        </div>
                        <div>
                            <p className="text-sm text-center md:text-base font-medium leading-tight">
                                {t('notification')}
                            </p>
                            <p className="text-sm text-center md:text-base font-small leading-tight">{t('contact')}: aayurtshrestha@gmail.com</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="hover:bg-red-800 p-1.5 rounded-full transition-all duration-200 ml-4 focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label="Close notification"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    )
}
