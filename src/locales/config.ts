export const locales = ['en', 'ne', 'new'] as const
export type Locale = (typeof locales)[number]

const LOCALES = {
  EN_US: 'en' as const,
  NE_NE: 'ne' as const,
  NE_NEW: 'new' as const,
}

export const defaultLocale = 'en'

export const localesPathMap = {
  en: () => import('../../locales/translations/gen/en.json'),
  ne: () => import('../../locales/translations/gen/ne.json'),
  new: () => import('../../locales/translations/gen/new.json'),
}
