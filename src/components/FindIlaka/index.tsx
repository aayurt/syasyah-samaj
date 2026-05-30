'use client'

import React, { useState, useEffect } from 'react'
import { Search, MapPin, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Ilaka {
  id: string
  name: string
  slug: string
  location?: {
    address?: string
  }
}

export const FindIlaka: React.FC<{ initialIlakas: Ilaka[] }> = ({ initialIlakas }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<Ilaka[]>([])

  useEffect(() => {
    if (searchTerm.length > 1) {
      const filtered = initialIlakas.filter(ilaka =>
        ilaka.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ilaka.location?.address?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setResults(filtered.slice(0, 5))
    } else {
      setResults([])
    }
  }, [searchTerm, initialIlakas])

  return (
    <div className="relative w-full max-w-xl mx-auto z-50">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <input
          type="text"
          placeholder="Enter your village or area to find your Ilaka..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl border bg-background/80 backdrop-blur-xl shadow-2xl outline-none focus:ring-2 ring-primary/20 transition-all text-lg"
        />
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full mt-2 w-full bg-background border rounded-2xl shadow-2xl overflow-hidden"
          >
            {results.map((ilaka) => (
              <Link
                key={ilaka.id}
                href={`/ilaka/${ilaka.slug}`}
                className="flex items-center justify-between p-4 hover:bg-muted transition-colors border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <div className="font-bold">{ilaka.name}</div>
                        <div className="text-xs text-muted-foreground">{ilaka.location?.address || 'View Details'}</div>
                    </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
