'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth/client'
import { getPostLoginRedirect } from '@/lib/auth/roleRouting'
import { Loader2 } from 'lucide-react'

export type PortalType = 'member' | 'coordinator' | 'accounting'

export default function OrganisationLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const [activePortal, setActivePortal] = useState<PortalType>('member')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const portalMeta = {
    member: {
      title: 'नागरिक तथा सदस्य पोर्टल',
      enTitle: 'Citizen & Member Portal',
      badge: 'सदस्य स्तर (Member)',
      icon: '🪪',
      label: 'सदस्य नम्बर, मोबाइल नम्बर वा इमेल',
      placeholder: 'उदा. SS-2083-049 वा ९८४१२३४५६७',
      hint: 'डिजिटल परिचयपत्र, वार्षिक लेबी नविकरण तथा पारिवारिक अभिलेख',
      buttonText: 'सदस्य पोर्टलमा प्रवेश गर्नुहोस् →',
    },
    coordinator: {
      title: 'इलाका सचिवालय डेस्क',
      enTitle: 'Ilaka Coordinator Desk',
      badge: 'इलाका संयोजक (Coordinator)',
      icon: '🏛️',
      label: 'इलाका संयोजक कोड वा आधिकारिक इमेल',
      placeholder: 'उदा. coordinator.ilaka01@syasyahsamaj.org.np',
      hint: 'स्थानीय २४ इलाकाका सदस्य आवेदन प्रमाणीकरण र रक्तदाता समन्वय',
      buttonText: 'इलाका सचिवालय डेस्कमा प्रवेश गर्नुहोस् →',
    },
    accounting: {
      title: 'स्यस्यः धुकू (लेखा तथा क्यासियर)',
      enTitle: 'Accounting & Billing SPA (/app)',
      badge: 'लेखा अधिकृत (Accounting /app)',
      icon: '💼',
      label: 'क्यासियर युजरनेम वा आधिकारिक इमेल',
      placeholder: 'उदा. cashier@syasyahsamaj.org.np',
      hint: 'दैनिक रसिद, भुक्तानी, जर्नल भौचर तथा अफलाइन क्यासियर काउन्टर',
      buttonText: 'स्यस्यः धुकू (/app) मा प्रवेश गर्नुहोस् →',
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
        setError(result.error.message || 'लगइन गर्न सकिएन। कृपया विवरण जाँच गर्नुहोस्।')
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
      setError(err?.message || 'लगइन गर्दा त्रुटि भयो। कृपया पुनः प्रयास गर्नुहोस्।')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 font-sans">
      
      {/* Top Gateway Selection Guidance */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 border border-stone-800 bg-stone-900 text-white rounded">
          गेटवे चयन (Step 1: Choose Portal)
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-stone-950">
          तपाईं कुन प्रणालीमा प्रवेश गर्न चाहनुहुन्छ?
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          आफ्नो जिम्मेवारी वा आवश्यकता अनुसार सम्बन्धित पोर्टल छानेर लगइन गर्नुहोस्।
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
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">🪪</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'member'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {activePortal === 'member' ? 'चयन गरिएको (Selected)' : 'नागरिक'}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900">नागरिक तथा सदस्य पोर्टल</h3>
            <p className="text-xs text-stone-500">Citizen & Member Desk</p>
          </div>
          <ul className="text-xs text-stone-600 space-y-1 pt-2 border-t border-stone-100">
            <li>• डिजिटल परिचयपत्र डाउनलोड</li>
            <li>• वार्षिक सदस्यता शुल्क (लेबी) नविकरण</li>
            <li>• पारिवारिक अभिलेख र रक्तदाता सञ्जाल</li>
          </ul>
        </button>

        {/* Portal 2: Coordinator */}
        <button
          type="button"
          onClick={() => setActivePortal('coordinator')}
          className={`cursor-pointer text-left p-5 rounded-xl transition-all space-y-3 min-h-[44px] ${
            activePortal === 'coordinator'
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">🏛️</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'coordinator'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {activePortal === 'coordinator' ? 'चयन गरिएको (Selected)' : 'इलाका'}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900">इलाका सचिवालय डेस्क</h3>
            <p className="text-xs text-stone-500">Ilaka Coordinator Desk</p>
          </div>
          <ul className="text-xs text-stone-600 space-y-1 pt-2 border-t border-stone-100">
            <li>• स्थानीय २४ इलाकाका सदस्य आवेदन प्रमाणीकरण</li>
            <li>• गुठी पर्व उपस्थिति तथा बैठक अभिलेख</li>
            <li>• आपतकालीन स्थानीय रक्तदाता समन्वय</li>
          </ul>
        </button>

        {/* Portal 3: Accounting */}
        <button
          type="button"
          onClick={() => setActivePortal('accounting')}
          className={`cursor-pointer text-left p-5 rounded-xl transition-all space-y-3 min-h-[44px] ${
            activePortal === 'accounting'
              ? 'border-2 border-stone-900 bg-white shadow-sm ring-1 ring-stone-900'
              : 'border border-stone-200 bg-stone-50/70 hover:border-stone-400 hover:bg-white'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-2xl">💼</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                activePortal === 'accounting'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {activePortal === 'accounting' ? 'चयन गरिएको (Selected)' : 'लेखा /app'}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-stone-900">स्यस्यः धुकू (लेखा तथा क्यासियर)</h3>
            <p className="text-xs text-stone-500">Accounting & Billing SPA</p>
          </div>
          <ul className="text-xs text-stone-600 space-y-1 pt-2 border-t border-stone-100">
            <li>• दैनिक रसिद, भुक्तानी तथा जर्नल भौचर</li>
            <li>• लेजर खाता, बैंक समाधान र रोक्का मौज्दात</li>
            <li>• अफलाइन क्यासियर काउन्टर सञ्चालन</li>
          </ul>
        </button>

      </div>

      {/* Step 2: Contextual Authentication Form */}
      <div className="border-2 border-stone-900 bg-white p-6 sm:p-8 rounded-2xl max-w-xl mx-auto shadow-xs space-y-5">
        
        <div className="flex justify-between items-center pb-3 border-b border-stone-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Step 2: प्रमाणीकरण (Authentication)
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-950 mt-0.5">
              {current.title} मा लगइन
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 border border-stone-300 rounded bg-stone-50 text-stone-800">
            {current.badge}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div>
            <label className="block font-bold text-stone-900 mb-1">
              {current.label}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={current.placeholder}
              required
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 min-h-[44px]"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              {current.hint}
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-bold text-stone-900">
                सुरक्षा पासवर्ड / पिन (Password / PIN)
              </label>
              <Link href="/forgot-password" className="text-[11px] underline text-stone-600 hover:text-stone-950">
                पासवर्ड बिर्सनुभयो?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-xs text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-stone-900 hover:bg-black text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>प्रमाणीकरण हुँदैछ...</span>
              </>
            ) : (
              <span>{current.buttonText}</span>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>नयाँ सदस्य आवेदन? <Link href="/members" className="font-bold underline text-stone-900">दर्ता गर्नुहोस्</Link></span>
          <Link href="/admin" className="underline hover:text-stone-900">Payload CMS Admin (/admin)</Link>
        </div>

        {/* UX/UI Tester Instant Preview Shortcuts */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
          <div className="font-bold text-stone-700 flex items-center justify-between text-[11px]">
            <span>🧪 UX/UI Tester Instant Access:</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Ready</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Link
              href="/portal"
              className="px-2.5 py-1 bg-white border border-stone-300 rounded font-medium text-stone-800 hover:border-stone-900 hover:text-black transition-colors"
            >
              Member Portal →
            </Link>
            <Link
              href="/portal/coordinator"
              className="px-2.5 py-1 bg-white border border-stone-300 rounded font-medium text-stone-800 hover:border-stone-900 hover:text-black transition-colors"
            >
              Coordinator Desk →
            </Link>
            <Link
              href="/app"
              className="px-2.5 py-1 bg-white border border-stone-300 rounded font-medium text-stone-800 hover:border-stone-900 hover:text-black transition-colors"
            >
              Dhuku Cashier (/app) ↗
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}