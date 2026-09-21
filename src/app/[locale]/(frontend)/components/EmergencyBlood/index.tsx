'use client'

import React, { useState } from 'react'
import { getHomeContent, Locale } from '@/lib/homeTranslations'

interface Donor {
  id: string
  name: string
  group: string
  ilaka: string
  phone: string
}

export default function EmergencyBloodSection({ locale = 'en' }: { locale?: Locale }) {
  const content = getHomeContent(locale)
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL')

  const donors: Donor[] = content.blood.donors as any

  const filtered = donors.filter((d) => {
    if (selectedGroup === 'ALL') return true
    return d.group === selectedGroup
  })

  return (
    <div className="border border-border bg-card p-6 rounded-2xl shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-primary">
            {content.blood.title}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {content.blood.subtitle}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
          {content.blood.hours}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {['ALL', 'O+', 'A+', 'B+', 'AB+'].map((grp) => (
          <button
            key={grp}
            onClick={() => setSelectedGroup(grp)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[32px] ${
              selectedGroup === grp
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {grp === 'ALL' ? content.blood.allGroups : grp}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border text-xs">
        {filtered.map((donor) => (
          <div key={donor.id} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 font-black flex items-center justify-center text-xs text-primary">
                {donor.group}
              </span>
              <div>
                <span className="font-bold text-card-foreground block">{donor.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {donor.ilaka} {locale === 'en' ? 'Ilaka' : 'इलाका'}
                </span>
              </div>
            </div>
            <a
              href={`tel:${donor.phone.replace(/[^0-9]/g, '')}`}
              className="text-foreground hover:text-primary font-bold tabular-nums border border-border bg-card px-3 py-1 rounded-lg hover:bg-muted transition-colors text-xs flex items-center gap-1.5"
            >
              <span>📞</span>
              <span>{donor.phone}</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}