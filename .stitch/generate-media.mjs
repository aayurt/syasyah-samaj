import { StitchToolClient, Stitch } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300_000,
})

const sdk = new Stitch(client)

async function main() {
  // Get project by listing
  const result = await client.callTool('list_projects', {})
  const project = result.projects?.find(p => p.title === 'Syasyah Samaj - Admin Panel')
  if (!project) {
    console.error('Project not found. Available projects:', result.projects?.map(p => p.title))
    return
  }

  const projectId = project.name
  console.log('Using project:', projectId)

  // Generate media screen
  const screen = await client.callTool('generate_screen_from_text', {
    projectId,
    prompt: 'Media library page for Syasyah Samaj admin. Left sidebar with Media highlighted. Top bar with Media heading and Upload button. Upload zone with dashed border. Grid of thumbnails with image previews. Clean white background.',
    deviceType: 'DESKTOP',
  })
  const screenId = screen.screenId || screen.id
  console.log('Media Library:', screenId)

  // Get the screenshot
  const screenDetail = await client.callTool('get_screen', { projectId, screenId })
  console.log('Screenshot URL:', screenDetail.screenshot?.downloadUrl || 'N/A')
}

main().catch(console.error)
