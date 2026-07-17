import { StitchToolClient } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 120_000,
})

const PROJECT_ID = '17697569883181758760'

async function main() {
  const result = await client.callTool('list_screens', { projectId: PROJECT_ID })
  const screens = result.screens || []
  console.log(`Found ${screens.length} screens\n`)

  for (let i = 0; i < screens.length; i++) {
    const sc = screens[i]
    const sid = sc.screenId || sc.id || sc.name?.split('/').pop()
    console.log(`Screen ${i + 1}: ${sid}`)
    if (sc.screenshot?.downloadUrl) {
      console.log(`  Image: ${sc.screenshot.downloadUrl}`)
    }
    if (sc.htmlCode?.downloadUrl) {
      console.log(`  HTML: ${sc.htmlCode.downloadUrl}`)
    }
    if (sc.title) {
      console.log(`  Title: ${sc.title}`)
    }
    console.log()
  }
}

main().catch(console.error)
