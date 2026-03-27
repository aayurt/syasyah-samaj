import React from 'react'
import { getI18n, getCurrentLocale } from '@/locales/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { Media } from '@/components/Media'
import { ArrowRight, MapPin } from 'lucide-react'
import { generateMeta } from '@/utilities/generateMeta'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    doc: {
      meta: {
        title: 'Ilakas - Syasyah Samaj',
        description: 'Explore the different Ilakas committed to preserving Newar culture and traditions.',
      },
    },
  })
}

export default async function IlakasPage() {
  const payload = await getPayload({ config: configPromise })
  const locale = await getCurrentLocale()
  const t = await getI18n()

  const { docs: ilakas } = await payload.find({
    collection: 'tenants',
    locale: locale as 'en' | 'ne' | 'new',
    limit: 100,
    where: {
      enabled: {
        equals: true
      }
    }
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container mx-auto px-4 mb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-red-900 dark:text-slate-50 mb-6">
            {t('home.ilakas' as any, { count: 0 })}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t('home.ilakasDescription' as any, { count: 0 })}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ilakas.map((ilaka) => (
            <Link
              key={ilaka.id}
              href={`/ilakas/${ilaka.slug}`}
              className="group bg-white dark:bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 flex flex-col h-full"
            >
              <div className="relative h-64 overflow-hidden bg-red-900/10">
                {(() => {
                  const firstGalleryItem = ilaka.gallery?.[0]
                  if (firstGalleryItem?.image && typeof firstGalleryItem.image !== 'string') {
                    return <Media
                      resource={firstGalleryItem.image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  }
                  return (
                    <div className="w-full h-full flex items-center justify-center text-red-900/20">
                      <span className="text-4xl font-bold">SYASYAH</span>
                    </div>
                  )
                })()}
                <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-red-900 dark:text-red-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Ilaka
                </div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-bold mb-4 group-hover:text-red-900 dark:group-hover:text-red-400 transition-colors">
                  {ilaka.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 flex-grow line-clamp-3">
                  {ilaka.description}
                </p>
                <div className="flex items-center text-red-900 dark:text-red-400 font-semibold group-hover:translate-x-1 transition-transform">
                  View Details <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {ilakas.length === 0 && (
          <div className="text-center py-24 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-border">
            <p className="text-gray-500">No Ilakas found at the moment.</p>
          </div>
        )}
      </div>
    </div>
  )
}
