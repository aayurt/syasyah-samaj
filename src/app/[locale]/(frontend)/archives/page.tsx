import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Media } from '@/components/Media'

export default async function ArchivesPage() {
  const payload = await getPayload({ config })

  const archives = await payload.find({
    collection: 'archives',
    limit: 100,
    sort: '-year',
  })

  return (
    <div className="container mx-auto py-20 px-4">
      <div className="max-w-3xl mb-16">
        <h1 className="text-5xl font-black tracking-tight mb-6">Historical Archives</h1>
        <p className="text-xl text-muted-foreground">Preserving our community heritage and history for future generations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {archives.docs.map((item: any) => (
          <div key={item.id} className="group cursor-pointer">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-6 shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:-translate-y-2">
              {item.heroImage ? (
                <Media resource={item.heroImage} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">No Image</div>
              )}
              <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-xs font-bold text-black shadow-sm">
                {item.era || item.year}
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
            <p className="text-muted-foreground line-clamp-2">{item.year ? `Year: ${item.year}` : ''}</p>
          </div>
        ))}

        {archives.docs.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl">
            <p className="text-xl text-muted-foreground">No historical records found yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  )
}
