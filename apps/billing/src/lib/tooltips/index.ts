/**
 * Tooltip System - Unified Export
 * 
 * Provides tooltip content dictionary based on current language.
 * Integrates with i18n system for dynamic language switching.
 */
import { tooltipsEn } from './en'
import { tooltipsNe } from './ne'

export const tooltipDictionaries = {
  en: tooltipsEn,
  ne: tooltipsNe,
} as const

export type TooltipKey = keyof typeof tooltipsEn

/**
 * Get tooltip text for a key in the current language
 * Falls back to English if key not found in current language
 */
export function getTooltip(key: string, lang: 'en' | 'ne' = 'en'): string {
  const dict = lang === 'ne' ? tooltipsNe : tooltipsEn
  return dict[key] || dict[`tooltip.${key}`] || key
}

/**
 * Get all tooltip keys for a section prefix
 */
export function getTooltipKeys(prefix: string): string[] {
  return Object.keys(tooltipsEn).filter(k => k.startsWith(prefix))
}

/**
 * Validate that all English keys have Nepali translations
 */
export function validateTooltipCoverage(): { missing: string[]; extra: string[] } {
  const enKeys = new Set(Object.keys(tooltipsEn))
  const neKeys = new Set(Object.keys(tooltipsNe))
  
  const missing = Array.from(enKeys).filter(k => !neKeys.has(k))
  const extra = Array.from(neKeys).filter(k => !enKeys.has(k))
  
  return { missing, extra }
}

// Run validation on import (development only)
if (import.meta.env.DEV) {
  const { missing, extra } = validateTooltipCoverage()
  if (missing.length > 0) {
    console.warn('[Tooltips] Missing Nepali translations:', missing)
  }
  if (extra.length > 0) {
    console.warn('[Tooltips] Extra Nepali keys (not in English):', extra)
  }
}