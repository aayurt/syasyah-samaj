import { StitchToolClient, Stitch } from '@google/stitch-sdk'

const client = new StitchToolClient({
  apiKey: process.env.STITCH_API_KEY,
  timeout: 300_000,
})

const sdk = new Stitch(client)

const SCREENS = [
  {
    name: 'Dashboard',
    prompt: `Dashboard page for Syasyah Samaj community management admin.

LAYOUT:
Left sidebar: dark narrow column. At top: small logo + "Syasyah Samaj". Below: nav items with icons - Dashboard (active), Posts, Events, Members, Media. At bottom: user avatar + name.

Top bar: white, border-bottom. Left: "Dashboard". Right: search input + user avatar.

Main content: white bg, generous padding.
First row: 4 metric cards. Each has icon in colored circle, label, large number.
Second row: two columns. Left "Recent Posts" - 4 items with title, status badge, date. Right "Upcoming Events" - 4 items with title, date, location.

AESTHETIC: Clean Notion-style. Whitespace, minimal borders, professional.`,
  },
  {
    name: 'Posts List',
    prompt: `Posts list page for Syasyah Samaj admin.

Left sidebar: same as dashboard, "Posts" highlighted.

Top bar: "Posts" heading + "New Post" button (red).

Content: table with Title, Status (Published/Draft badges), Author, Updated. Filter bar with search and status dropdown. Pagination at bottom.

Clean Notion-style table. White bg, subtle borders, hover highlights.`,
  },
  {
    name: 'Post Editor',
    prompt: `Post editor for Syasyah Samaj admin. Notion-style document.

Left sidebar with "Posts" highlighted.

Top bar: "Posts / New Post" breadcrumb + "Save Draft" and "Publish" buttons.

Main: large title input (placeholder "Untitled"), below that an image upload area with dashed border and "Add cover image", then a large rich text area with placeholder "Start writing...".

Right sidebar panel (light gray): Status toggle, Publish date, Categories, Author, SEO preview.

Generous whitespace, clean typography, focused writing experience.`,
  },
  {
    name: 'Events List',
    prompt: `Events list for Syasyah Samaj admin.

Left sidebar with "Events" highlighted.

Top bar: "Events" heading + "New Event" button.

Grid of event cards (2 columns). Each card: cover image thumbnail, title, date range with calendar icon, location with pin icon, status badge (Upcoming/Ongoing/Past). Filter bar with search, status, date range.

Clean card layout, subtle shadows on hover. White bg.`,
  },
  {
    name: 'Event Editor',
    prompt: `Event editor for Syasyah Samaj admin.

Left sidebar with "Events" highlighted.

Two-column layout. Left (65%): title input, start/end datetime pickers, location fields, description textarea, rich text content.

Right panel (35%, light gray): cover image upload, tags multi-select, enable toggle, organizer selector.

Clean form design. Generous spacing.`,
  },
  {
    name: 'Members Directory',
    prompt: `Members directory for Syasyah Samaj admin. Read-only table.

Left sidebar with "Members" highlighted.

Top bar: "Members" heading + search.

Table: Avatar, Full Name, Email, Role badge (colored), Status badge (Active/Inactive dot), Joined Date, Phone. Sortable columns. Click row to expand details.

Clean professional table. White bg, subtle borders.`,
  },
  {
    name: 'Media Library',
    prompt: `Media library for Syasyah Samaj admin.

Left sidebar with "Media" highlighted.

Top bar: "Media" heading + "Upload" button.

Upload zone: dashed rectangle with cloud icon, "Drag & drop" text, "Browse" button.

Grid of thumbnails (4 columns). Each: image preview, filename, size, date. Hover shows overlay with Preview/Delete buttons. Click opens lightbox with larger preview and details.

Clean gallery layout. White bg.`,
  },
]

async function main() {
  // Use the SDK's createProject and wait a moment
  const project = await sdk.createProject('Syasyah Samaj - Admin Panel')
  console.log('Project created:', project.id)

  for (const { name, prompt } of SCREENS) {
    console.log(`\nGenerating ${name}...`)
    try {
      const screen = await project.generate(prompt, 'DESKTOP')
      const imageUrl = await screen.getImage()
      console.log(`${name}: ${screen.id} => ${imageUrl}`)
    } catch (e) {
      console.error(`${name}: Failed - ${e.message}`)
    }
  }

  console.log('\n=== Done ===')
}

main().catch(console.error)
