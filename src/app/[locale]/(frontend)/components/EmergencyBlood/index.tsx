'use client'

import React, { useState } from 'react'

interface Donor {
  id: string
  name: string
  group: 'O+' | 'A+' | 'B+' | 'AB+' | 'NEG'
  ilaka: string
  phone: string
}

const sampleDonors: Donor[] = [
  { id: '1', name: 'अमित श्रेष्ठ', group: 'O+', ilaka: 'मंगलबजार', phone: '९८४१-०१२३४५' },
  { id: '2', name: 'प्रमिला श्रेष्ठ', group: 'A+', ilaka: 'पुल्चोक', phone: '९८५१-२३४५६७' },
  { id: '3', name: 'सञ्जय मान श्रेष्ठ', group: 'B+', ilaka: 'त्यागल', phone: '९८०१-९८७६५४' },
  { id: '4', name: 'रोशन श्रेष्ठ', group: 'AB+', ilaka: 'च्यासल', phone: '९८४१-५५६६७७' },
  { id: '5', name: 'सुशील श्रेष्ठ', group: 'O+', ilaka: 'पाटनढोका', phone: '९८५१-४४३३२२' },
]

export default function EmergencyBloodSection() {
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL')

  const filtered = sampleDonors.filter((d) => {
    if (selectedGroup === 'ALL') return true
    return d.group === selectedGroup
  })

  return (
    <div className="border border-stone-200 bg-white p-5 rounded-2xl shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-crimson-700">
            रक्त समूह आपतकालीन सञ्जाल
          </h3>
          <p className="text-[11px] text-stone-500">तत्काल रगत आवश्यक पर्दा सम्पर्क गर्नुहोस्</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded">
          २४ सै घण्टा
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {['ALL', 'O+', 'A+', 'B+', 'AB+'].map((grp) => (
          <button
            key={grp}
            onClick={() => setSelectedGroup(grp)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
              selectedGroup === grp
                ? 'bg-stone-900 text-white shadow-xs'
                : 'border border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-400'
            }`}
          >
            {grp === 'ALL' ? 'सबै समूह' : grp}
          </button>
        ))}
      </div>

      <div className="divide-y divide-stone-100 text-xs">
        {filtered.map((donor) => (
          <div key={donor.id} className="py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded bg-stone-100 border border-stone-200 font-bold flex items-center justify-center text-xs text-crimson-800">
                {donor.group}
              </span>
              <div>
                <span className="font-bold text-stone-900 block">{donor.name}</span>
                <span className="text-[10px] text-stone-500">{donor.ilaka} इलाका</span>
              </div>
            </div>
            <a
              href={`tel:${donor.phone.replace(/[^0-9]/g, '')}`}
              className="text-stone-700 hover:text-crimson-700 font-bold tabular-nums border border-stone-300 px-2.5 py-1 rounded hover:bg-stone-50 transition-colors"
            >
              {donor.phone}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}