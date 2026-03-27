'use client'

import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { CMSLink } from '@/components/Link'
import type { Header as HeaderType } from '@/payload-types'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { Menu, SearchIcon, X } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <nav className="flex items-center gap-2 md:gap-6">
      {/* Desktop Navigation Links */}
      <div className="hidden lg:flex items-center gap-1 xl:gap-2">
        {navItems.map(({ link }, i) => {
          return (
            <CMSLink
              key={i}
              {...link}
              appearance="link"
              className="relative px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all hover:text-red-900 dark:hover:text-red-400 group"
            >
            </CMSLink>
          )
        })}
      </div>

      {/* Utility Section */}
      <div className="flex items-center gap-1 md:gap-3">
        {/* Search Icon */}
        <Link
          href="/search"
          className="p-2 rounded-xl transition-all hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-500 hover:text-red-900 dark:hover:text-red-400 group"
          title="Search"
        >
          <SearchIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
        </Link>

        {/* Vertical Divider (Desktop Only) */}
        <div className="hidden md:block w-px h-6 bg-gray-200 dark:bg-gray-800" />

        {/* Theme & Language Controls */}
        <div className="flex items-center gap-1">
          <ThemeSelector />
          <LanguageSwitcher />
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          ) : (
            <Menu className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          )}
        </button>
      </div>

      {/* Mobile Menu (Simple Overlay) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden bg-white dark:bg-slate-950 p-6 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center mb-12">
            <span className="text-2xl font-bold text-red-900 dark:text-red-400 uppercase tracking-widest">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-8 h-8 text-gray-700 dark:text-gray-200" />
            </button>
          </div>
          <div className="flex flex-col gap-6">
            {navItems.map(({ link }, i) => (
              <div key={i} onClick={() => setIsMobileMenuOpen(false)}>
                <CMSLink
                  {...link}
                  className="text-3xl font-bold text-gray-900 dark:text-white hover:text-red-900 dark:hover:text-red-400 transition-colors py-2 block border-b border-gray-100 dark:border-gray-800"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
