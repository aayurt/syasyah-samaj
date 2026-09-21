'use client'

import React, { useState } from 'react'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

export interface ArchiveItem {
  id: string
  title: string
  category: 'manuscript' | 'photo' | 'guthi' | 'general'
  era?: string
  description?: string
  source?: string
  fileUrl?: string
  tag?: string
}

export default function ArchivesSection({
  locale = 'en',
  initialDocs,
}: {
  locale?: Locale
  initialDocs?: ArchiveItem[]
}) {
  const content = getHomeContent(locale)
  const [category, setCategory] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<ArchiveItem | null>(null)

  const defaultItems = content.archives.items as unknown as ArchiveItem[]
  const items = initialDocs && initialDocs.length > 0 ? initialDocs : defaultItems

  const filtered = items.filter((item) => {
    if (category === 'all') return true
    return item.category === category
  })

  return (
    <section id="archives" className="py-16 bg-muted/40 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Section Header & Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-2">
            <span className="inline-block text-xs uppercase tracking-widest text-primary font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              {content.archives.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black text-foreground tracking-tight">
              {content.archives.title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {content.archives.subtitle}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap border border-border rounded-xl p-1 bg-card text-xs shrink-0 shadow-xs">
            <button
              onClick={() => setCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                category === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {content.archives.tabAll}
            </button>
            <button
              onClick={() => setCategory('manuscript')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                category === 'manuscript'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {content.archives.tabManuscript}
            </button>
            <button
              onClick={() => setCategory('photo')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                category === 'photo'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {content.archives.tabPhoto}
            </button>
            <button
              onClick={() => setCategory('guthi')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all min-h-[36px] ${
                category === 'guthi'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {content.archives.tabGuthi}
            </button>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="group border border-border bg-card rounded-2xl p-6 hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Visual Placeholder Badge */}
                <div className="aspect-[16/9] border border-dashed border-border rounded-xl bg-muted/50 flex flex-col items-center justify-center p-4 text-center group-hover:bg-primary/5 transition-colors">
                  <span className="text-3xl mb-1">
                    {item.category === 'photo' ? '📷' : item.category === 'guthi' ? '⚖️' : '📜'}
                  </span>
                  <span className="text-xs font-bold text-foreground">{item.era}</span>
                  {item.source && (
                    <span className="text-[11px] text-muted-foreground mt-0.5">{item.source}</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-muted text-foreground rounded-full border border-border">
                    {item.tag || item.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    REF-ARC-{item.id}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-base text-card-foreground leading-snug group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {locale === 'en' ? 'Central Secretariat' : 'केन्द्रीय अभिलेख शाखा'}
                </span>
                <button
                  onClick={() => setSelectedDoc(item)}
                  className="font-bold text-primary hover:underline"
                >
                  {item.category === 'photo' ? content.archives.viewPhoto : content.archives.readMore}
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Modal Dialog */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border-2 border-border text-card-foreground rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-start">
              <h4 className="font-serif font-bold text-lg text-foreground">
                {selectedDoc.title}
              </h4>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-muted-foreground hover:text-foreground text-xl font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed border-t border-b border-border py-4 space-y-3">
              <p className="text-foreground leading-relaxed">{selectedDoc.description}</p>
              <div className="p-3 bg-muted/60 rounded-xl border border-border text-[11px] space-y-1">
                <div><strong className="text-foreground">{locale === 'en' ? 'Era / Period:' : 'कालखण्ड:'}</strong> {selectedDoc.era}</div>
                <div><strong className="text-foreground">{locale === 'en' ? 'Citation Source:' : 'स्रोत:'}</strong> {selectedDoc.source || (locale === 'en' ? 'Central Archives' : 'केन्द्रीय अभिलेख')}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {locale === 'en' ? 'Central Archives Branch, Mangal Bazaar' : 'अभिलेख शाखा, मंगलबजार'}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex-1 sm:flex-none px-4 py-2 border border-border rounded-lg hover:bg-muted font-medium transition-colors"
                >
                  {content.archives.closeBtn}
                </button>
                <button
                  onClick={() => {
                    alert(locale === 'en' ? 'Archival PDF document download initiated.' : 'अभिलेख फाइल (PDF) डाउनलोड सुरु भयो।')
                    setSelectedDoc(null)
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
                >
                  {content.archives.downloadPdf}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}