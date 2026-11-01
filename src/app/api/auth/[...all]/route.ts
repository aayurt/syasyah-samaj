import { getPayload } from 'payload'
import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import type { PayloadWithAuth } from '@delmaredigital/payload-better-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = (await getPayload({ config })) as PayloadWithAuth
    if (!payload?.betterAuth) {
      console.error('[auth] betterAuth not initialized on payload')
      return NextResponse.json({ error: 'Auth not initialized' }, { status: 500 })
    }
    return await payload.betterAuth.handler(request)
  } catch (err: any) {
    console.error('[auth] Error handling GET:', err)
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await getPayload({ config })) as PayloadWithAuth
    if (!payload?.betterAuth) {
      console.error('[auth] betterAuth not initialized on payload')
      return NextResponse.json({ error: 'Auth not initialized' }, { status: 500 })
    }
    return await payload.betterAuth.handler(request)
  } catch (err: any) {
    console.error('[auth] Error handling POST:', err)
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}

