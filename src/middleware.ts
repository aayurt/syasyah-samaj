import { createI18nMiddleware } from 'next-international/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from './locales/config'

const I18nMiddleware = createI18nMiddleware({
  locales,
  defaultLocale,
})

const SUBDOMAIN_REGEX =
  /^(?<subdomain>[a-zA-Z0-9-]+)\.(?<domain>afnoevents\.com|localhost:\d+|syasyahsamaj\.com)$/
const MAIN_DOMAINS = ['afnoevents.com', 'syasyahsamaj.com', 'localhost:3000']

function extractSubdomain(host: string): string | null {
  if (MAIN_DOMAINS.includes(host)) {
    return null
  }

  const match = host.match(SUBDOMAIN_REGEX)
  return match?.groups?.subdomain || null
}

export async function middleware(request: NextRequest) {
  // CORS headers for cross-origin API requests from billing SPA (port 5174)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    const origin = request.headers.get('origin') || 'http://localhost:5174'
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookie, Accept, Origin, Referer, User-Agent'
    )
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

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
  // `app` (the billing SPA) is excluded: its routes are client-side and must
  // not be locale-redirected. `/api` routes are included so CORS headers are
  // applied for cross-origin billing SPA → API requests.
  matcher: ['/((?!api|static|auth|.*\\..*|_next|admin|app).*)', '/api/:path*'],
}
