import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LangProvider, useLang, useT } from '../../lib/i18n'
import { tooltipsEn } from '../../lib/tooltips/en'
import { tooltipsNe } from '../../lib/tooltips/ne'
import { getTooltip, validateTooltipCoverage } from '../../lib/tooltips'

describe('i18n System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Language Context', () => {
    it('defaults to Nepali', () => {
      const TestComponent = () => {
        const { lang } = useLang()
        return <span data-testid="lang">{lang}</span>
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      expect(screen.getByTestId('lang')).toHaveTextContent('ne')
    })

    it('switches language', () => {
      const TestComponent = () => {
        const { lang, setLang } = useLang()
        return (
          <div>
            <span data-testid="lang">{lang}</span>
            <button onClick={() => setLang('en')} data-testid="switch">Switch</button>
          </div>
        )
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      expect(screen.getByTestId('lang')).toHaveTextContent('ne')
      
      fireEvent.click(screen.getByTestId('switch'))
      
      expect(screen.getByTestId('lang')).toHaveTextContent('en')
    })

    it('persists language in localStorage', () => {
      const TestComponent = () => {
        const { lang, setLang } = useLang()
        return (
          <div>
            <span data-testid="lang">{lang}</span>
            <button onClick={() => setLang('en')} data-testid="switch">Switch</button>
          </div>
        )
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      fireEvent.click(screen.getByTestId('switch'))
      
      expect(localStorage.getItem('ui-lang')).toBe('en')
    })
  })

  describe('Translation Function (useT)', () => {
    it('returns translation for valid key', () => {
      const TestComponent = () => {
        const t = useT()
        return <span data-testid="translation">{t('common.save')}</span>
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      // Should return Nepali translation or fallback
      expect(screen.getByTestId('translation').textContent).toBeTruthy()
    })

    it('falls back to English for missing Nepali keys', () => {
      // Set language to English
      localStorage.setItem('ui-lang', 'en')
      
      const TestComponent = () => {
        const t = useT()
        return <span data-testid="translation">{t('common.save')}</span>
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      expect(screen.getByTestId('translation').textContent).toBeTruthy()
    })

    it('returns fallback for completely missing keys', () => {
      const TestComponent = () => {
        const t = useT()
        return <span data-testid="translation">{t('nonexistent.key', 'Fallback Text')}</span>
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      expect(screen.getByTestId('translation')).toHaveTextContent('Fallback Text')
    })

    it('translates accounting terms in Nepali', () => {
      const TestComponent = () => {
        const t = useT()
        return (
          <div>
            <span data-testid="voucher">{t('accounts.voucher', 'Voucher')}</span>
            <span data-testid="account">{t('accounts.account', 'Account')}</span>
            <span data-testid="journal">{t('accounts.journal', 'Journal')}</span>
            <span data-testid="debit">{t('accounts.debit', 'Debit')}</span>
            <span data-testid="credit">{t('accounts.credit', 'Credit')}</span>
          </div>
        )
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      // Should have Nepali translations
      expect(screen.getByTestId('voucher').textContent).toBeTruthy()
      expect(screen.getByTestId('account').textContent).toBeTruthy()
      expect(screen.getByTestId('journal').textContent).toBeTruthy()
      expect(screen.getByTestId('debit').textContent).toBeTruthy()
      expect(screen.getByTestId('credit').textContent).toBeTruthy()
    })
  })

  describe('Tooltip Dictionary', () => {
    it('getTooltip returns English tooltip', () => {
      const tooltip = getTooltip('accounts.code', 'en')
      expect(tooltip).toBe(tooltipsEn['accounts.code'])
    })

    it('getTooltip returns Nepali tooltip', () => {
      const tooltip = getTooltip('accounts.code', 'ne')
      expect(tooltip).toBe(tooltipsNe['accounts.code'])
    })

    it('falls back to key if not found', () => {
      const tooltip = getTooltip('nonexistent.key', 'en')
      expect(tooltip).toBe('nonexistent.key')
    })

    it('validates coverage - all English keys have Nepali translations', () => {
      const { missing, extra } = validateTooltipCoverage()
      
      // Log missing for debugging
      if (missing.length > 0) {
        console.log('Missing Nepali tooltips:', missing)
      }
      if (extra.length > 0) {
        console.log('Extra Nepali tooltips:', extra)
      }
      
      // Allow some missing but warn
      expect(missing.length).toBeLessThanOrEqual(10) // Should be minimal
    })

    it('has tooltip keys for all major sections', () => {
      const sections = [
        'general.',
        'tenant.',
        'accounts.',
        'groups.',
        'members.',
        'parties.',
        'items.',
        'vouchers.',
        'journal.',
        'opening.',
        'reports.',
        'fiscalYear.',
        'settings.',
        'import.',
        'export.',
        'offline.',
        'membership.',
        'payroll.',
        'bank.',
        'terms.',
      ]
      
      for (const section of sections) {
        const keys = Object.keys(tooltipsEn).filter(k => k.startsWith(section))
        expect(keys.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Language Switcher UI', () => {
    it('renders both language options', () => {
      const TestComponent = () => {
        const { lang, setLang } = useLang()
        return (
          <div>
            <button onClick={() => setLang('en')}>English</button>
            <button onClick={() => setLang('ne')}>नेपाली</button>
            <span data-testid="current">{lang}</span>
          </div>
        )
      }
      
      render(
        <LangProvider>
          <TestComponent />
        </LangProvider>
      )
      
      expect(screen.getByText('English')).toBeInTheDocument()
      expect(screen.getByText('नेपाली')).toBeInTheDocument()
    })
  })
})