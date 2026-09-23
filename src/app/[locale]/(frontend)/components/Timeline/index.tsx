import React from 'react'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const defaultMilestones = [
  {
    year: '२०५६',
    title: 'समाजको औपचारिक स्थापना',
    description: 'पाटनका विभिन्न टोलका श्रेष्ठ अग्रजहरूको भेलाद्वारा स्यस्यः समाजको गठन र विधान दर्ता (दर्ता नं: २३४/०५६/५७)।',
    tag: 'स्थापना वर्ष',
  },
  {
    year: '२०६२',
    title: '२४ इलाका संरचना घोषणा',
    description: 'ललितपुर नगरलाई प्रशासनिक तथा सामाजिक सहजताका लागि २४ इलाकामा विभाजन गरी स्थानीय संयोजक नियुक्ति।',
    tag: 'विकेन्द्रीकरण',
  },
  {
    year: '२०७२',
    title: 'महाभूकम्प राहत तथा पुनर्निर्माण',
    description: 'पाटनका भूकम्प प्रभावित परिवारलाई आपतकालीन आश्रय, खाद्यान्न वितरण, सम्पदा संरक्षण र अक्षयकोष परिचालन।',
    tag: 'विपद् उद्धार',
  },
  {
    year: '२०८०-८३',
    title: 'डिजिटल अभिलेखीकरण र लेखा',
    description: 'अफलाइन-फर्स्ट लेखा प्रणाली (स्यस्यः धुकू), डिजिटल सदस्यता कार्ड तथा ऐतिहासिक पाण्डुलिपि संरक्षण।',
    tag: 'डिजिटल युग',
  },
]

export default async function TimelineSection({ locale }: { locale: 'en' | 'ne' | 'new' }) {
  let milestones = defaultMilestones

  try {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'timeline',
      sort: 'order',
      limit: 10,
      locale,
    })

    if (docs && docs.length > 0) {
      milestones = docs.map((doc: any) => ({
        year: doc.year,
        title: doc.title,
        description: doc.description,
        tag: doc.tag || 'ऐतिहासिक',
      }))
    }
  } catch (err) {
    // Fall back gracefully to default milestones
  }

  return (
    <section id="timeline" className="py-16 bg-white border-t border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="text-xs uppercase tracking-widest text-crimson-700 font-bold bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
            ऐतिहासिक यात्रा
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-stone-950 mt-2">
            कालक्रम (Timeline): समाज निर्माणका ऐतिहासिक कोशेढुङ्गाहरू
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-2">
            वि.सं. २०५६ को स्थापनादेखि आधुनिक डिजिटल सुशासनसम्मको गौरवमय चार दशक
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                className="border-t-4 border-stone-900 pt-4 bg-stone-50/70 p-5 rounded-b-xl border border-stone-200 hover:border-stone-400 transition-all space-y-2"
                style={{ flexShrink: 0 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-serif font-black text-stone-950 tabular-nums">
                    {m.year}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-200 text-stone-800 rounded">
                    {m.tag}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-stone-900 leading-snug">
                  {m.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {m.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}