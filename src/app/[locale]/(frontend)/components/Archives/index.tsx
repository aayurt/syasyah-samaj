'use client'

import React, { useState } from 'react'

export interface ArchiveItem {
  id: string
  title: string
  category: 'manuscript' | 'photo' | 'guthi' | 'general'
  era?: string
  description?: string
  source?: string
  fileUrl?: string
}

const defaultArchives: ArchiveItem[] = [
  {
    id: '1',
    title: 'पाटन तलेजु गुठी व्यवस्थापन सम्बन्धी प्राचीन निर्णय',
    category: 'manuscript',
    era: 'नेपाल संवत् १०४८ (वि.सं. १९८४)',
    description: 'नेवारी लिपिमा लेखिएको ऐतिहासिक तमसुक जसमा स्यस्यः समुदायको तलेजु मन्दिरमा वार्षिक पर्व पूजा तथा समय् बजि वितरण दायित्व किटान गरिएको छ।',
    source: 'क्वाछें गुठी अभिलेख',
  },
  {
    id: '2',
    title: 'मंगलबजार तथा च्यासल गुँला बाजा खलः को सामूहिक तस्बिर',
    category: 'photo',
    era: 'वि.सं. २०२४',
    description: 'परम्परागत धाः बाजा, भुस्याः र बाँसुरी बजाउँदै पाटनका ऐतिहासिक बहाः बही परिक्रमा गर्दा खिचिएको श्यामश्वेत ऐतिहासिक तस्बिर।',
    source: 'च्यासल अभिलेख',
  },
  {
    id: '3',
    title: 'सी गुठी तथा सनः गुठी परम्परागत आचारसंहिता',
    category: 'guthi',
    era: 'वि.सं. २०६० (अद्यावधिक २०८१)',
    description: 'मृत्यु संस्कार, दाहसंस्कार सहयोग र सदस्यहरू बीचको आपसी सद्भाव कायम राख्न तयार गरिएको नियम संग्रह।',
    source: 'केन्द्रीय सचिवालय',
  },
]

export default function ArchivesSection({ initialDocs }: { initialDocs?: ArchiveItem[] }) {
  const [category, setCategory] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<ArchiveItem | null>(null)

  const items = initialDocs && initialDocs.length > 0 ? initialDocs : defaultArchives

  const filtered = items.filter((item) => {
    if (category === 'all') return true
    return item.category === category
  })

  return (
    <section id="archives" className="py-16 bg-stone-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <span className="text-xs uppercase tracking-widest text-crimson-700 font-bold bg-white px-3 py-1 rounded-full border border-stone-200">
              ऐतिहासिक सम्पदा
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-stone-950 mt-2">
              डिजिटल संग्रह (Archives): सामुदायिक अभिलेख तथा पाण्डुलिपि
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              पाटनका प्राचीन गुठी तमसुक, रीतिथिति निर्णय, पाण्डुलिपि र दुर्लभ ऐतिहासिक तस्बिरहरू
            </p>
          </div>

          <div className="flex border border-stone-300 rounded-lg p-0.5 bg-white text-xs shrink-0 shadow-xs">
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                category === 'all' ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              सबै संग्रह
            </button>
            <button
              onClick={() => setCategory('manuscript')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                category === 'manuscript' ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              तमसुक तथा पाण्डुलिपि
            </button>
            <button
              onClick={() => setCategory('photo')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                category === 'photo' ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              ऐतिहासिक तस्बिर
            </button>
            <button
              onClick={() => setCategory('guthi')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                category === 'guthi' ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              गुठी विधान
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="border border-stone-200 bg-white rounded-xl p-5 hover:border-stone-900 transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-[16/9] border border-dashed border-stone-300 rounded-lg bg-stone-50 flex flex-col items-center justify-center p-3 text-center">
                  <span className="text-3xl mb-1">
                    {item.category === 'photo' ? '📷' : item.category === 'guthi' ? '⚖️' : '📜'}
                  </span>
                  <span className="text-[11px] font-bold text-stone-800">{item.era}</span>
                  {item.source && <span className="text-[10px] text-stone-500">{item.source}</span>}
                </div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-stone-100 text-stone-800 rounded">
                  {item.category === 'manuscript' ? 'पाण्डुलिपि' : item.category === 'photo' ? 'तस्बिर' : 'गुठी'}
                </span>
                <h3 className="font-serif font-bold text-base text-stone-900 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">केन्द्रीय अभिलेख शाखा</span>
                <button
                  onClick={() => setSelectedDoc(item)}
                  className="font-bold text-stone-900 underline hover:text-crimson-700"
                >
                  अध्ययन गर्नुहोस् →
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-stone-900 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-start">
              <h4 className="font-serif font-bold text-lg text-stone-900">{selectedDoc.title}</h4>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-stone-400 hover:text-stone-900 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-stone-700 leading-relaxed border-t border-b border-stone-100 py-3 space-y-2">
              <p>{selectedDoc.description}</p>
              <div className="p-2.5 bg-stone-50 rounded border border-stone-200 text-[11px] text-stone-600">
                <span>कालखण्ड: {selectedDoc.era} • स्रोत: {selectedDoc.source || 'केन्द्रीय अभिलेख'}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-stone-500">अभिलेख शाखा, मंगलबजार</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-3 py-1.5 border border-stone-300 rounded hover:bg-stone-100"
                >
                  बन्द गर्नुहोस्
                </button>
                <button
                  onClick={() => {
                    alert('अभिलेख फाइल (PDF) डाउनलोड सुरु भयो।')
                    setSelectedDoc(null)
                  }}
                  className="px-3.5 py-1.5 bg-stone-900 text-white font-bold rounded hover:bg-black"
                >
                  डाउनलोड (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}