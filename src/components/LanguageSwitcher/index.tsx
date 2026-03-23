'use client'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useChangeLocale, useCurrentLocale } from '@/locales/client'
import { locales } from '@/locales/config'
import React from 'react'

export const LanguageSwitcher: React.FC = () => {
    const locale = useCurrentLocale()
    const changeLocale = useChangeLocale()

    const labels: Record<string, string> = {
        en: 'English',
        ne: 'नेपाली',
        new: 'नेवारी',
    }

    return (
        <Select value={locale} onValueChange={(val: string) => (changeLocale as (l: string) => void)(val)}>
            <SelectTrigger className="w-[110px] h-9 border-none bg-transparent hover:bg-accent hover:text-accent-foreground focus:ring-0">
                <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
                {locales.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                        {labels[loc] || loc.toUpperCase()}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
