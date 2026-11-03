import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'ui-tooltips-enabled'
const DEFAULT_ENABLED = true

interface TooltipsContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

const TooltipsContext = createContext<TooltipsContextValue>({
  enabled: DEFAULT_ENABLED,
  setEnabled: () => {},
})

export function TooltipsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === 'true'
    } catch {
      /* localStorage unavailable */
    }
    return DEFAULT_ENABLED
  })

  const setEnabled = (next: boolean) => {
    setEnabledState(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* localStorage unavailable */
    }
    window.dispatchEvent(new CustomEvent<boolean>('tooltips-changed', { detail: next }))
  }

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setEnabledState(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <TooltipsContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </TooltipsContext.Provider>
  )
}

export function useTooltips(): TooltipsContextValue {
  return useContext(TooltipsContext)
}