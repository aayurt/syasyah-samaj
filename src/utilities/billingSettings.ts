import type { Payload } from 'payload'

/**
 * Loads the billing-settings global (default accounts, fiscal year, freeze
 * date). Returns an empty object when the global is unset, so callers can
 * treat missing settings as "not configured".
 */
export async function getBillingSettings(payload: Payload): Promise<any> {
  try {
    return (await payload.findGlobal({
      slug: 'billing-settings',
      depth: 0,
    })) as any
  } catch {
    return {}
  }
}
