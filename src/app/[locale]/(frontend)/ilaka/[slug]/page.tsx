import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { Media } from '@/components/Media'

export default async function IlakaDashboard({ params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const { slug } = await paramsPromise
  const payload = await getPayload({ config })

  const tenantRes = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
  })

  const ilaka = tenantRes.docs[0]

  if (!ilaka) {
    return notFound()
  }

  const events = await payload.find({
    collection: 'events',
    where: { tenant: { equals: ilaka.id } },
    limit: 3,
  })

  const posts = await payload.find({
    collection: 'posts',
    where: { tenant: { equals: ilaka.id } },
    limit: 3,
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[40vh] w-full overflow-hidden">
        {ilaka.coverImage && (
          <Media resource={ilaka.coverImage} fill className="object-cover" />
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h1 className="text-5xl font-bold mb-4">{ilaka.name}</h1>
            <p className="text-xl max-w-2xl mx-auto">{ilaka.description}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-12">
            <section>
              <h2 className="text-3xl font-semibold mb-6 border-b pb-2">Latest Updates</h2>
              <div className="grid gap-6">
                {posts.docs.map((post: any) => (
                  <div key={post.id} className="flex gap-4 items-start p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="w-24 h-24 relative rounded overflow-hidden flex-shrink-0">
                      {post.heroImage && <Media resource={post.heroImage} fill className="object-cover" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{post.title}</h3>
                      <p className="text-muted-foreground line-clamp-2">{post.meta?.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
                <h2 className="text-3xl font-semibold mb-6 border-b pb-2">Archives & History</h2>
                <p className="text-muted-foreground">Discover the rich history and cultural heritage of {ilaka.name}.</p>
                {/* Historical content placeholder */}
                <div className="mt-4 p-8 bg-muted rounded-xl text-center italic">
                    Historical records for this Ilaka are currently being digitized.
                </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="p-6 rounded-xl border bg-card shadow-sm">
              <h3 className="text-xl font-bold mb-4">Upcoming Events</h3>
              <div className="space-y-4">
                {events.docs.length > 0 ? events.docs.map((event: any) => (
                  <div key={event.id} className="p-3 border-l-4 border-primary bg-muted/30">
                    <div className="text-xs font-bold text-primary mb-1">
                      {new Date(event.startDatetime).toLocaleDateString()}
                    </div>
                    <div className="font-medium">{event.title}</div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No upcoming events.</p>
                )}
              </div>
            </div>

            <div className="p-6 rounded-xl border bg-card shadow-sm">
              <h3 className="text-xl font-bold mb-4">Location</h3>
              {ilaka.location?.mapUrl && (
                <div className="aspect-square w-full rounded-lg overflow-hidden border">
                   <iframe
                    src={ilaka.location.mapUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              )}
              <div className="mt-4 text-sm">
                <p className="font-medium">{ilaka.location?.address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
