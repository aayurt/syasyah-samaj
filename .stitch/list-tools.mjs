import { StitchToolClient } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 120_000,
})

async function main() {
  const tools = await client.listTools()
  console.log(JSON.stringify(tools, null, 2))
}

main().catch(console.error)
