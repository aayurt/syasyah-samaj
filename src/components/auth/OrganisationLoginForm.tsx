'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth/client'
import { getPostLoginRedirect } from '@/lib/auth/roleRouting'
import { Loader2 } from 'lucide-react'
import { useCurrentLocale } from '@/locales/client'

export type PortalType = 'member' | 'coordinator' | 'accounting'

export default function OrganisationLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')
  const locale = useCurrentLocale()
  const isEn = locale === 'en'

  const [activePortal, setActivePortal] = useState<PortalType>('member')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const content = {
    step1Badge: isEn ? 'Step 1: Choose Portal' : 'गेटवे चयन (Step 1: Choose Portal)',
    mainHeading: isEn ? 'Which portal would you like to enter?' : 'तपाईं कुन प्रणालीमा प्रवेश गर्न चाहनुहुन्छ?',
    mainSub: isEn
      ? 'Select the portal corresponding to your role or needs to sign in.'
      : 'आफ्नो जिम्मेवारी वा आवश्यकता अनुसार सम्बन्धित पोर्टल छानेर लगइन गर्नुहोस्।',
    selectedText: isEn ? 'Selected' : 'चयन गरिएको',
    step2Badge: isEn ? 'Step 2: Authentication' : 'Step 2: प्रमाणीकरण (Authentication)',
    loginSuffix: isEn ? 'Sign in to' : 'मा लगइन',
    passwordLabel: isEn ? 'Security Password / PIN' : 'सुरक्षा पासवर्ड / पिन (Password / PIN)',
    forgotPassword: isEn ? 'Forgot password?' : 'पासवर्ड बिर्सनुभयो?',
    authenticating: isEn ? 'Authenticating…' : 'प्रमाणीकरण हुँदैछ...',
    newMemberPrompt: isEn ? 'New member application?' : 'नयाँ सदस्य आवेदन?',
    registerHere: isEn ? 'Register here' : 'दर्ता गर्नुहोस्',
    payloadAdmin: isEn ? 'Payload CMS Admin (/admin)' : 'Payload CMS Admin (/admin)',
    testerHeading: isEn ? '🧪 UX/UI Tester Instant Access:' : '🧪 UX/UI Tester Instant Access:',
    testerReady: isEn ? 'Ready' : 'तयार (Ready)',
    memberPortalLink: isEn ? 'Member Portal →' : 'Member Portal →',
    coordinatorDeskLink: isEn ? 'Coordinator Desk →' : 'Coordinator Desk →',
    dhukuCashierLink: isEn ? 'Dhuku Cashier (/app) ↗' : 'Dhuku Cashier (/app) ↗',
    defaultError: isEn
      ? 'Unable to sign in. Please check your credentials.'
      : 'लगइन गर्न सकिएन। कृपया विवरण जाँच गर्नुहोस्।',
    catchError: isEn
      ? 'An error occurred during sign in. Please try again.'
      : 'लगइन गर्दा त्रुटि भयो। कृपया पुनः प्रयास गर्नुहोस्।',
  }

  const portalMeta = {
    member: {
      title: isEn ? 'Citizen & Member Portal' : 'नागरिक तथा सदस्य पोर्टल',
      enTitle: isEn ? 'Personal ID & Family Records' : 'Citizen & Member Desk',
      badge: isEn ? 'Member Level' : 'सदस्य स्तर (Member)',
      badgeTag: isEn ? 'Citizen' : 'नागरिक',
      icon: '🪪',
      label: isEn ? 'Member ID, Mobile Number or Email' : 'सदस्य नम्बर, मोबाइल नम्बर वा इमेल',
      placeholder: isEn ? 'e.g. SS-2083-049 or 9841234567' : 'उदा. SS-2083-049 वा ९८४१२३४५६७',
      hint: isEn
        ? 'Digital ID card, annual levy renewal, and family registry records'
        : 'डिजिटल परिचयपत्र, वार्षिक लेबी नविकरण तथा पारिवारिक अभिलेख',
      buttonText: isEn ? 'Enter Member Portal →' : 'सदस्य पोर्टलमा प्रवेश गर्नुहोस् →',
      features: isEn
        ? [
            '• Download Digital Member ID card',
            '• Annual membership dues (levy) renewal',
            '• Family records & emergency blood network',
          ]
        : [
            '• डिजिटल परिचयपत्र डाउनलोड',
            '• वार्षिक सदस्यता शुल्क (लेबी) नविकरण',
            '• पारिवारिक अभिलेख र रक्तदाता सञ्जाल',
          ],
    },
    coordinator: {
      title: isEn ? 'Ilaka Secretariat Desk' : 'इलाका सचिवालय डेस्क',
      enTitle: isEn ? 'Ilaka Coordinator Desk' : 'Ilaka Coordinator Desk',
      badge: isEn ? 'Coordinator' : 'इलाका संयोजक (Coordinator)',
      badgeTag: isEn ? 'Ilaka' : 'इलाका',
      icon: '🏛️',
      label: isEn ? 'Coordinator Code or Official Email' : 'इलाका संयोजक कोड वा आधिकारिक इमेल',
      placeholder: isEn ? 'e.g. coordinator.ilaka01@syasyahsamaj.org.np' : 'उदा. coordinator.ilaka01@syasyahsamaj.org.np',
      hint: isEn
        ? 'Local 24 Ilaka member verification and blood donor coordination'
        : 'स्थानीय २४ इलाकाका सदस्य आवेदन प्रमाणीकरण र रक्तदाता समन्वय',
      buttonText: isEn ? 'Enter Ilaka Secretariat Desk →' : 'इलाका सचिवालय डेस्कमा प्रवेश गर्नुहोस् →',
      features: isEn
        ? [
            '• 24 Ilaka member applications verification',
            '• Guthi festival attendance & meeting records',
            '• Emergency local blood donor coordination',
          ]
        : [
            '• स्थानीय २४ इलाकाका सदस्य आवेदन प्रमाणीकरण',
            '• गुठी पर्व उपस्थिति तथा बैठक अभिलेख',
            '• आपतकालीन स्थानीय रक्तदाता समन्वय',
          ],
    },
    accounting: {
      title: isEn ? 'Syasyah Dhuku (Accounting & Cashier)' : 'स्यस्यः धुकू (लेखा तथा क्यासियर)',
      enTitle: isEn ? 'Offline Billing & Ledger SPA' : 'Accounting & Billing SPA',
      badge: isEn ? 'Accounting (/app)' : 'लेखा अधिकृत (Accounting /app)',
      badgeTag: isEn ? 'Billing /app' : 'लेखा /app',
      icon: '💼',
      label: isEn ? 'Cashier Username or Official Email' : 'क्यासियर युजरनेम वा आधिकारिक इमेल',
      placeholder: isEn ? 'e.g. cashier@syasyahsamaj.org.np' : 'उदा. cashier@syasyahsamaj.org.np',
      hint: isEn
        ? 'Daily receipts, payments, journal vouchers & offline cashier counter'
        : 'दैनिक रसिद, भुक्तानी, जर्नल भौचर तथा अफलाइन क्यासियर काउन्टर',
      buttonText: isEn ? 'Enter Syasyah Dhuku (/app) →' : 'स्यस्यः धुकू (/app) मा प्रवेश गर्नुहोस् →',
      features: isEn
        ? [
            '• Daily receipts, payments & journal vouchers',
            '• General ledger, bank reconciliation & balance',
            '• High-speed offline cashier counter operations',
          ]
        : [
            '• दैनिक रसिद, भुक्तानी तथा जर्नल भौचर',
            '• लेजर खाता, बैंक समाधान र रोक्का मौज्दात',
            '• अफलाइन क्यासियर काउन्टर सञ्चालन',
          ],
    },
  }

  const current = portalMeta[activePortal]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const email = identifier.includes('@')
        ? identifier.trim()
        : `${identifier.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@syasyahsamaj.org.np`

      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || content.defaultError)
        setLoading(false)
        return
      }

      if (redirectParam) {
        router.push(redirectParam)
        return
      }

      // Role-based routing
      if (activePortal === 'accounting') {
        router.push('/app')
      } else if (activePortal === 'coordinator') {
        router.push('/portal/coordinator')
      } else {
        const dest = getPostLoginRedirect(result.data?.user as any)
        router.push(dest)
      }
    } catch (err: any) {
      setError(err?.message || content.catchError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-sans transition-colors">
      {/* Top Gateway Selection Guidance */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 border border-stone-800 bg-stone-900 text-white dark:border-stone-700 dark:bg-stone-100 dark:text-stone-900 rounded">
          {content.step1Badge}
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-stone-950 dark:text-white">
          {content.mainHeading}
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300">
          {content.mainSub}
        </p>
      </div>

      {/* 3-Portal Card Gateway Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Portal 1: Member */}
        <button
          type="button"
          onClick={() => setActivePortal('member')}
          className={`cursor-pointer text-left p-5 rounded-xl transition-all space-y-3 min-h-[44px] ${
            activePortal === 'member'
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900 dark:border-stone-100 dark:bg-stone-800 dark:ring-stone-100'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-stone-700 dark:hover:bg-stone-800/80'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">{portalMeta.member.icon}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'member'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {activePortal === 'member' ? content.selectedText : portalMeta.member.badgeTag}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
              {portalMeta.member.title}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">{portalMeta.member.enTitle}</p>
          </div>
          <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1 pt-2 border-t border-stone-100 dark:border-stone-800">
            {portalMeta.member.features.map((feat, idx) => (
              <li key={idx}>{feat}</li>
            ))}
          </ul>
        </button>

        {/* Portal 2: Coordinator */}
        <button
          type="button"
          onClick={() => setActivePortal('coordinator')}
          className={`cursor-pointer text-left p-5 rounded-xl transition-all space-y-3 min-h-[44px] ${
            activePortal === 'coordinator'
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900 dark:border-stone-100 dark:bg-stone-800 dark:ring-stone-100'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-stone-700 dark:hover:bg-stone-800/80'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">{portalMeta.coordinator.icon}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'coordinator'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {activePortal === 'coordinator' ? content.selectedText : portalMeta.coordinator.badgeTag}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
              {portalMeta.coordinator.title}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">{portalMeta.coordinator.enTitle}</p>
          </div>
          <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1 pt-2 border-t border-stone-100 dark:border-stone-800">
            {portalMeta.coordinator.features.map((feat, idx) => (
              <li key={idx}>{feat}</li>
            ))}
          </ul>
        </button>

        {/* Portal 3: Accounting */}
        <button
          type="button"
          onClick={() => setActivePortal('accounting')}
          className={`cursor-pointer text-left p-5 rounded-xl transition-all space-y-3 min-h-[44px] ${
            activePortal === 'accounting'
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900 dark:border-stone-100 dark:bg-stone-800 dark:ring-stone-100'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-stone-700 dark:hover:bg-stone-800/80'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">{portalMeta.accounting.icon}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'accounting'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {activePortal === 'accounting' ? content.selectedText : portalMeta.accounting.badgeTag}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
              {portalMeta.accounting.title}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">{portalMeta.accounting.enTitle}</p>
          </div>
          <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1 pt-2 border-t border-stone-100 dark:border-stone-800">
            {portalMeta.accounting.features.map((feat, idx) => (
              <li key={idx}>{feat}</li>
            ))}
          </ul>
        </button>
      </div>

      {/* Step 2: Contextual Authentication Form */}
      <div className="border-2 border-stone-900 dark:border-stone-700 bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-2xl max-w-xl mx-auto shadow-sm space-y-5 transition-colors">
        <div className="flex justify-between items-center pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {content.step2Badge}
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-950 dark:text-white mt-0.5">
              {isEn ? `${content.loginSuffix} ${current.title}` : `${current.title} ${content.loginSuffix}`}
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 border border-stone-300 dark:border-stone-700 rounded bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
            {current.badge}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-900 dark:text-stone-200 mb-1 text-xs sm:text-sm">
              {current.label}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={current.placeholder}
              required
              className="w-full px-3 py-2.5 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-950 text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 focus:ring-1 focus:ring-stone-900 dark:focus:ring-stone-100 min-h-[44px] transition-colors"
            />
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              {current.hint}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-stone-900 dark:text-stone-200 text-xs sm:text-sm">
                {content.passwordLabel}
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] underline text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white transition-colors"
              >
                {content.forgotPassword}
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2.5 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-950 text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-stone-900 dark:focus:border-stone-100 focus:ring-1 focus:ring-stone-900 dark:focus:ring-stone-100 min-h-[44px] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] shadow-xs text-xs sm:text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{content.authenticating}</span>
              </>
            ) : (
              <span>{current.buttonText}</span>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
          <span>
            {content.newMemberPrompt}{' '}
            <Link href="/members" className="font-bold underline text-stone-900 dark:text-white">
              {content.registerHere}
            </Link>
          </span>
          <Link href="/admin" className="underline hover:text-stone-900 dark:hover:text-white transition-colors">
            {content.payloadAdmin}
          </Link>
        </div>

        {/* UX/UI Tester Instant Preview Shortcuts */}
        <div className="p-3 bg-stone-50 dark:bg-stone-950/80 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-2 transition-colors">
          <div className="font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between text-[11px]">
            <span>{content.testerHeading}</span>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded">
              {content.testerReady}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Link
              href="/portal"
              className="px-2.5 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded font-medium text-stone-800 dark:text-stone-200 hover:border-stone-900 dark:hover:border-stone-100 hover:text-black dark:hover:text-white transition-colors"
            >
              {content.memberPortalLink}
            </Link>
            <Link
              href="/portal/coordinator"
              className="px-2.5 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded font-medium text-stone-800 dark:text-stone-200 hover:border-stone-900 dark:hover:border-stone-100 hover:text-black dark:hover:text-white transition-colors"
            >
              {content.coordinatorDeskLink}
            </Link>
            <Link
              href="/app"
              className="px-2.5 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded font-medium text-stone-800 dark:text-stone-200 hover:border-stone-900 dark:hover:border-stone-100 hover:text-black dark:hover:text-white transition-colors"
            >
              {content.dhukuCashierLink}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}