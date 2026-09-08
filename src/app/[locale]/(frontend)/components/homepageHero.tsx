import { getI18n } from "@/locales/server"
import { getPayload } from "payload"
import configPromise from "@/payload.config"
import { getCurrentLocale } from "@/locales/server"
import { headers } from "next/headers"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
    locale: locale as 'en' | 'ne' | 'new',
  })
  const tenant = tenants[0]
  if (!tenant) return <></>

  return (
    <section className="bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground min-h-screen relative">
      <div className="relative min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-32 text-center flex flex-col justify-center items-center min-h-screen">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.homepageWelcome') + ' ' + (tenant.name === "default" ? "" : tenant.name)}</h1>
          <p className="text-lg md:text-xl mb-6 text-primary-foreground/80">
            {t('home.homepageWelcomeDescription')}
          </p>
          <Button asChild size="lg" className="bg-yellow-500 text-black hover:bg-yellow-400">
            <Link href="/members">
              {t('home.joinCommunity')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
