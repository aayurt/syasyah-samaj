import { createI18nServer } from 'next-international/server'
import { localesPathMap } from './config'

export const { getI18n, getScopedI18n, getStaticParams, getCurrentLocale } =
  createI18nServer(localesPathMap)
