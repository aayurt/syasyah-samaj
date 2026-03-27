import { Gallery } from '@/components/Gallery'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Members from './components/Members'

import { getCurrentLocale, getI18n } from '@/locales/server'
import PastEvents from './components/Events/pastEvents'
import UpcomingEvents from './components/Events/upcomingEvents'
import Ilakas from './components/Ilakas'
import HomepageHero from './components/homepageHero'
import Hero from './components/Hero'
import { headers } from 'next/headers'

export default async function HomePage({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
  const payload = await getPayload({ config: configPromise })
  const t = await getI18n()
  const locale = propLocale || await getCurrentLocale()
  const host = (await headers()).get('host') || ''
  const domain = host.split('.')[0]

  const { docs: tenants } = await payload.find({
    collection: 'tenants',
    where: {
      domain: {
        equals: domain === 'localhost:3000' ? null : domain,
      },
    },
    limit: 1,
    locale: locale as 'en' | 'ne',
  })

  const tenant = tenants[0]

  if (!tenant) return null

  return (
    <div className="font-sans bg-white text-gray-900">
      <HomepageHero />
      <Hero />
      <Ilakas locale={locale as 'en' | 'ne' | 'new'} />

      <About t={t} />
      <UpcomingEvents />
      <PastEvents />

      {tenant.gallery && tenant.gallery.length > 0 && <Gallery
        gallery={tenant.gallery}
        title={t('homepageTitle')}
        description={t('homepageDescription')}
      />}
      <Members locale={locale as 'en' | 'ne' | 'new'} />
      <Contact t={t} />
    </div>
  )
}


type T = Awaited<ReturnType<typeof getI18n>>


const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-7xl mx-auto px-6">{children}</div>
)

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-12 text-center">
    <h2 className="text-3xl md:text-4xl font-bold text-red-900">{title}</h2>
    {subtitle && <p className="text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">{subtitle}</p>}
  </div>
)

// ---------- About ----------

const About = ({ t }: { t: T }) => (
  <section id="about" className="py-24 bg-gray-50 dark:bg-card">
    <Container>
      <SectionTitle
        title={t('home.aboutTitle')}
        subtitle={t('home.aboutSubtitle')}
      />

      <div className="grid md:grid-cols-3 gap-8">
        <InfoCard
          title={t('home.community')}
          text={t('home.communityDescription')}
        />

        <InfoCard
          title={t('home.culture')}
          text={t('home.cultureDescription')}
        />

        <InfoCard
          title={t('home.programs')}
          text={t('home.programsDescription')}
        />
      </div>
    </Container>
  </section>
)

const InfoCard = ({ title, text }: { title: string; text: string }) => (
  <div className="bg-white dark:bg-card rounded-2xl p-8 shadow-sm border hover:shadow-md transition">
    <h3 className="font-semibold text-lg mb-3 text-red-900">{title}</h3>
    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{text}</p>
  </div>
)

const Contact = ({ t }: { t: T }) => (
  <section id="contact" className="py-24 bg-red-900 text-white">
    <Container>
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{t('home.contactTitle')}</h2>
        <p className="text-red-100 mb-8">
          {t('home.contactDescription')}
        </p>

        <div className="space-y-2 text-red-100">
          <p>Email: info@syasyahsamaj.org</p>
          <p>{t('home.contactAddress')}</p>
        </div>
      </div>
    </Container>
  </section>
)
