import React from 'react'
import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { setStaticParamsLocale } from '@/locales/server'
import { toLocalizedNumber } from '@/lib/numbers'
import { Locale } from '@/lib/homeTranslations'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'इलाका सचिवालय डेस्क — स्यस्यः समाज',
  description: '२४ इलाका स्थानीय सदस्य प्रमाणीकरण, गुठी समन्वय तथा आपतकालीन रक्तदाता डेस्क',
}

export default async function CoordinatorPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = (rawLocale as Locale) || 'en'
  setStaticParamsLocale(locale)

  const currentUser = await getCurrentUser()
  const isDemo = !currentUser

  const user = currentUser || {
    name: locale === 'en' ? 'Bikram Shrestha' : 'बिक्रम श्रेष्ठ',
    email: 'coordinator.il01@syasyahsamaj.org.np',
    role: 'coordinator',
  }

  let ilakas: any[] = []
  try {
    const payload = await getPayload({ config: configPromise })
    const res = await payload.find({
      collection: 'tenants',
      limit: 1,
      where: {
        domain: {
          not_equals: 'localhost:3000',
        },
      },
    })
    ilakas = res.docs
  } catch (e) {
    // fallback
  }

  const currentIlaka = ilakas[0] || {
    name: locale === 'en' ? 'Mangalbazar Ilaka (IL01)' : 'मंगलबजार इलाका (IL01)',
    slug: 'mangalbazar',
  }

  return (
    <div className="min-h-screen bg-stone-50/50 py-10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* UX/UI Tester Notice Bar (if viewing in preview mode) */}
        {isDemo && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 px-4 py-3 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🧪</span>
              <span>
                <strong>{locale === 'en' ? 'UX/UI Reviewer Mode:' : 'UX/UI परीक्षण पूर्वावलोकन:'}</strong>{' '}
                {locale === 'en'
                  ? 'Viewing interactive Ilaka Coordinator Desk with member verification queue and localized figures.'
                  : 'स्थानिक अङ्क तथा सदस्य सिफारिस कार्यकक्षसहितको नमुना इलाका सचिवालय डेस्क प्रदर्शन भइरहेको छ।'}
              </span>
            </div>
            <Link
              href="/login"
              className="text-xs font-bold text-primary underline hover:text-primary/80 shrink-0"
            >
              {locale === 'en' ? 'Multi-Portal Hub Sign In →' : 'बहु-पोर्टल लगइन →'}
            </Link>
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 bg-stone-900 text-white rounded">
                {locale === 'en' ? 'Ilaka Coordinator Desk' : 'इलाका सचिवालय डेस्क'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-200">
                {currentIlaka.name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-950">
              {locale === 'en' ? 'Coordinator Office — ' : 'संयोजक कार्यकक्ष — '}
              {user.name || (locale === 'en' ? 'Ilaka Representative' : 'इलाका प्रतिनिधि')}
            </h1>
            <p className="text-xs text-stone-500">
              {locale === 'en'
                ? 'Local member verification, tole committee coordination, and emergency blood response'
                : 'स्थानीय सदस्य आवेदन प्रमाणीकरण, टोल समन्वय र आपतकालीन रक्तदान सहजीकरण'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/portal"
              className="px-3.5 py-2 border border-stone-300 rounded-lg text-stone-800 font-semibold hover:bg-stone-50 transition-colors"
            >
              ← {locale === 'en' ? 'My Member Portal' : 'मेरो सदस्य पोर्टल'}
            </Link>
            <Link
              href="/app"
              className="px-3.5 py-2 bg-stone-900 text-white rounded-lg font-bold hover:bg-black transition-colors shadow-xs"
            >
              💼 {locale === 'en' ? 'Dhuku Cashier (/app) ↗' : 'स्यस्यः धुकू (/app) ↗'}
            </Link>
          </div>
        </div>

        {/* 4-Stat Coordinator Pulse */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">
              {locale === 'en' ? 'Registered Families' : 'इलाका सदस्य परिवार'}
            </span>
            <span className="text-2xl font-black text-stone-950 tabular-nums">
              {toLocalizedNumber(124, locale)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
              {locale === 'en' ? '98% Renewed' : '९८% नविकृत'}
            </span>
          </div>

          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">
              {locale === 'en' ? 'Pending Verifications' : 'प्रमाणित हुन बाँकी आवेदन'}
            </span>
            <span className="text-2xl font-black text-amber-600 tabular-nums">
              {toLocalizedNumber(3, locale)}
            </span>
            <span className="text-[10px] text-amber-800 font-semibold block mt-1">
              {locale === 'en' ? 'Action Required' : 'तुरुन्त प्रमाणीकरण आवश्यक'}
            </span>
          </div>

          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">
              {locale === 'en' ? 'Emergency Donors' : 'आपतकालीन रक्तदाता'}
            </span>
            <span className="text-2xl font-black text-red-700 tabular-nums">
              {toLocalizedNumber(28, locale)}
            </span>
            <span className="text-[10px] text-stone-500 block mt-1">
              {locale === 'en' ? 'Mangalbazar / Kwachhen' : 'स्थान: मंगलबजार / क्वाछें'}
            </span>
          </div>

          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-[11px] text-stone-500 font-medium block">
              {locale === 'en' ? 'Upcoming Assemblies' : 'आसन्न गुठी / भेला'}
            </span>
            <span className="text-2xl font-black text-stone-950 tabular-nums">
              {toLocalizedNumber(2, locale)}
            </span>
            <span className="text-[10px] text-stone-500 block mt-1">
              {locale === 'en' ? 'Oct 10 & Oct 15' : 'असोज १० र १५'}
            </span>
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Pending Member Verifications (7 of 12) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h2 className="font-serif font-bold text-base text-stone-950">
                    {locale === 'en' ? 'Pending Member Applications' : 'नयाँ सदस्यता आवेदनहरू (Pending Verifications)'}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {locale === 'en'
                      ? 'Central Secretariat issues official Digital ID only after coordinator endorsement'
                      : 'संयोजकको सिफारिस पछि मात्र केन्द्रीय सचिवालयबाट ID जारी हुन्छ'}
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-700">
                  {toLocalizedNumber(3, locale)} {locale === 'en' ? 'Pending' : 'बाँकी'}
                </span>
              </div>

              <div className="space-y-3">
                
                <div className="p-4 border border-stone-200 rounded-xl bg-stone-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900">
                        {locale === 'en' ? 'Sameer Shrestha' : 'समीर श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-stone-200 text-stone-800 rounded">
                        {locale === 'en' ? 'Lifetime Member' : 'आजीवन सदस्यता'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {locale === 'en'
                        ? 'Address: Kwachhen Tole • Father: Uttam Shrestha • Phone: 9841-889900'
                        : 'ठेगाना: क्वाछें टोल • बुबा: श्री उत्तम श्रेष्ठ • फोन: ९८४१-८८९९००'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {locale === 'en'
                        ? 'Citizenship: 27-01-76-88990 (Document Attached)'
                        : 'नागरिकता नं: २७-०१-७६-८८९९० (प्रमाणपत्र संलग्न)'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs bg-stone-900 text-white font-bold rounded-lg hover:bg-black transition-colors shadow-xs"
                    >
                      {locale === 'en' ? 'Endorse & Approve ✓' : 'सिफारिस गर्नुहोस् ✓'}
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-stone-200 rounded-xl bg-stone-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900">
                        {locale === 'en' ? 'Anusha Shrestha' : 'अनुषा श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-stone-200 text-stone-800 rounded">
                        {locale === 'en' ? 'General Member' : 'साधारण सदस्यता'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {locale === 'en'
                        ? 'Address: Saugal Tole • Father: Keshav Shrestha • Phone: 9851-223344'
                        : 'ठेगाना: सौगल टोल • बुबा: श्री केशव श्रेष्ठ • फोन: ९८५१-२२३३४४'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {locale === 'en'
                        ? 'Citizenship: 27-01-78-11223 (Document Attached)'
                        : 'नागरिकता नं: २७-०१-७८-११२२३ (प्रमाणपत्र संलग्न)'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs bg-stone-900 text-white font-bold rounded-lg hover:bg-black transition-colors shadow-xs"
                    >
                      {locale === 'en' ? 'Endorse & Approve ✓' : 'सिफारिस गर्नुहोस् ✓'}
                    </button>
                  </div>
                </div>

                <div className="p-4 border border-stone-200 rounded-xl bg-stone-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900">
                        {locale === 'en' ? 'Rohit Shrestha' : 'रोहित श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-stone-200 text-stone-800 rounded">
                        {locale === 'en' ? 'General Member' : 'साधारण सदस्यता'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {locale === 'en'
                        ? 'Address: Na-Bahal • Father: Vijay Man Shrestha • Phone: 9801-334455'
                        : 'ठेगाना: नःबहाल • बुबा: श्री विजय मान श्रेष्ठ • फोन: ९८०१-३३४४५५'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {locale === 'en'
                        ? 'Citizenship: 27-01-72-33445 (Document Attached)'
                        : 'नागरिकता नं: २७-०१-७२-३३४४५ (प्रमाणपत्र संलग्न)'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs bg-stone-900 text-white font-bold rounded-lg hover:bg-black transition-colors shadow-xs"
                    >
                      {locale === 'en' ? 'Endorse & Approve ✓' : 'सिफारिस गर्नुहोस् ✓'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right: Local Emergency Donors & Meetings (5 of 12) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Local Blood Donors */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h3 className="font-bold text-xs uppercase tracking-wider text-red-700">
                  {locale === 'en' ? 'Ilaka Emergency Donors (Direct Call)' : 'इलाका आपतकालीन रक्तदाता (Quick Call)'}
                </h3>
                <span className="text-[10px] font-bold text-stone-500">
                  {locale === 'en' ? '24/7 Available' : '२४ सै घण्टा सम्पर्क'}
                </span>
              </div>

              <div className="divide-y divide-stone-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-stone-100 border border-stone-200 font-bold flex items-center justify-center text-[10px] text-red-800">
                      O+
                    </span>
                    <div>
                      <span className="font-bold text-stone-900 block">
                        {locale === 'en' ? 'Amit Shrestha' : 'अमित श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {locale === 'en' ? 'Kwachhen Tole' : 'क्वाछें टोल'}
                      </span>
                    </div>
                  </div>
                  <a
                    href="tel:9841012345"
                    className="text-stone-700 hover:text-red-700 font-bold tabular-nums border border-stone-300 px-2 py-0.5 rounded hover:bg-stone-50"
                  >
                    {toLocalizedNumber('9841-012345', locale)}
                  </a>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-stone-100 border border-stone-200 font-bold flex items-center justify-center text-[10px] text-red-800">
                      B+
                    </span>
                    <div>
                      <span className="font-bold text-stone-900 block">
                        {locale === 'en' ? 'Dinesh Shrestha' : 'दिनेश श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {locale === 'en' ? 'Haugal Tole' : 'हौगल टोल'}
                      </span>
                    </div>
                  </div>
                  <a
                    href="tel:9851098765"
                    className="text-stone-700 hover:text-red-700 font-bold tabular-nums border border-stone-300 px-2 py-0.5 rounded hover:bg-stone-50"
                  >
                    {toLocalizedNumber('9851-098765', locale)}
                  </a>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-stone-100 border border-stone-200 font-bold flex items-center justify-center text-[10px] text-red-800">
                      A+
                    </span>
                    <div>
                      <span className="font-bold text-stone-900 block">
                        {locale === 'en' ? 'Sunita Shrestha' : 'सुनिता श्रेष्ठ'}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {locale === 'en' ? 'Mangalbazar Chowk' : 'मंगलबजार चोक'}
                      </span>
                    </div>
                  </div>
                  <a
                    href="tel:9841556677"
                    className="text-stone-700 hover:text-red-700 font-bold tabular-nums border border-stone-300 px-2 py-0.5 rounded hover:bg-stone-50"
                  >
                    {toLocalizedNumber('9841-556677', locale)}
                  </a>
                </div>
              </div>
            </div>

            {/* Coordinator Quick Links */}
            <div className="p-4 border border-stone-200 rounded-xl bg-white space-y-2 text-xs">
              <h4 className="font-bold text-stone-900">
                {locale === 'en' ? 'Central Secretariat Contacts:' : 'केन्द्रीय समन्वय सम्पर्क:'}
              </h4>
              <p className="text-stone-600">
                {locale === 'en' ? 'General Secretariat: ' : 'केन्द्रीय सचिवालय: '}
                {toLocalizedNumber('01-5523456', locale)}
              </p>
              <p className="text-stone-600">
                {locale === 'en' ? 'General Secretary: ' : 'महासचिव: '}
                {toLocalizedNumber('9841-445566', locale)}
              </p>
              <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-100">
                {locale === 'en'
                  ? 'Monthly Ilaka Report Due: End of each Bikram Sambat month'
                  : 'इलाका प्रतिवेदन पेश गर्ने म्याद: प्रत्येक महिनाको मसान्त'}
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}