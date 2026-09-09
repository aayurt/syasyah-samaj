import React, { createContext, useContext, useState } from 'react'
import { en } from './i18n/en'
import { ne } from './i18n/ne'

export type Lang = 'en' | 'ne'

const STORAGE_KEY = 'ui-lang'
const DEFAULT_LANG: Lang = 'ne'

type LangContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'ne') return stored
    } catch {
      /* localStorage unavailable — fall through */
    }
    return DEFAULT_LANG
  })

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable — context still updates */
    }
    window.dispatchEvent(new CustomEvent<Lang>('ui-lang-changed', { detail: next }))
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang(): LangContextValue {
  return useContext(LangContext)
}

/**
 * useT() — translate a key path.
 *
 * Usage:
 *   const t = useT()
 *   t('nav.dashboard')            → current lang string
 *   t('nav.dashboard', 'Dashboard') → fallback if key missing in current lang
 *
 * Key path syntax: top-level namespace, then dot-separated path within it.
 *   e.g. 'common.save', 'status.draft', 'settings.language'
 *
 * Fallback order:
 *   1. current-lang dictionary[namespace][path]
 *   2. fallback argument (if given)
 *   3. English dictionary[namespace][path]
 *   4. reconstructed key (e.g. 'nav.dashboard' → 'nav.dashboard' itself)
 */
export function useT() {
  const { lang } = useLang()
  const dict = lang === 'ne' ? ne : en

  return (key: string, fallback?: string): string => {
    // Split key into namespace + path (first dot separates them)
    const dotIdx = key.indexOf('.')
    if (dotIdx < 0) {
      // No namespace — try as top-level key directly
      const current = (dict as Record<string, unknown>)[key]
      if (typeof current === 'string') return current
      if (fallback) return fallback
      const enVal = (en as Record<string, unknown>)[key]
      if (typeof enVal === 'string') return enVal
      return key
    }

    const ns = key.slice(0, dotIdx) as keyof typeof dict
    const path = key.slice(dotIdx + 1)
    const nsDict = dict[ns]
    if (!nsDict || typeof nsDict !== 'object') {
      if (fallback) return fallback
      const enNs = en[ns]
      if (enNs && typeof enNs === 'object') {
        const enVal = (enNs as Record<string, unknown>)[path]
        if (typeof enVal === 'string') return enVal
      }
      return key
    }

    // Navigate the path through the nested dict
    const segments = path.split('.')
    let val: unknown = nsDict
    for (const seg of segments) {
      if (val && typeof val === 'object' && seg in val) {
        val = (val as Record<string, unknown>)[seg]
      } else {
        val = undefined
        break
      }
    }

    if (typeof val === 'string') return val
    if (fallback) return fallback

    // Fallback to English
    const enNs = en[ns]
    if (enNs && typeof enNs === 'object') {
      let enVal: unknown = enNs
      for (const seg of segments) {
        if (enVal && typeof enVal === 'object' && seg in enVal) {
          enVal = (enVal as Record<string, unknown>)[seg]
        } else {
          enVal = undefined
          break
        }
      }
      if (typeof enVal === 'string') return enVal
    }

    return key
  }
}
