import { createI18nMiddleware } from 'next-international/middleware'
import { NextRequest } from 'next/server'
import { locales, defaultLocale } from './locales/config'

const I18nMiddleware = createI18nMiddleware({
  locales,
  defaultLocale,
})

export function middleware(request: NextRequest) {
  console.log('Middleware Path:', request.nextUrl.pathname)
  return I18nMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next|admin).*)'],
}
