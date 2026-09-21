import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const defaultElders = [
  {
    name: 'स्व. पूर्णमान श्रेष्ठ',
    honorificTitle: 'संस्थापक सल्लाहकार',
    field: 'इतिहासविद् तथा संस्कृतिविद्',
    bio: 'पाटनको स्यस्यः इतिहास, नेवार जातिको उत्पत्ति र पाण्डुलिपि अन्वेषणमा ५ दशक लामो शोध र ग्रन्थ प्रकाशन।',
    initial: 'प',
  },
  {
    name: 'श्री सत्यनारायण श्रेष्ठ',
    honorificTitle: 'वरिष्ठ गुठी गुरु',
    field: 'दाफा भजन तथा राग प्रशिक्षक (८४ वर्ष)',
    bio: 'च्यासल र मंगलबजारमा चार पुस्तालाई शास्त्रीय दाफा भजन, चर्या नृत्य र परम्परागत बाँसुरी वादन प्रशिक्षण।',
    initial: 'स',
  },
  {
    name: 'श्रीमती चन्द्रलक्ष्मी श्रेष्ठ',
    honorificTitle: 'सामुदायिक अभियन्ता',
    field: 'महिला जागरण तथा बचत कोष अग्रणी',
    bio: 'पाटनका विभिन्न टोलमा महिला समूह गठन, परम्परागत नेवारी व्यञ्जन उत्पादन र आत्मनिर्भरता अभियानका नेतृत्वकर्ता।',
    initial: 'च',
  },
]

export default async function EldersSection({ locale }: { locale: 'en' | 'ne' | 'new' }) {
  let elders = defaultElders

  try {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'elders',
      sort: 'order',
      limit: 6,
      locale,
    })

    if (docs && docs.length > 0) {
      elders = docs.map((d: any) => ({
        name: d.name,
        honorificTitle: d.honorificTitle || 'सम्मानित व्यक्तित्व',
        field: d.field || 'सामुदायिक सेवा',
        bio: d.bio || '',
        initial: (d.name || 'अ')[0],
      }))
    }
  } catch (err) {
    // Fall back to default elders
  }

  return (
    <section id="elders" className="py-16 bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="max-w-3xl">
          <span className="text-xs uppercase tracking-widest text-crimson-700 font-bold bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
            धरोहर व्यक्तित्व
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-stone-950 mt-2">
            आदरणीय अग्रज (Elders): समाजका विशिष्ट धरोहर व्यक्तित्वहरू
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            भाषा, संस्कृति, गुठी व्यवस्थापन र सामाजिक जागरणमा अमूल्य योगदान पुर्याउने सम्मानित महानुभावहरू
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {elders.map((elder, idx) => (
            <div
              key={idx}
              className="border border-stone-200 rounded-xl p-6 bg-stone-50/40 text-center hover:border-stone-900 transition-all shadow-xs flex flex-col items-center justify-between"
            >
              <div className="space-y-3 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full border-2 border-stone-900 flex items-center justify-center bg-white text-stone-900 text-2xl font-serif font-black shadow-xs">
                  {elder.initial}
                </div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-stone-200 rounded text-stone-800">
                  {elder.honorificTitle}
                </span>
                <h3 className="font-serif font-bold text-base text-stone-950">
                  {elder.name}
                </h3>
                <p className="text-xs text-crimson-700 font-semibold">
                  {elder.field}
                </p>
                <p className="text-xs text-stone-600 leading-relaxed text-center">
                  {elder.bio}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-200 w-full text-center">
                <span className="text-[11px] font-bold text-stone-800">
                  सामुदायिक सम्मान सूची
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}