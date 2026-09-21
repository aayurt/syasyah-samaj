'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function CivicServicesSection() {
  const [appId, setAppId] = useState('')
  const [statusResult, setStatusResult] = useState<string | null>(null)

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!appId.trim()) return

    setStatusResult(`आवेदन #${appId.trim()} — सम्बन्धित इलाका संयोजकबाट सिफारिस प्राप्त भएको छ। डिजिटल परिचयपत्र जारी हुने क्रममा छ।`)
  }

  return (
    <div className="border border-stone-200 bg-white p-6 rounded-2xl shadow-xs space-y-5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-crimson-700">नागरिक सेवा बडापत्र</span>
        <h3 className="font-serif font-bold text-base text-stone-950 mt-0.5">
          अनलाइन नागरिक सेवा तथा स्थिति ट्र्याकर
        </h3>
        <p className="text-xs text-stone-500">
          आवेदन दर्ता नम्बर प्रविष्ट गरी आफ्नो सिफारिस वा परिचयपत्रको स्थिति जाँच्नुहोस्
        </p>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="आवेदन नं. (उदा. SS-2083-492)"
          className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors min-h-[44px]"
        >
          स्थिति जाँच
        </button>
      </form>

      {statusResult && (
        <div className="p-3 bg-stone-50 border border-stone-200 text-xs rounded-lg text-stone-800 leading-relaxed">
          <span className="font-bold text-stone-950">परिणाम:</span> {statusResult}
        </div>
      )}

      <div className="pt-3 border-t border-stone-100 space-y-2 text-xs">
        <Link
          href="/login"
          className="flex items-center justify-between p-2.5 rounded-lg border border-stone-200 hover:border-stone-900 bg-stone-50/50 hover:bg-white transition-all font-medium text-stone-900"
        >
          <span>🪪 डिजिटल परिचयपत्र तथा शुल्क नविकरण</span>
          <span className="text-stone-400">→</span>
        </Link>
        <Link
          href="/members"
          className="flex items-center justify-between p-2.5 rounded-lg border border-stone-200 hover:border-stone-900 bg-stone-50/50 hover:bg-white transition-all font-medium text-stone-900"
        >
          <span>🎓 जेहेन्दार छात्रवृत्ति आवेदन फारम</span>
          <span className="text-stone-400">→</span>
        </Link>
        <Link
          href="/app"
          className="flex items-center justify-between p-2.5 rounded-lg border border-stone-200 hover:border-stone-900 bg-stone-50/50 hover:bg-white transition-all font-medium text-stone-900"
        >
          <span>💼 स्यस्यः धुकू लेखा तथा बिलिङ प्रणाली (/app)</span>
          <span className="text-stone-400">↗</span>
        </Link>
      </div>
    </div>
  )
}