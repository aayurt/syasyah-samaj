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
import React, { useTransition } from 'react'
import { Loader2 } from 'lucide-react'

export const LanguageSwitcher: React.FC = () => {
    const locale = useCurrentLocale()
    const changeLocale = useChangeLocale()
    const [isPending, startTransition] = useTransition()

    const labels: Record<string, string> = {
        en: 'English',
        ne: 'नेपाली',
        new: 'नेवारी',
    }

    const handleLanguageChange = (val: string) => {
        startTransition(() => {
            (changeLocale as (l: string) => void)(val)
        })
    }

    return (
        <Select
            value={locale}
            onValueChange={handleLanguageChange}
            disabled={isPending}
        >
            <SelectTrigger className="w-[110px] h-9 border-none bg-transparent hover:bg-accent hover:text-accent-foreground focus:ring-0 relative">
                {isPending ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-red-900 dark:text-red-400" />
                        <span className="text-xs font-medium">Wait...</span>
                    </div>
                ) : (
                    <SelectValue placeholder="Language" />
                )}
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
