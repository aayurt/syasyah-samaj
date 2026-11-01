import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { LangContext } from '../lib/i18n'

/**
 * Render with the app's real i18n dictionaries locked to English.
 *
 * Without a LangProvider the LangContext default is Nepali (DEFAULT_LANG),
 * which would make text assertions locale-dependent. Components under test
 * still exercise the real `useT`/`docTypeLabel` lookup paths.
 */
export function renderEn(ui: ReactElement, options?: RenderOptions): RenderResult {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      {ui}
    </LangContext.Provider>,
    options,
  )
}
