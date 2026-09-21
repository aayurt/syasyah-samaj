import React from 'react'
import { getI18n, getCurrentLocale } from '@/locales/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { Media } from '@/components/Media'
import { ArrowRight, MapPin, Users, Phone, Sparkles } from 'lucide-react'
import { generateMeta } from '@/utilities/generateMeta'
import { Metadata } from 'next'
import { getStaticParams, setStaticParamsLocale } from '@/locales/server'
import { ilakas24Data } from '@/lib/ilakaData'

const fallbackImages = [
  'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1582650625119-3a31f8418bb9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
]

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
  const locale = localeParam || (await getCurrentLocale())
  const t = await getI18n()

  const { docs: ilakas } = await payload.find({
    collection: 'tenants',
    locale: locale as 'en' | 'ne' | 'new',
    limit: 100,
    where: {
      enabled: {
        equals: true,
      },
      domain: {
        not_equals: null,
      },
    },
  })

  return (
    <div className="pt-16 pb-24 bg-background text-foreground min-h-screen">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{locale === 'en' ? '24 Neighborhood Secretariats' : '२४ इलाका सचिवालय निर्देशिका'}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight text-foreground">
            {t('home.ilakas' as any, { count: 0 })}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {t('home.ilakasDescription' as any, { count: 0 })}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ilakas.map((ilaka, idx) => {
            const fallbackImg = fallbackImages[idx % fallbackImages.length]
            const mockData = ilakas24Data.find((d) => d.slug === ilaka.slug) || ilakas24Data[idx % ilakas24Data.length]

            return (
              <Link
                key={ilaka.id}
                href={`/ilakas/${ilaka.slug}`}
                className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-56 overflow-hidden bg-muted">
                    {(() => {
                      const firstGalleryItem = ilaka.gallery?.[0]
                      if (firstGalleryItem?.image && typeof firstGalleryItem.image !== 'string') {
                        return (
                          <Media
                            resource={firstGalleryItem.image}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )
                      }
                      return (
                        <img
                          src={ilaka.coverImage && typeof ilaka.coverImage === 'object' && (ilaka.coverImage as any).url ? (ilaka.coverImage as any).url : fallbackImg}
                          alt={ilaka.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      )
                    })()}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <div className="absolute top-3.5 left-3.5 bg-primary text-primary-foreground text-xs font-mono font-bold px-2.5 py-1 rounded-md shadow-xs">
                      {ilaka.code || `IL0${(idx % 24) + 1}`}
                    </div>

                    <div className="absolute bottom-3 left-3 text-white text-xs font-medium flex items-center gap-1.5 drop-shadow-sm">
                      <MapPin className="w-3.5 h-3.5 text-amber-300" />
                      <span>{ilaka.location?.address || mockData?.addressNe || 'पाटन, ललितपुर'}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="text-xl sm:text-2xl font-serif font-bold group-hover:text-primary transition-colors text-card-foreground">
                      {ilaka.name}
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-3">
                      {ilaka.description || (locale === 'en' ? 'Community secretariat dedicated to heritage preservation, youth activities, and family welfare in Lalitpur.' : 'ललितपुरमा सांस्कृतिक सम्पदा संरक्षण, युवा सहभागिता र पारिवारिक कल्याणमा समर्पित इलाका।')}
                    </p>

                    {/* Coordinator Contact Strip */}
                    <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-medium block">
                          {locale === 'en' ? 'Coordinator' : 'संयोजक'}
                        </span>
                        <span className="font-bold text-card-foreground">
                          {locale === 'en' ? mockData?.coordinator.nameEn : mockData?.coordinator.nameNe}
                        </span>
                      </div>
                      <span className="text-primary font-mono font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{mockData?.coordinator.phone}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0 border-t border-border mt-4 flex items-center justify-between text-xs font-semibold text-primary">
                  <span>{t('ilaka.viewDetails')}</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>

        {ilakas.length === 0 && (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border p-8">
            <p className="text-muted-foreground text-sm">{t('ilaka.noIlakasFound')}</p>
          </div>
        )}
      </div>

    </div>
  )
}
