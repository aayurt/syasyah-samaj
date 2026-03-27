'use client'

import Image from 'next/image'
import React from 'react'

export function LanguageLoading() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-slate-950 transition-opacity duration-300">
      <div className="relative flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-500">
        {/* Logo Container */}
        <div className="relative w-24 h-24 md:w-32 md:h-32 mb-4">
          <Image
            src="/logo.png"
            alt="Syasyah Samaj Logo"
            fill
            className="object-contain animate-pulse"
            priority
          />
        </div>

        {/* Loading Spinner */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-widest uppercase animate-pulse">
            Loading...
          </span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes loading {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(1); }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  )
}
