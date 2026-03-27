import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'
import { cache } from 'react'


import { LivePreviewListener } from '@/components/LivePreviewListener'
import { generateMeta } from '@/utilities/generateMeta'
import { locales } from '@/locales/config'
import { getI18n, setStaticParamsLocale } from '@/locales/server'
import { Media } from '@/components/Media'
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react'
import Link from 'next/link'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const tenants = await payload.find({
    collection: 'tenants',
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = locales.flatMap((locale) => {
    return tenants.docs.map(({ slug }) => {
      return { slug, locale }
    })
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
    locale: string
  }>
}

export default async function IlakaPage({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '', locale } = await paramsPromise
  setStaticParamsLocale(locale)
  const t = await getI18n()
  const url = '/ilakas/' + slug
  const ilaka = await queryIlakaBySlug({ slug, locale })

  if (!ilaka) return <PayloadRedirects url={url} />

  return (
    <article className="pt-16 pb-16">
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <div className="container mx-auto px-4">
        <div className="mb-8">
          <Link href="/ilakas" className="inline-flex items-center gap-2 text-red-900 dark:text-red-400 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            {t('ilaka.backToAll')}
          </Link>
        </div>

        <div className="bg-white dark:bg-card rounded-3xl overflow-hidden border border-border shadow-sm mb-12">
          <div className="relative h-[40vh] md:h-[50vh] lg:h-[70vh] overflow-hidden bg-red-900/10">
            {(() => {
              const firstGalleryItem = ilaka.gallery?.[0]
              if (firstGalleryItem?.image && typeof firstGalleryItem.image !== 'string') {
                return <Media resource={firstGalleryItem.image} className="w-full h-full object-cover object-center" />
              }
              return (
                <div className="w-full h-full flex items-center justify-center text-red-900/20">
                  <span className="text-6xl font-bold">{t('brand')}</span>
                </div>
              )
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8 md:p-12">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                {ilaka.name}
              </h1>
              <div className="flex flex-wrap gap-6 text-white/90">
                {ilaka.contactInfo?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 shrink-0" />
                    <a href={`mailto:${ilaka.contactInfo.email}`} className="hover:underline break-all">
                      {ilaka.contactInfo.email}
                    </a>
                  </div>
                )}
                {ilaka.contactInfo?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 shrink-0" />
                    <a href={`tel:${ilaka.contactInfo.phone}`} className="hover:underline">
                      {ilaka.contactInfo.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {ilaka.gallery && ilaka.gallery.length > 1 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-red-900 dark:text-slate-50 mb-6">{t('ilaka.gallery')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ilaka.gallery.slice(1).map((item, index) => (
                <div key={item.id || index} className="relative aspect-square rounded-xl overflow-hidden border border-border hover:shadow-md transition-all group">
                  {item.image && typeof item.image !== 'string' && (
                    <Media resource={item.image} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional information or related events/posts could go here */}
        <div className="prose dark:prose-invert max-w-none mb-12">
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {ilaka.description}
          </p>
        </div>

        {ilaka.location && (ilaka.location.address || ilaka.location.mapUrl || (ilaka.location.latitude && ilaka.location.longitude)) && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-red-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              {t('ilaka.location')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* <div className="lg:col-span-1 space-y-6">
                {ilaka.location.address && (
                  <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Address</h3>
                    <p className="text-gray-600 dark:text-gray-400">{ilaka.location.address}</p>
                  </div>
                )}
                <div className="bg-white dark:bg-card p-6 rounded-2xl border border-border shadow-sm">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">Get Directions</h3>
                  <a
                    href={ilaka.location.mapUrl || `https://www.google.com/maps/search/?api=1&query=${ilaka.location.latitude},${ilaka.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full px-6 py-3 bg-red-900 text-white rounded-xl font-bold hover:bg-red-800 transition-colors gap-2"
                  >
                    <MapPin className="w-5 h-5" />
                    Open in Google Maps
                  </a>
                </div>
              </div> */}
              <div className="lg:col-span-2">
                <div className="h-[400px] w-full rounded-3xl overflow-hidden border border-border shadow-sm bg-gray-100 dark:bg-gray-800">
                  {ilaka.location.mapUrl && ilaka.location.mapUrl.includes('google.com/maps/embed') ? (
                    <iframe
                      src={ilaka.location.mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title={`${ilaka.name} Location Map`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                      <MapPin className="w-12 h-12 text-red-900/40 mb-4" />
                      <p className="text-gray-500">
                        {ilaka.location.address || t('ilaka.locationProvided')}
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        {t('ilaka.openInMaps')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '', locale } = await paramsPromise
  setStaticParamsLocale(locale)
  const ilaka = await queryIlakaBySlug({ slug, locale })

  if (!ilaka) return {}

  return generateMeta({ doc: ilaka })
}

const queryIlakaBySlug = cache(async ({ slug, locale }: { slug: string; locale: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'tenants',
    limit: 1,
    overrideAccess: false,
    pagination: false,
    locale: locale as 'en' | 'ne' | 'new',
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
