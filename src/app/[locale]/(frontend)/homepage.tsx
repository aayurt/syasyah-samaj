import { Gallery } from '@/components/Gallery'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Members from './components/Members'

import { getCurrentLocale, getI18n } from '@/locales/server'
import PastEvents from './components/Events/pastEvents'
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

export default async function HomePage({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
  const payload = await getPayload({ config: configPromise })
  const t = await getI18n()
  const locale = (propLocale || await getCurrentLocale()) as 'en' | 'ne' | 'new'
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
    locale,
  })

  const tenant = tenants[0]
  if (!tenant) return null

  const { docs: allIlakas } = await payload.find({
    collection: 'tenants',
    limit: 100,
  })

  return (
    <div className="font-sans bg-background text-foreground space-y-12">
      <Notification />
      <HomepageHero />

      {/* 4-Stat Community Pulse Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-16 relative z-30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-stone-200 bg-white p-5 rounded-2xl shadow-md">
          <div className="border-r border-stone-100 last:border-0 pr-2">
            <span className="text-[11px] text-stone-500 font-medium block">सक्रिय इलाकाहरू (Ilakas)</span>
            <span className="text-2xl font-black text-stone-900 tabular-nums">२४</span>
            <span className="text-[10px] text-stone-500 block mt-0.5">यल नगर तथा उपनगर क्षेत्र</span>
          </div>
          <div className="border-r border-stone-100 last:border-0 pr-2">
            <span className="text-[11px] text-stone-500 font-medium block">दर्ता सदस्य परिवार (Families)</span>
            <span className="text-2xl font-black text-stone-900 tabular-nums">१,८४२</span>
            <span className="text-[10px] text-stone-500 block mt-0.5">डिजिटल परिचयपत्र प्राप्त</span>
          </div>
          <div className="border-r border-stone-100 last:border-0 pr-2">
            <span className="text-[11px] text-stone-500 font-medium block">संरक्षित पाण्डुलिपि तथा अभिलेख</span>
            <span className="text-2xl font-black text-stone-900 tabular-nums">१२०+</span>
            <span className="text-[10px] text-stone-500 block mt-0.5">ऐतिहासिक तमसुक र विधान</span>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 font-medium block">आपतकालीन रक्तदाता (Donors)</span>
            <span className="text-2xl font-black text-stone-900 tabular-nums">२१०+</span>
            <span className="text-[10px] text-stone-500 block mt-0.5">तत्काल सम्पर्कका लागि उपलब्ध</span>
          </div>
        </div>
      </div>

      {/* Find Ilaka Search */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6">
        <FindIlaka initialIlakas={allIlakas.map(i => ({
            id: String(i.id),
            name: i.name,
            slug: i.slug,
            location: i.location ? { address: i.location.address || undefined } : undefined
        }))} />
      </div>

      {/* Ilakas Directory */}
      <Ilakas locale={locale} />

      {/* Two-Column Civic Action & Operational Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Events & Gatherings */}
          <div className="lg:col-span-8 space-y-8">
            <UpcomingEvents />
            <PastEvents />
          </div>

          {/* Right Column: Citizen Services & Emergency Blood Network */}
          <div className="lg:col-span-4 space-y-6">
            <CivicServicesSection />
            <EmergencyBloodSection />
          </div>

        </div>
      </section>

      {/* कालक्रम (Timeline) Section */}
      <TimelineSection locale={locale} />

      {/* डिजिटल संग्रह (Archives) Section */}
      <ArchivesSection />

      {/* आदरणीय अग्रज (Elders & Living Heritage) Section */}
      <EldersSection locale={locale} />

      {/* About Section */}
      <About t={t} />

      {/* Gallery */}
      {tenant.gallery && tenant.gallery.length > 0 && (
        <Gallery
          gallery={tenant.gallery}
          title={t('homepageTitle')}
          description={t('homepageDescription')}
        />
      )}

      {/* Members Directory */}
      <Members locale={locale} />

      {/* Contact Section */}
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
    <h2 className="text-3xl md:text-4xl font-bold text-primary">{title}</h2>
    {subtitle && <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">{subtitle}</p>}
  </div>
)

// ---------- About ----------

const About = ({ t }: { t: T }) => (
  <section id="about" className="py-24 bg-muted dark:bg-card">
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
  <Card className="p-8 shadow-sm hover:shadow-md transition-all">
    <h3 className="font-semibold text-lg mb-3 text-primary">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
  </Card>
)

const Contact = ({ t }: { t: T }) => (
  <section id="contact" className="py-24 bg-primary text-primary-foreground">
    <Container>
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">{t('home.contactTitle')}</h2>
        <p className="text-primary-foreground/80 mb-8">
          {t('home.contactDescription')}
        </p>

        <div className="space-y-2 text-primary-foreground/80">
          <p>Email: info@syasyahsamaj.org</p>
          <p>{t('home.contactAddress')}</p>
        </div>
      </div>
    </Container>
  </section>
)