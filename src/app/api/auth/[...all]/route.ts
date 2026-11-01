import { getPayload } from 'payload'
import config from '@payload-config'
import type { NextRequest } from 'next/server'
import type { PayloadWithAuth } from '@delmaredigital/payload-better-auth'

export async function GET(request: NextRequest) {
  const payload = (await getPayload({ config })) as PayloadWithAuth
  return payload.betterAuth.handler(request)
}

export async function POST(request: NextRequest) {
  const payload = (await getPayload({ config })) as PayloadWithAuth
  return payload.betterAuth.handler(request)
}
