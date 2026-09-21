import { Gallery } from '@/components/Gallery'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Members from './components/Members'

import { getCurrentLocale, getI18n } from '@/locales/server'
import UpcomingEvents from './components/Events/upcomingEvents'
import Ilakas from './components/Ilakas'
import HomepageHero from './components/homepageHero'
import { headers } from 'next/headers'
import Notification from './components/Notification'
import { FindIlaka } from '@/components/FindIlaka'
import { Card } from '@/components/ui/card'

import TimelineSection from './components/Timeline'
import ArchivesSection from './components/Archives'
import EldersSection from './components/Elders'
import EmergencyBloodSection from './components/EmergencyBlood'
import CivicServicesSection from './components/CivicServices'
import { Locale } from '@/lib/homeTranslations'

export default async function HomePage({ locale: propLocale }: { locale?: string }) {
  const payload = await getPayload({ config: configPromise })
  const t = await getI18n()
  const currentLocale = (propLocale || (await getCurrentLocale())) as Locale
  const host = (await headers()).get('host') || ''
  const domain = host.split('.')[0]

  const { docs: tenants } = await payload.find({
    collection: 'tenants',
    where: {
      domain: {
        equals: domain === 'localhost:3000' || domain === 'syasyahsamaj' ? null : domain,
      },
    },
    limit: 1,
    locale: currentLocale,
  })

  const tenant = tenants[0]
  if (!tenant) return null

  const { docs: allIlakas } = await payload.find({
    collection: 'tenants',
    limit: 100,
  })

  return (
    <div className="font-sans bg-background text-foreground space-y-16">
      <Notification />

      {/* 1. Refined Nepal Heritage Hero & Community Pulse Ribbon */}
      <HomepageHero locale={currentLocale} />

      {/* 2. Ilaka Search & Neighborhood Directory */}
      <section id="ilakas" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
          <FindIlaka
            initialIlakas={allIlakas.map((i) => ({
              id: String(i.id),
              name: i.name,
              slug: i.slug,
              location: i.location ? { address: i.location.address || undefined } : undefined,
            }))}
          />
        </div>
        <Ilakas locale={currentLocale} />
      </section>

      {/* 3. Two-Column Civic Action Hub & Gatherings */}
      <section className="py-12 bg-muted/30 border-t border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Upcoming Gatherings & Festivals (7 of 12) */}
            <div className="lg:col-span-7 space-y-6">
              <UpcomingEvents showPadding={false} />
            </div>

            {/* Right Column: Online Citizen Services Tracker & 24/7 Blood Network (5 of 12) */}
            <div className="lg:col-span-5 space-y-6">
              <CivicServicesSection locale={currentLocale} />
              <EmergencyBloodSection locale={currentLocale} />
            </div>

          </div>
        </div>
      </section>

      {/* 4. Heritage Timeline (कालक्रम) Section */}
      <TimelineSection locale={currentLocale} />

      {/* 5. Digital Archives & Manuscripts (डिजिटल संग्रह) Section */}
      <ArchivesSection locale={currentLocale} />

      {/* 6. Living Heritage & Elders (आदरणीय अग्रज) Section */}
      <EldersSection locale={currentLocale} />

      {/* 7. About Samaj & Mission */}
      <About t={t} />

      {/* 8. Gallery (if enabled on tenant) */}
      {tenant.gallery && tenant.gallery.length > 0 && (
        <Gallery
          gallery={tenant.gallery}
          title={t('homepageTitle')}
          description={t('homepageDescription')}
        />
      )}

      {/* 9. Members Directory */}
      <Members locale={currentLocale} />

      {/* 10. Contact Section */}
      <Contact t={t} />
    </div>
  )
}

type T = Awaited<ReturnType<typeof getI18n>>

const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
)

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-12 text-center space-y-2">
    <h2 className="text-3xl md:text-4xl font-serif font-black text-foreground">{title}</h2>
    {subtitle && <p className="text-muted-foreground text-sm max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
  </div>
)

// ---------- About ----------

const About = ({ t }: { t: T }) => (
  <section id="about" className="py-20 bg-muted/40 border-t border-b border-border">
    <Container>
      <SectionTitle
        title={t('home.aboutTitle')}
        subtitle={t('home.aboutSubtitle')}
      />

      <div className="grid md:grid-cols-3 gap-6">
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
  <Card className="p-8 bg-card border border-border rounded-2xl shadow-xs hover:border-primary/50 hover:shadow-md transition-all">
    <h3 className="font-serif font-bold text-lg mb-3 text-primary">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
  </Card>
)

const Contact = ({ t }: { t: T }) => (
  <section id="contact" className="py-20 bg-primary text-primary-foreground">
    <Container>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-3xl sm:text-4xl font-serif font-black">{t('home.contactTitle')}</h2>
        <p className="text-primary-foreground/90 text-sm leading-relaxed">
          {t('home.contactDescription')}
        </p>

        <div className="space-y-1.5 text-primary-foreground/80 text-sm pt-2">
          <p className="font-semibold">Email: info@syasyahsamaj.org.np</p>
          <p>{t('home.contactAddress')}</p>
        </div>
      </div>
    </Container>
  </section>
)