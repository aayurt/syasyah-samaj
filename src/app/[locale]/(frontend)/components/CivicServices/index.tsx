'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

export default function CivicServicesSection({ locale = 'en' }: { locale?: Locale }) {
  const content = getHomeContent(locale)
  const [appId, setAppId] = useState('')
  const [statusResult, setStatusResult] = useState<string | null>(null)

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!appId.trim()) return

    setStatusResult(content.services.sampleResult.replace('SS-2083-492', appId.trim()))
  }

  return (
    <div className="border border-border bg-card p-6 rounded-2xl shadow-xs space-y-5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {content.services.badge}
        </span>
        <h3 className="font-serif font-bold text-base sm:text-lg text-card-foreground mt-0.5">
          {content.services.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {content.services.subtitle}
        </p>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          type="text"
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder={content.services.placeholder}
          className="flex-1 px-3.5 py-2 text-xs border border-border rounded-xl bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-h-[44px]"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors min-h-[44px] shrink-0 shadow-xs"
        >
          {content.services.checkBtn}
        </button>
      </form>

      {statusResult && (
        <div className="p-3.5 bg-muted border border-border text-xs rounded-xl text-foreground leading-relaxed animate-in fade-in duration-200">
          <span className="font-bold text-primary">{locale === 'en' ? 'Result:' : 'परिणाम:'}</span> {statusResult}
        </div>
      )}

      <div className="pt-3 border-t border-border space-y-2 text-xs">
        <Link
          href="/login"
          className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary bg-muted/40 hover:bg-muted transition-all font-medium text-card-foreground group"
        >
          <span className="group-hover:text-primary transition-colors">{content.services.links.digitalId}</span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
        </Link>
        <Link
          href="/members"
          className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary bg-muted/40 hover:bg-muted transition-all font-medium text-card-foreground group"
        >
          <span className="group-hover:text-primary transition-colors">{content.services.links.scholarship}</span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
        </Link>
        <Link
          href="/app"
          className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary bg-muted/40 hover:bg-muted transition-all font-medium text-card-foreground group"
        >
          <span className="group-hover:text-primary transition-colors">{content.services.links.billing}</span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">↗</span>
        </Link>
      </div>
    </div>
  )
}