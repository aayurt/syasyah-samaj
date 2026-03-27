import { HeaderClient } from './Component.client'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Header } from '@/payload-types'
import { getCurrentLocale } from '@/locales/server'

export async function Header() {
  const locale = await getCurrentLocale()
  const headerData: Header = await getCachedGlobal('header', 1, locale as 'en' | 'ne')()
  console.log("HeaderData", headerData)
  return <HeaderClient data={headerData} />
}
