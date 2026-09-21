'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ilakas24Data } from '@/lib/ilakaData'
import { Locale } from '@/lib/homeTranslations'
import { AnimatePresence, motion, type MotionProps } from 'framer-motion'
import { MapPin, Phone, Users, Droplet, ArrowRight } from 'lucide-react'

type MotionSpanProps = MotionProps & React.HTMLAttributes<HTMLSpanElement>
const MotionSpan = motion.span as unknown as React.FC<MotionSpanProps>

export function IlakaShowcase({ locale = 'en' }: { locale?: Locale }) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'central' | 'north' | 'south' | 'east'>('all')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const ilakas = ilakas24Data

  return (
    <div className="space-y-8 w-full">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-4 py-2 rounded-xl border transition-all min-h-[38px] ${
            selectedFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'All 24 Ilakas' : 'सबै २४ इलाका'}
        </button>
        <button
          onClick={() => setSelectedFilter('central')}
          className={`px-4 py-2 rounded-xl border transition-all min-h-[38px] ${
            selectedFilter === 'central'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'Central / Durbar Area' : 'केन्द्रीय / मंगलबजार क्षेत्र'}
        </button>
        <button
          onClick={() => setSelectedFilter('north')}
          className={`px-4 py-2 rounded-xl border transition-all min-h-[38px] ${
            selectedFilter === 'north'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'North / Pulchowk' : 'उत्तर / पुल्चोक क्षेत्र'}
        </button>
        <button
          onClick={() => setSelectedFilter('south')}
          className={`px-4 py-2 rounded-xl border transition-all min-h-[38px] ${
            selectedFilter === 'south'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'South / Lagankhel' : 'दक्षिण / लगनखेल क्षेत्र'}
        </button>
        <button
          onClick={() => setSelectedFilter('east')}
          className={`px-4 py-2 rounded-xl border transition-all min-h-[38px] ${
            selectedFilter === 'east'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
          }`}
        >
          {locale === 'en' ? 'East / Chyasal' : 'पूर्व / च्यासल क्षेत्र'}
        </button>
      </div>

      {/* Aceternity Hover Effect Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ilakas.map((ilaka, idx) => {
          const name = locale === 'en' ? ilaka.nameEn : locale === 'new' ? ilaka.nameNew : ilaka.nameNe
          const coordinatorName = locale === 'en' ? ilaka.coordinator.nameEn : ilaka.coordinator.nameNe
          const address = locale === 'en' ? ilaka.addressEn : ilaka.addressNe
          const landmarks = locale === 'en' ? ilaka.landmarksEn : ilaka.landmarksNe

          return (
            <div
              key={ilaka.id}
              className="relative group block h-full"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Aceternity Hover Background Highlight */}
              <AnimatePresence>
                {hoveredIdx === idx && (
                  <MotionSpan
                    className="absolute inset-0 h-full w-full bg-primary/10 dark:bg-primary/20 block rounded-3xl -z-0"
                    layoutId="ilakaHover"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { duration: 0.15 },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.15, delay: 0.2 },
                    }}
                  />
                )}
              </AnimatePresence>

              {/* Card Surface */}
              <div className="rounded-2xl h-full w-full overflow-hidden bg-card border border-border group-hover:border-primary/50 relative z-10 transition-all shadow-xs flex flex-col justify-between p-5 space-y-4">
                
                {/* Photo with Badges */}
                <div className="relative h-48 w-full rounded-xl overflow-hidden bg-muted">
                  <img
                    src={ilaka.image}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  {/* Ilaka Code Pill */}
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-mono font-bold px-2.5 py-1 rounded-md shadow-xs">
                    {ilaka.code}
                  </div>

                  {/* Families Count Pill */}
                  <div className="absolute bottom-3 left-3 text-white text-xs font-medium flex items-center gap-1.5 drop-shadow-sm">
                    <Users className="w-3.5 h-3.5 text-amber-300" />
                    <span>{ilaka.familiesCount} {locale === 'en' ? 'Families' : 'परिवार'}</span>
                  </div>

                  {/* Blood Donors Pill */}
                  <div className="absolute bottom-3 right-3 text-white text-xs font-medium flex items-center gap-1.5 drop-shadow-sm">
                    <Droplet className="w-3.5 h-3.5 text-rose-400" />
                    <span>{ilaka.bloodDonorsCount} {locale === 'en' ? 'Donors' : 'रक्तदाता'}</span>
                  </div>
                </div>

                {/* Content Block */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-card-foreground group-hover:text-primary transition-colors">
                      {name}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="line-clamp-1">{address}</span>
                    </p>
                  </div>

                  {/* Landmarks Badges */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {landmarks.map((landmark, lIdx) => (
                      <span
                        key={lIdx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
                      >
                        {landmark}
                      </span>
                    ))}
                  </div>

                  {/* Coordinator Strip */}
                  <div className="p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-medium block">
                        {locale === 'en' ? 'Coordinator' : 'इलाका संयोजक'}
                      </span>
                      <span className="font-bold text-card-foreground">{coordinatorName}</span>
                    </div>
                    <a
                      href={`tel:${ilaka.coordinator.phone.replace(/[^0-9]/g, '')}`}
                      className="text-primary hover:underline font-mono font-bold flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{ilaka.coordinator.phone}</span>
                    </a>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <Link
                    href={`/ilakas/${ilaka.slug}`}
                    className="font-bold text-primary hover:underline inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                  >
                    <span>{locale === 'en' ? 'View Ilaka Profile' : 'इलाका विवरण हेर्नुहोस्'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={`/ilaka/${ilaka.slug}`}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {locale === 'en' ? 'Events & Notices' : 'सूचना तथा कार्यक्रम'}
                  </Link>
                </div>

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
