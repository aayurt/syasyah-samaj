import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

const HOST = process.env.HOST || 'http://localhost:3100'

async function main() {
  const payload = await getPayload({ config })

  console.log('--- findGlobal billing-settings depth=1 ---')
  try {
    const g = await payload.findGlobal({ slug: 'billing-settings', depth: 1 })
    console.log('OK', JSON.stringify(g).slice(0, 300))
  } catch (e) {
    console.log('ERROR:', e.message)
    console.log(e.stack)
  }

  console.log('--- find membership-types where tenant=2 ---')
  try {
    const c = await payload.find({
      collection: 'membership-types',
      limit: 100,
      depth: 0,
      sort: 'name',
      where: { tenant: { equals: 2 } },
    })
    console.log('OK totalDocs=', c.totalDocs, 'docs=', c.docs.length)
  } catch (e) {
    console.log('ERROR:', e.message)
    console.log(e.stack)
  }

  process.exit(0)
}

main()
