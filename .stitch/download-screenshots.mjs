import { StitchToolClient } from '@google/stitch-sdk'
import fs from 'fs'
import path from 'path'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 120_000,
})

const PROJECT_ID = '17697569883181758760'
const OUT_DIR = '.stitch/screenshots'

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const result = await client.callTool('list_screens', { projectId: PROJECT_ID })
  const screens = result.screens || []

  for (const sc of screens) {
    const imgUrl = sc.screenshot?.downloadUrl
    const htmlUrl = sc.htmlCode?.downloadUrl
    const title = (sc.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_')

    if (imgUrl) {
      const resp = await fetch(imgUrl)
      const buffer = Buffer.from(await resp.arrayBuffer())
      const ext = resp.headers.get('content-type')?.includes('png') ? 'png' : 'jpg'
      const fpath = path.join(OUT_DIR, `${title}.${ext}`)
      fs.writeFileSync(fpath, buffer)
      console.log(`Saved: ${fpath} (${(buffer.length / 1024).toFixed(0)}KB)`)
    }

    if (htmlUrl) {
      // Also try downloading HTML
      try {
        const resp = await fetch(htmlUrl)
        const html = await resp.text()
        const fpath = path.join(OUT_DIR, `${title}.html`)
        fs.writeFileSync(fpath, html)
        console.log(`Saved: ${fpath}`)
      } catch {}
    }
    console.log()
  }
}

main().catch(console.error)
