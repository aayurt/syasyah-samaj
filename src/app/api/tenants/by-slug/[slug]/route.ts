import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'tenants',
      where: {
        slug: { equals: slug },
        enabled: { equals: true },
      },
      limit: 1,
    })

    if (!result.docs.length) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenant = result.docs[0]
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const name =
      typeof tenant.name === 'object' && tenant.name !== null
        ? (tenant.name as { en?: string }).en || String(tenant.name)
        : String(tenant.name || '')

    const coverImage = tenant.coverImage
      ? typeof tenant.coverImage === 'object' && 'url' in tenant.coverImage
        ? (tenant.coverImage as { url: string }).url
        : null
      : null

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name,
      description: tenant.description,
      coverImage,
    })
  } catch (error) {
    console.error('Tenant fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
