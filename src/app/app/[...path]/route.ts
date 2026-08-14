import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { distRoot } from '../distPath'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function contentType(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  const root = distRoot()

  // Normalize the requested path and guard against traversal.
  const rel = segments.join('/')
  const file = path.normalize(path.join(root, rel))
  if (!file.startsWith(root)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const body = await readFile(file)
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType(file),
        // Hashed build assets are immutable; everything else revalidates.
        'Cache-Control': /\/assets\//.test(file)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      },
    })
  } catch {
    // A missing build asset is a real 404 (hashed names — never a client
    // route); only non-asset paths fall through to the SPA index.
    if (rel.startsWith('assets/')) {
      return new NextResponse('Not Found', { status: 404 })
    }
    // Not a real file → SPA fallback to index.html (client-side routing).
    try {
      const body = await readFile(path.join(root, 'index.html'))
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      })
    } catch {
      return new NextResponse(
        'Billing web app not built. Run `pnpm --dir apps/billing build` first.',
        { status: 503 },
      )
    }
  }
}
