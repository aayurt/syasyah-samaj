const env = (import.meta as unknown as { env?: Record<string, string> }).env

export const API_BASE: string =
  env?.VITE_API_URL || 'http://localhost:3000'
