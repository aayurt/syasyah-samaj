import { createI18nServer, setStaticParamsLocale } from 'next-international/server'
import { localesPathMap } from './config'

export const { getI18n, getScopedI18n, getStaticParams, getCurrentLocale } =
  createI18nServer(localesPathMap)

export { setStaticParamsLocale }
