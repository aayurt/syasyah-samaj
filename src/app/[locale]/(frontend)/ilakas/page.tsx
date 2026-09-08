import React from 'react'
import { getI18n, getCurrentLocale } from '@/locales/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { Media } from '@/components/Media'
import { ArrowRight, MapPin } from 'lucide-react'
import { generateMeta } from '@/utilities/generateMeta'
import { Metadata } from 'next'
import { getStaticParams, setStaticParamsLocale } from '@/locales/server'

export function generateStaticParams() {
  return getStaticParams()
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getI18n()
  return generateMeta({
    doc: {
      meta: {
        title: t('ilaka.metaTitle'),
        description: t('ilaka.metaDescription'),
      },
    },
  })
}

export default async function IlakasPage({ params: paramsPromise }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await paramsPromise
  setStaticParamsLocale(localeParam)
  const payload = await getPayload({ config: configPromise })
  const locale = localeParam || await getCurrentLocale()
  const t = await getI18n()

  const { docs: ilakas } = await payload.find({
    collection: 'tenants',
    locale: locale as 'en' | 'ne' | 'new',
    limit: 100,
    where: {
      enabled: {
        equals: true
      },
      domain: {
        not_equals: null
      }
    }
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container mx-auto px-4 mb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-6">
            {t('home.ilakas' as any, { count: 0 })}
          </h1>
          <p className="text-lg text-muted-foreground">
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
              className="group bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 flex flex-col h-full"
            >
              <div className="relative h-64 overflow-hidden bg-primary/10">
                {(() => {
                  const firstGalleryItem = ilaka.gallery?.[0]
                  if (firstGalleryItem?.image && typeof firstGalleryItem.image !== 'string') {
                    return <Media
                      resource={firstGalleryItem.image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  }
                  return (
                    <div className="w-full h-full flex items-center justify-center text-primary/20">
                      <span className="text-4xl font-bold">{t('brand')}</span>
                    </div>
                  )
                })()}
                <div className="absolute top-4 left-4 bg-background/90 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-primary flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {t('ilaka.badge')}
                </div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors text-foreground">
                  {ilaka.name}
                </h3>
                <p className="text-muted-foreground mb-6 flex-grow line-clamp-3">
                  {ilaka.description}
                </p>
                <div className="flex items-center text-primary font-semibold group-hover:translate-x-1 transition-transform">
                  {t('ilaka.viewDetails')} <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {ilakas.length === 0 && (
          <div className="text-center py-24 bg-muted rounded-3xl border border-dashed border-border">
            <p className="text-muted-foreground">{t('ilaka.noIlakasFound')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
