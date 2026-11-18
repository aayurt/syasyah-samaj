// -------------------------------------------------------------------
// Polyfill browser-only APIs missing on Node 18 (the VPS runs v18.19.1).
// Some server dependencies (e.g. @smithy/fetch-http-handler) reference
// `File` / `FileReader` at module load time; without these globals the
// auth API routes 500 with `ReferenceError: File is not defined`.
// -------------------------------------------------------------------
if (typeof globalThis.File === 'undefined') {
  const BlobCtor = globalThis.Blob
  class File extends (BlobCtor as any) {
    declare readonly name: string
    declare readonly lastModified: number
    declare readonly lastModifiedDate: Date
    declare readonly webkitRelativePath: string
    constructor(bits?: any[], options?: { type?: string; lastModified?: number; name?: string }) {
      super(bits, options)
      this.name = options?.name ?? ''
      this.lastModified = options?.lastModified ?? Date.now()
      this.lastModifiedDate = new Date(this.lastModified)
      this.webkitRelativePath = ''
    }
  }
  globalThis.File = File as any
}
if (typeof globalThis.FileReader === 'undefined') {
  const UNSENT = 0, LOADING = 1, DONE = 2
  class FileReader {
    private _state = UNSENT
    result: string | ArrayBuffer | null = null
    error: DOMException | null = null
    get readyState() { return this._state }
    onloadstart: any = null
    onprogress: any = null
    onload: any = null
    onerror: any = null
    onabort: any = null
    onloadend: any = null
    readAsArrayBuffer(blob: Blob) {
      this._state = LOADING
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        this._state = DONE
        this.onloadend?.(null as any)
      }).catch((err) => {
        this.error = err
        this._state = DONE
        this.onerror?.(null as any)
        this.onloadend?.(null as any)
      })
    }
    readAsText(blob: Blob) {
      this._state = LOADING
      blob.text().then((text) => {
        this.result = text
        this._state = DONE
        this.onloadend?.(null as any)
      }).catch((err) => {
        this.error = err
        this._state = DONE
        this.onerror?.(null as any)
        this.onloadend?.(null as any)
      })
    }
    abort() { this._state = UNSENT }
  }
  globalThis.FileReader = FileReader as any
}

import { createI18nMiddleware } from 'next-international/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from './locales/config'

const I18nMiddleware = createI18nMiddleware({
  locales,
  defaultLocale,
})

const SUBDOMAIN_REGEX =
  /^(?<subdomain>[a-zA-Z0-9-]+)\.(?<domain>afnoevents\.com|localhost:\d+|syasyahsamaj\.com)$/
const MAIN_DOMAINS = ['afnoevents.com', 'syasyahsamaj.com', 'staging.syasyahsamaj.com', 'localhost:3000']

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
