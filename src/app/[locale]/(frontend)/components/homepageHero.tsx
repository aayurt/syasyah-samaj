import { getI18n } from "@/locales/server"
import { getPayload } from "payload"
import configPromise from "@/payload.config"
import { getCurrentLocale } from "@/locales/server"
import { headers } from "next/headers"

export default async function HomepageHero() {
  const payload = await getPayload({ config: configPromise })
  const locale = await getCurrentLocale()
  const host = (await headers()).get('host') || ''
  const domain = host.split('.')[0]
  const t = await getI18n()
  const { docs: tenants } = await payload.find({
    collection: 'tenants',
    where: {
      domain: {
        equals: domain === 'localhost:3000' || domain === 'syasyahsamaj' ? null : domain,
      },
    },
    limit: 1,
    locale: locale as 'en' | 'ne',
  })
  const tenant = tenants[0]
  if (!tenant) return <></>

  return (
    <section className="bg-[url('https://images.unsplash.com/photo-1605640840605-14ac1855827b')] bg-cover bg-center text-white min-h-screen">
      <div className="bg-black/50 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-32 text-center flex flex-col justify-center items-center min-h-screen">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.homepageWelcome') + ' ' + (tenant.name === "default" ? "" : tenant.name)}</h1>
          <p className="text-lg md:text-xl mb-6">
            {t('home.homepageWelcomeDescription')}
          </p>
          <button className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-400">
            {t('home.joinCommunity')}
          </button>
        </div>
      </div>
    </section>
  )
}
