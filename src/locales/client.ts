'use client'
import { createI18nClient } from 'next-international/client'
import { localesPathMap } from './config'

const client = createI18nClient(localesPathMap)

export const useI18n = client.useI18n
export const useScopedI18n = client.useScopedI18n
export const I18nProviderClient = client.I18nProviderClient
export const useCurrentLocale = client.useCurrentLocale
export const useChangeLocale = client.useChangeLocale
