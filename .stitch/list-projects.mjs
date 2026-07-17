import { StitchToolClient, Stitch } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300_000,
})

const sdk = new Stitch(client)

async function main() {
  // Use list_projects to find all projects
  const result = await client.callTool('list_projects', {})
  console.log('Project count:', result.projects?.length)
  for (const p of result.projects || []) {
    console.log(`  ${p.name}: "${p.title}"`)
  }
}

main().catch(console.error)
