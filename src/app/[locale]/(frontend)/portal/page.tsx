import React from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { DigitalIDCard } from '@/components/DigitalIDCard'
import { setStaticParamsLocale } from '@/locales/server'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'नागरिक तथा सदस्य पोर्टल — स्यस्यः समाज',
  description: 'डिजिटल सदस्यता परिचयपत्र, लेबी तथा पारिवारिक अभिलेख',
}

export default async function MemberPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setStaticParamsLocale(locale)

  const user = await getCurrentUser()
  if (!user) {
    redirect(`/${locale}/login?redirect=/${locale}/portal`)
  }

  const userRole = (user as any)?.role || 'member'

  const payload = await getPayload({ config: configPromise })
  
  // Find linked member record
  const { docs: memberDocs } = await payload.find({
    collection: 'members',
    where: {
      email: {
        equals: user.email,
      },
    },
    limit: 1,
    depth: 2,
  })

  const member = memberDocs[0] as any

  const memberData = member || {
    fullName: user.name || 'सदस्य',
    email: user.email,
    memberId: 'SS-DRAFT',
    status: 'active',
    paymentStatus: 'paid',
    tenantName: 'स्यस्यः समाज, यल',
    idCardDetails: {
      bloodGroup: 'O+',
      emergencyContact: '०१-५५२३४५६',
    },
    membershipType: {
      name: 'आजीवन (Lifetime)',
      fee: 1000,
    },
  }

  return (
    <div className="min-h-screen bg-stone-50/50 py-10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Portal Header */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 bg-crimson-100 text-crimson-900 rounded-full border border-crimson-200">
                नागरिक तथा सदस्य पोर्टल
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-200">
                {userRole === 'admin' ? 'प्रशासक' : userRole === 'coordinator' ? 'इलाका संयोजक' : 'सदस्य'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-950">
              स्वागतम्, {memberData.fullName}
            </h1>
            <p className="text-xs text-stone-500">
              इमेल: {user.email} • सदस्य दर्ता नं: {memberData.memberId || 'प्रक्रियामा'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {userRole === 'coordinator' && (
              <Link
                href="/portal/coordinator"
                className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-bold hover:bg-black transition-colors"
              >
                🏛️ इलाका सचिवालय डेस्क →
              </Link>
            )}
            {(userRole === 'admin' || userRole === 'super-admin' || userRole === 'treasurer' || userRole === 'accountant') && (
              <Link
                href="/app"
                className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 font-bold hover:bg-stone-50 transition-colors"
              >
                💼 स्यस्यः धुकू लेखा (/app) ↗
              </Link>
            )}
          </div>
        </div>

        {/* Main Grid: Left Digital ID Card + Dues / Right Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: ID Card & Dues Status (5 of 12) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Digital ID Card Display */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="font-serif font-bold text-base text-stone-950">
                  आधिकारिक डिजिटल परिचयपत्र
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  सक्रिय (Active)
                </span>
              </div>

              <div className="flex justify-center">
                <DigitalIDCard
                  member={{
                    fullName: memberData.fullName,
                    memberId: memberData.memberId,
                    email: memberData.email,
                    phoneNumber: memberData.phoneNumber,
                    profileImage: memberData.profileImage,
                    idCardDetails: memberData.idCardDetails,
                    tenantName: memberData.tenant?.name || 'स्यस्यः समाज, यल',
                    membershipType: memberData.membershipType,
                    renewalDate: memberData.renewalDate,
                    paymentStatus: memberData.paymentStatus,
                  }}
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 text-xs border border-stone-300 font-semibold rounded-lg hover:bg-stone-50 transition-colors"
                >
                  🖨️ परिचयपत्र छाप्नुहोस्
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 text-xs bg-stone-900 text-white font-semibold rounded-lg hover:bg-black transition-colors"
                >
                  📱 QR कोड साझा गर्नुहोस्
                </button>
              </div>
            </div>

            {/* Dues & Payment Status */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h3 className="font-bold text-xs uppercase tracking-wider text-stone-700">
                  सदस्यता शुल्क तथा लेबी स्थिति
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    memberData.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {memberData.paymentStatus === 'paid' ? 'चुक्ता (Paid)' : 'बाँकी (Unpaid)'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>सदस्यता श्रेणी:</span>
                  <span className="font-bold text-stone-900">{memberData.membershipType?.name || 'साधारण सदस्यता'}</span>
                </div>
                <div className="flex justify-between">
                  <span>वार्षिक लेबी शुल्क:</span>
                  <span className="font-bold text-stone-900 tabular-nums">रु. {memberData.membershipType?.fee || '५००'}</span>
                </div>
                <div className="flex justify-between">
                  <span>नविकरण मिति:</span>
                  <span className="font-bold text-stone-900 tabular-nums">{memberData.renewalDate || '२०८३ असार मसान्त'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100">
                <button
                  type="button"
                  className="w-full py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  अनलाइन लेबी भुक्तानी (eSewa / Khalti)
                </button>
              </div>
            </div>

          </div>

          {/* Right: Family, Bio, and Citizen Services (7 of 12) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Personal & Family Record Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-950">
                    पारिवारिक तथा व्यक्तिगत विवरण
                  </h3>
                  <p className="text-xs text-stone-500">विधान अनुसार सुरक्षित गरिएको आधिकारिक अभिलेख</p>
                </div>
                <button className="text-xs font-semibold text-crimson-700 hover:underline">
                  विवरण सम्पादन →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">बुबाको नाम (Father)</span>
                  <span className="font-bold text-stone-900">{memberData.application?.fatherName || 'श्री मानकाजी श्रेष्ठ'}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">हजुरबुबाको नाम (Grandfather)</span>
                  <span className="font-bold text-stone-900">{memberData.application?.grandfatherName || 'स्व. तीर्थलाल श्रेष्ठ'}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">नागरिकता नं. (Citizenship No)</span>
                  <span className="font-bold text-stone-900 tabular-nums">{memberData.application?.citizenshipNo || '२७-०१-७५-१२३४५ (ललितपुर)'}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">पेशा / कार्यालय (Occupation)</span>
                  <span className="font-bold text-stone-900">{memberData.application?.occupation || 'व्यापार / सामाजिक सेवा'}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 sm:col-span-2">
                  <span className="text-[10px] text-stone-500 font-medium block">स्थायी ठेगाना (Permanent Address)</span>
                  <span className="font-bold text-stone-900">{memberData.application?.addressPermanent || 'ललितपुर महानगरपालिका वडा नं. १६, क्वाछें, मंगलबजार'}</span>
                </div>
              </div>
            </div>

            {/* Emergency & Blood Donor Registry */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-950">
                    आपतकालीन सम्पर्क तथा रक्तदान स्थिति
                  </h3>
                  <p className="text-xs text-stone-500">समुदायमा रगतको आवश्यकता पर्दा तत्काल सहजीकरणका लागि</p>
                </div>
                <span className="w-8 h-8 rounded-full bg-red-100 border border-red-200 font-black text-xs text-red-800 flex items-center justify-center">
                  {memberData.idCardDetails?.bloodGroup || 'O+'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-100 gap-3 text-xs">
                <div>
                  <span className="font-bold text-stone-900 block">रक्तदाता सञ्जालमा सक्रिय हुनुहुन्छ?</span>
                  <span className="text-stone-500 text-[11px]">आवश्यक परेको बेला फोन सम्पर्क गर्न अनुमति दिइएको छ</span>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                  सक्रिय रक्तदाता (Available)
                </span>
              </div>

              <div className="text-xs text-stone-600 flex justify-between items-center pt-1">
                <span>आपतकालीन सम्पर्क नम्बर: <strong className="text-stone-900 tabular-nums">{memberData.idCardDetails?.emergencyContact || '९८४१२३४५६७'}</strong></span>
                <button className="underline text-crimson-700 font-semibold">नम्बर परिवर्तन</button>
              </div>
            </div>

            {/* Direct Portal Services */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <Link
                href="/members"
                className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-900 transition-all shadow-xs space-y-1 block"
              >
                <span className="text-xl">🎓</span>
                <h4 className="font-bold text-stone-900 mt-1">छात्रवृत्ति आवेदन</h4>
                <p className="text-[11px] text-stone-500">जेहेन्दार छात्रछात्रा शैक्षिक वृत्ति कोष फारम</p>
              </Link>

              <Link
                href="/events"
                className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-900 transition-all shadow-xs space-y-1 block"
              >
                <span className="text-xl">🏛️</span>
                <h4 className="font-bold text-stone-900 mt-1">भवन तथा हल आरक्षण</h4>
                <p className="text-[11px] text-stone-500">मंगलबजार हलमा भोज तथा विवाह बुकिङ (२५% छुट)</p>
              </Link>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}