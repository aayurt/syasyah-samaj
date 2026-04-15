import { createI18nMiddleware } from 'next-international/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from './locales/config'

const I18nMiddleware = createI18nMiddleware({
  locales,
  defaultLocale,
})

const SUBDOMAIN_REGEX =
  /^(?<subdomain>[a-zA-Z0-9-]+)\.(?<domain>afnoevents\.com|localhost|syasyahsamaj\.com)$/
const MAIN_DOMAINS = ['afnoevents.com', 'syasyahsamaj.com', 'localhost:3000']

function extractSubdomain(host: string): string | null {
  if (MAIN_DOMAINS.includes(host)) {
    return null
  }

  const match = host.match(SUBDOMAIN_REGEX)
  return match?.groups?.subdomain || null
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const subdomain = extractSubdomain(host)

  if (subdomain) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-current-tenant', subdomain)

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    })

    response.cookies.set('current-tenant', subdomain, {
      path: '/',
      maxAge: 60 * 60 * 24,
      httpOnly: false,
    })

    return response
  }

  return I18nMiddleware(request)
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next|admin).*)'],
}
