/**
 * Temporary: create the local 'default' tenant (the Users hook requires one
 * with slug 'default') for the end-to-end order-flow check.
 */
process.env.RESEND_API_KEY ||= 're_test'
process.env.PAYLOAD_SECRET ||= 'test-secret-key-for-ci'

const { default: config } = await import('../src/payload.config')
const { getPayload } = await import('payload')
const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'default' } },
  limit: 1,
})

if (existing.docs.length > 0) {
  console.log('TENANT_ALREADY_EXISTS', existing.docs[0].id)
} else {
  const created = await payload.create({
    collection: 'tenants',
    data: {
      name: 'Central Office',
      code: 'C00',
      slug: 'default',
      type: 'central',
      active: true,
    },
  })
  console.log('TENANT_CREATED', created.id)
}
process.exit(0)
