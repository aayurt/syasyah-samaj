import { Gallery } from '@/components/Gallery'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Members from './components/Members'

import { getI18n, getCurrentLocale } from '@/locales/server'

export default async function HomePage({ locale: propLocale }: { locale?: 'en' | 'ne' | 'new' }) {
  const payload = await getPayload({ config: configPromise })
  const t = await getI18n()
  const locale = propLocale || await getCurrentLocale()

  const form = await payload.findByID({
    collection: 'forms',
    id: 1,
    locale: locale as 'en' | 'ne' | 'new',
  })
  const { docs: tenants } = await payload.find({
    collection: 'tenants',
    where: {
      name: {
        equals: 'default',
      },
    },
    limit: 1,
    locale: locale as 'en' | 'ne',
  })

  const tenant = tenants[0]

  if (!tenant) return null

  return (
    <div className="font-sans bg-white text-gray-900">
      <Hero t={t} />
      <About t={t} />
      <Events t={t} />
      <Gallery
        gallery={tenant.gallery}
        title={t('homepageTitle')}
        description={t('homepageDescription')}
      />
      <Members locale={locale as 'en' | 'ne' | 'new'} />
      <Contact t={t} />
    </div>
  )
}

// ---------- Types ----------
type Event = {
  title: string
  date: string
  description: string
}

type Member = {
  name: string
  role: string
}

type T = Awaited<ReturnType<typeof getI18n>>

// ---------- Mock Data ----------
const events: Event[] = [
  {
    title: 'Indra Jatra Celebration',
    date: 'Sept 18',
    description: 'Community celebration with traditional music, dance, and rituals.',
  },
  {
    title: 'Samaj Annual Gathering',
    date: 'Oct 5',
    description: 'Annual community meeting and dinner for all members.',
  },
  {
    title: 'Newar Cultural Program',
    date: 'Nov 12',
    description: 'Showcasing Newari music, food, and cultural performances.',
  },
]

const committee: Member[] = [
  { name: 'Ram Shrestha', role: 'President' },
  { name: 'Sita Shrestha', role: 'Vice President' },
  { name: 'Hari Shrestha', role: 'Secretary' },
  { name: 'Gita Shrestha', role: 'Treasurer' },
]

// ---------- Layout Components ----------

const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-7xl mx-auto px-6">{children}</div>
)

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-12 text-center">
    <h2 className="text-3xl md:text-4xl font-bold text-red-900">{title}</h2>
    {subtitle && <p className="text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">{subtitle}</p>}
  </div>
)

// ---------- Hero ----------

const Hero = ({ t }: { t: T }) => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-red-900 to-red-700" />

    <Container>
      <div className="relative text-white py-28 md:py-36 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            {t('homepageTitle')}
          </h1>

          <p className="text-red-100 mb-8 text-lg">
            {t('homepageDescription')}
          </p>

          <div className="flex gap-4">
            <button className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-300">
              {t('home.becomeMember')}
            </button>

            <button className="border border-white/40 px-6 py-3 rounded-xl hover:bg-white/10">
              {t('home.upcomingEvents')}
            </button>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">{t('home.nextEvent')}</h3>

            <div className="space-y-4">
              {events.slice(0, 2).map((event) => (
                <div key={event.title} className="border-b border-white/20 pb-3">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-red-100">{event.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Container>
  </section>
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

// ---------- Events ----------

const Events = ({ t }: { t: T }) => (
  <section id="events" className="py-24 bg-gray-50 dark:bg-card">
    <Container>
      <SectionTitle
        title={t('home.upcomingEvents')}
        subtitle={t('home.upcomingEventsSubtitle')}
      />

      <div className="grid md:grid-cols-3 gap-8">
        {events.map((event) => (
          <EventCard key={event.title} event={event} />
        ))}
      </div>
    </Container>
  </section>
)

const EventCard = ({ event }: { event: Event }) => (
  <div className="bg-white dark:bg-card rounded-2xl border p-6 hover:shadow-lg transition">
    <p className="text-sm text-red-700 font-medium mb-2">{event.date}</p>
    <h3 className="font-semibold text-lg mb-3 text-red-900 dark:text-white">{event.title}</h3>
    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{event.description}</p>

    <button className="text-red-900 font-medium text-sm hover:underline">Learn More →</button>
  </div>
)

// ---------- Contact ----------

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
