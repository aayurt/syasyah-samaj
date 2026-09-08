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
              className="relative px-3 py-2 text-sm font-semibold text-muted-foreground transition-all hover:text-primary group"
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
          className="p-2 rounded-xl transition-all hover:bg-primary/10 text-muted-foreground hover:text-primary group"
          title="Search"
        >
          <SearchIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
        </Link>

        {/* Vertical Divider (Desktop Only) */}
        <div className="hidden md:block w-px h-6 bg-border" />

        {/* Theme & Language Controls */}
        <div className="hidden md:flex items-center gap-1">
          <ThemeSelector />
          <LanguageSwitcher />
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-foreground" />
          ) : (
            <Menu className="w-6 h-6 text-foreground" />
          )}
        </button>
      </div>

      {/* Mobile Menu (Simple Overlay) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden bg-background p-6 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center mb-12">
            <span className="text-2xl font-bold text-primary uppercase tracking-widest">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-8 h-8 text-foreground" />
            </button>
          </div>
          <div className="flex flex-col gap-6">
            <div className='flex justify-between items-center'>
              <ThemeSelector />
              <LanguageSwitcher />
            </div>
            {navItems.map(({ link }, i) => (
              <div key={i} onClick={() => setIsMobileMenuOpen(false)}>
                <CMSLink
                  {...link}
                  className="text-3xl font-bold text-foreground hover:text-primary transition-colors py-2 block border-b border-border"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
