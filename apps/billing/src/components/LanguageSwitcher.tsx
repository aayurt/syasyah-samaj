import { Languages } from 'lucide-react'
import { useLang, useT } from '../lib/i18n'

/**
 * Header language switcher — English ⇄ नेपाली.
 *
 * The UI renders in exactly one language at a time (no "नेपाली (English)"
 * hybrids), so this is the single control that flips every string: nav,
 * breadcrumbs, page chrome, buttons and toasts. The choice persists in
 * localStorage under `ui-lang` (see LangProvider) and applies instantly
 * through context — no reload needed.
 */
export default function LanguageSwitcher() {
  const { lang, setLang } = useLang()
  const t = useT()

  return (
    <div
      data-testid="language-switcher"
      role="group"
      aria-label={t('lang.title', 'Language')}
      title={t('lang.subtitle', 'Choose the interface language')}
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50/50 p-0.5 shadow-2xs"
    >
      <Languages
        size={14}
        aria-hidden="true"
        className="ml-1.5 mr-1 text-slate-500"
      />
      {(['en', 'ne'] as const).map((l) => {
        const label = l === 'en' ? 'English' : 'नेपाली'
        const active = lang === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-950/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
