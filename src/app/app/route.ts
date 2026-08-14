import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { distRoot } from './distPath'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const body = await readFile(path.join(distRoot(), 'index.html'))
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
