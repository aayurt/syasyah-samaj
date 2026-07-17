import { StitchToolClient } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300_000,
})

const NAMES = ['Dashboard', 'Posts List', 'Post Editor', 'Events List', 'Event Editor', 'Members Directory', 'Media Library']
const PROJECT_ID = '17697569883181758760'

async function main() {
  // List all screens
  const result = await client.callTool('list_screens', { projectId: PROJECT_ID })
  const screens = result.screens || []

  console.log(`Found ${screens.length} screens\n`)

  // Get details for each to find which is which
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i]
    const screenId = screen.screenId || screen.id || screen.name?.split('/').pop()
    try {
      const detail = await client.callTool('get_screen', {
        projectId: PROJECT_ID,
        screenId,
      })
      const imgUrl = detail.screenshot?.downloadUrl || 'N/A'
      const name = NAMES[i] || `Screen ${i + 1}`
      console.log(`## ${name}`)
      console.log(`ID: ${screenId}`)
      console.log(`Image: ${imgUrl}`)
      console.log()
    } catch (e) {
      console.log(`Screen ${i + 1} (${screenId}): Error - ${e.message}`)
    }
  }

  // Try to generate the missing Media Library
  console.log('--- Generating Media Library ---')
  try {
    const screen = await client.callTool('generate_screen_from_text', {
      projectId: PROJECT_ID,
      prompt: 'Media library page with a grid of image thumbnails and an upload button. Clean white background.',
      deviceType: 'DESKTOP',
    })
    console.log('Success:', screen.screenId || screen.id)
    const detail = await client.callTool('get_screen', {
      projectId: PROJECT_ID,
      screenId: screen.screenId || screen.id,
    })
    console.log('Image URL:', detail.screenshot?.downloadUrl || 'N/A')
  } catch (e) {
    console.log('Failed:', e.message)
  }
}

main().catch(console.error)
