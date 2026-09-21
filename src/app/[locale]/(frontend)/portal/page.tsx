import React from 'react'
import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { DigitalIDCard } from '@/components/DigitalIDCard'
import { setStaticParamsLocale } from '@/locales/server'
import { toLocalizedNumber } from '@/lib/numbers'
import { Locale } from '@/lib/homeTranslations'
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
  const { locale: rawLocale } = await params
  const locale = (rawLocale as Locale) || 'en'
  setStaticParamsLocale(locale)

  const currentUser = await getCurrentUser()
  const isDemo = !currentUser

  const user = currentUser || {
    name: locale === 'en' ? 'Aayush Shrestha' : 'आयुष श्रेष्ठ',
    email: 'tester.member@syasyahsamaj.org.np',
    role: 'member',
  }

  const userRole = (user as any)?.role || 'member'

  let member: any = null
  if (currentUser) {
    try {
      const payload = await getPayload({ config: configPromise })
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
      member = memberDocs[0]
    } catch (e) {
      // fallback
    }
  }

  const memberData = member || {
    fullName: user.name || (locale === 'en' ? 'Aayush Shrestha' : 'आयुष श्रेष्ठ'),
    email: user.email,
    memberId: locale === 'en' ? 'SS-2083-049' : 'SS-२०८३-०४९',
    phoneNumber: locale === 'en' ? '9841-234567' : '९८४१-२३४५६७',
    status: 'active',
    paymentStatus: 'paid',
    tenantName: locale === 'en' ? 'Syasyah Samaj, Yala (Lalitpur)' : 'स्यस्यः समाज, यल',
    profileImage: {
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    },
    idCardDetails: {
      bloodGroup: 'O+',
      emergencyContact: locale === 'en' ? '01-5523456' : '०१-५५२३४५६',
    },
    membershipType: {
      name: locale === 'en' ? 'Lifetime Patron' : 'आजीवन (Lifetime)',
      fee: 1000,
    },
    renewalDate: locale === 'en' ? 'Permanent (Lifetime)' : 'आजीवन (स्थायी)',
    application: {
      fatherName: locale === 'en' ? 'Mankaji Shrestha' : 'श्री मानकाजी श्रेष्ठ',
      grandfatherName: locale === 'en' ? 'Late Tirthalal Shrestha' : 'स्व. तीर्थलाल श्रेष्ठ',
      citizenshipNo: locale === 'en' ? '27-01-75-12345 (Lalitpur)' : '२७-०१-७५-१२३४५ (ललितपुर)',
      occupation: locale === 'en' ? 'Civic Commerce & Heritage Preservation' : 'व्यापार / सामाजिक सेवा',
      addressPermanent: locale === 'en' ? 'Lalitpur Ward No. 16, Kwachhen, Mangalbazar' : 'ललितपुर महानगरपालिका वडा नं. १६, क्वाछें, मंगलबजार',
    },
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
                  ? 'Viewing interactive sample Member Portal dashboard with localized digits and digital ID.'
                  : 'स्थानिक अङ्क तथा डिजिटल परिचयपत्रसहितको नमुना नागरिक पोर्टल प्रदर्शन भइरहेको छ।'}
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

        {/* Portal Header */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                {locale === 'en' ? 'Citizen & Member Portal' : 'नागरिक तथा सदस्य पोर्टल'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-200">
                {userRole === 'admin'
                  ? locale === 'en' ? 'Administrator' : 'प्रशासक'
                  : userRole === 'coordinator'
                  ? locale === 'en' ? 'Ilaka Coordinator' : 'इलाका संयोजक'
                  : locale === 'en' ? 'Verified Member' : 'प्रमाणित सदस्य'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-950">
              {locale === 'en' ? 'Welcome' : 'स्वागतम्'}, {memberData.fullName}
            </h1>
            <p className="text-xs text-stone-500">
              {locale === 'en' ? 'Email:' : 'इमेल:'} {user.email} • {locale === 'en' ? 'Member ID:' : 'सदस्य दर्ता नं:'}{' '}
              {toLocalizedNumber(memberData.memberId || '', locale)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/portal/coordinator"
              className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-bold hover:bg-black transition-colors shadow-xs"
            >
              🏛️ {locale === 'en' ? 'Ilaka Coordinator Desk →' : 'इलाका सचिवालय डेस्क →'}
            </Link>
            <Link
              href="/app"
              className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 font-bold hover:bg-stone-50 transition-colors shadow-xs"
            >
              💼 {locale === 'en' ? 'Dhuku Cashier (/app) ↗' : 'स्यस्यः धुकू लेखा (/app) ↗'}
            </Link>
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
                  {locale === 'en' ? 'Official Digital Identity Card' : 'आधिकारिक डिजिटल परिचयपत्र'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  {locale === 'en' ? 'Active' : 'सक्रिय'}
                </span>
              </div>

              <div className="flex justify-center">
                <DigitalIDCard
                  member={{
                    fullName: memberData.fullName,
                    memberId: toLocalizedNumber(memberData.memberId, locale),
                    email: memberData.email,
                    phoneNumber: toLocalizedNumber(memberData.phoneNumber, locale),
                    profileImage: memberData.profileImage,
                    idCardDetails: {
                      bloodGroup: memberData.idCardDetails?.bloodGroup,
                      emergencyContact: toLocalizedNumber(memberData.idCardDetails?.emergencyContact || '', locale),
                    },
                    tenantName: memberData.tenantName,
                    membershipType: memberData.membershipType,
                    renewalDate: memberData.renewalDate,
                    paymentStatus: memberData.paymentStatus,
                  }}
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 text-xs border border-stone-300 font-semibold rounded-lg hover:bg-stone-50 text-stone-800 transition-colors"
                >
                  🖨️ {locale === 'en' ? 'Print Card' : 'परिचयपत्र छाप्नुहोस्'}
                </button>
                <button
                  type="button"
                  className="flex-1 py-2 text-xs bg-stone-900 text-white font-semibold rounded-lg hover:bg-black transition-colors shadow-xs"
                >
                  📱 {locale === 'en' ? 'Share QR Code' : 'QR कोड साझा गर्नुहोस्'}
                </button>
              </div>
            </div>

            {/* Dues & Payment Status */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h3 className="font-bold text-xs uppercase tracking-wider text-stone-700">
                  {locale === 'en' ? 'Dues & Membership Status' : 'सदस्यता शुल्क तथा लेबी स्थिति'}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    memberData.paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {memberData.paymentStatus === 'paid'
                    ? locale === 'en' ? 'Paid (Active)' : 'चुक्ता (Paid)'
                    : locale === 'en' ? 'Due' : 'बाँकी (Unpaid)'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>{locale === 'en' ? 'Tier:' : 'सदस्यता श्रेणी:'}</span>
                  <span className="font-bold text-stone-900">{memberData.membershipType?.name || 'Lifetime'}</span>
                </div>
                <div className="flex justify-between">
                  <span>{locale === 'en' ? 'Annual Dues Fee:' : 'वार्षिक लेबी शुल्क:'}</span>
                  <span className="font-bold text-stone-900 tabular-nums">
                    {locale === 'en' ? 'NRs ' : 'रु. '}
                    {toLocalizedNumber(memberData.membershipType?.fee || 1000, locale)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{locale === 'en' ? 'Renewal Status:' : 'नविकरण मिति:'}</span>
                  <span className="font-bold text-stone-900 tabular-nums">{memberData.renewalDate}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100">
                <button
                  type="button"
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-colors shadow-xs"
                >
                  💳 {locale === 'en' ? 'Pay Dues Online (eSewa / Khalti / ConnectIPS)' : 'अनलाइन लेबी भुक्तानी (eSewa / Khalti)'}
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
                    {locale === 'en' ? 'Personal & Family Registry Record' : 'पारिवारिक तथा व्यक्तिगत विवरण'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {locale === 'en' ? 'Official community archive verified by Samaj Guthi' : 'विधान अनुसार सुरक्षित गरिएको आधिकारिक अभिलेख'}
                  </p>
                </div>
                <button className="text-xs font-semibold text-primary hover:underline">
                  {locale === 'en' ? 'Edit Details →' : 'विवरण सम्पादन →'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {locale === 'en' ? "Father's Name" : 'बुबाको नाम (Father)'}
                  </span>
                  <span className="font-bold text-stone-900">{memberData.application?.fatherName}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {locale === 'en' ? "Grandfather's Name" : 'हजुरबुबाको नाम (Grandfather)'}
                  </span>
                  <span className="font-bold text-stone-900">{memberData.application?.grandfatherName}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {locale === 'en' ? 'Citizenship No.' : 'नागरिकता नं. (Citizenship No)'}
                  </span>
                  <span className="font-bold text-stone-900 tabular-nums">
                    {toLocalizedNumber(memberData.application?.citizenshipNo || '', locale)}
                  </span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {locale === 'en' ? 'Occupation / Guild' : 'पेशा / कार्यालय (Occupation)'}
                  </span>
                  <span className="font-bold text-stone-900">{memberData.application?.occupation}</span>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 sm:col-span-2">
                  <span className="text-[10px] text-stone-500 font-medium block">
                    {locale === 'en' ? 'Permanent Residence' : 'स्थायी ठेगाना (Permanent Address)'}
                  </span>
                  <span className="font-bold text-stone-900">{memberData.application?.addressPermanent}</span>
                </div>
              </div>
            </div>

            {/* Emergency & Blood Donor Registry */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-950">
                    {locale === 'en' ? 'Emergency Contact & Blood Donor Status' : 'आपतकालीन सम्पर्क तथा रक्तदान स्थिति'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {locale === 'en' ? 'Enables instant blood coordination in local Lalitpur hospitals' : 'समुदायमा रगतको आवश्यकता पर्दा तत्काल सहजीकरणका लागि'}
                  </p>
                </div>
                <span className="w-8 h-8 rounded-full bg-red-100 border border-red-200 font-black text-xs text-red-700 flex items-center justify-center">
                  {memberData.idCardDetails?.bloodGroup || 'O+'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-100 gap-3 text-xs">
                <div>
                  <span className="font-bold text-stone-900 block">
                    {locale === 'en' ? 'Active in Samaj Blood Donor Registry?' : 'रक्तदाता सञ्जालमा सक्रिय हुनुहुन्छ?'}
                  </span>
                  <span className="text-stone-500 text-[11px]">
                    {locale === 'en' ? 'Consent given to coordinator for emergency requests' : 'आवश्यक परेको बेला फोन सम्पर्क गर्न अनुमति दिइएको छ'}
                  </span>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md shrink-0">
                  {locale === 'en' ? '✓ Registered Donor' : 'सक्रिय रक्तदाता (Available)'}
                </span>
              </div>

              <div className="text-xs text-stone-600 flex justify-between items-center pt-1">
                <span>
                  {locale === 'en' ? 'Emergency Contact Phone: ' : 'आपतकालीन सम्पर्क नम्बर: '}
                  <strong className="text-stone-900 tabular-nums">
                    {toLocalizedNumber(memberData.idCardDetails?.emergencyContact || '9841-234567', locale)}
                  </strong>
                </span>
                <button className="underline text-primary font-semibold">
                  {locale === 'en' ? 'Update Phone' : 'नम्बर परिवर्तन'}
                </button>
              </div>
            </div>

            {/* Direct Portal Services */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <Link
                href="/members"
                className="p-4 rounded-xl border border-stone-200 bg-white hover:border-primary transition-all shadow-xs space-y-1 block group"
              >
                <span className="text-xl">🎓</span>
                <h4 className="font-bold text-stone-900 group-hover:text-primary mt-1">
                  {locale === 'en' ? 'Scholarship Fund Application' : 'छात्रवृत्ति आवेदन'}
                </h4>
                <p className="text-[11px] text-stone-500">
                  {locale === 'en' ? 'Endowment grants for promising high school & college students' : 'जेहेन्दार छात्रछात्रा शैक्षिक वृत्ति कोष फारम'}
                </p>
              </Link>

              <Link
                href="/events"
                className="p-4 rounded-xl border border-stone-200 bg-white hover:border-primary transition-all shadow-xs space-y-1 block group"
              >
                <span className="text-xl">🏛️</span>
                <h4 className="font-bold text-stone-900 group-hover:text-primary mt-1">
                  {locale === 'en' ? 'Community Hall & Guthi Booking' : 'भवन तथा हल आरक्षण'}
                </h4>
                <p className="text-[11px] text-stone-500">
                  {locale === 'en' ? 'Mangalbazar hall booking for cultural ceremonies (25% member discount)' : 'मंगलबजार हलमा भोज तथा विवाह बुकिङ (२५% छुट)'}
                </p>
              </Link>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}