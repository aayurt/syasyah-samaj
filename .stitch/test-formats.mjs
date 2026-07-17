import { StitchToolClient } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300_000,
})

async function main() {
  const projectIdNum = '17697569883181758760'
  const projectIdFull = 'projects/17697569883181758760'

  // Try different formats
  for (const pid of [projectIdNum, projectIdFull]) {
    try {
      console.log(`\nTrying projectId: "${pid}"`)
      const screens = await client.callTool('list_screens', { projectId: pid })
      console.log('Success!', JSON.stringify(screens, null, 2).slice(0, 300))
    } catch (e) {
      console.log('Failed:', e.message.slice(0, 100))
    }
  }

  // Try generating with very short prompt on the full project ID format
  try {
    const screen = await client.callTool('generate_screen_from_text', {
      projectId: projectIdFull,
      prompt: 'Media library page with a grid of image thumbnails and upload button.',
      deviceType: 'DESKTOP',
    })
    console.log('\nMedia generated!', screen.screenId || screen.id)
  } catch (e) {
    console.log('\nMedia failed:', e.message.slice(0, 100))
  }
}

main().catch(console.error)
