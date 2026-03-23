import { getI18n } from "@/locales/server"

export default async function Hero() {
  const t = await getI18n()
  return (
    <section className="bg-[url('https://images.unsplash.com/photo-1605640840605-14ac1855827b')] bg-cover bg-center text-white">
      <div className="bg-black/50">
        <div className="max-w-6xl mx-auto px-6 py-32 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.homepageWelcome')}</h1>
          <p className="text-lg md:text-xl mb-6">
            {t('home.homepageWelcomeDescription')}
          </p>
          <button className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-400">
            Join Community
          </button>
        </div>
      </div>
    </section>
  )
}
