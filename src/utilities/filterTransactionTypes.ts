/**
 * Filters DOC_TYPE_OPTIONS based on the billing settings transaction type toggles.
 * Returns only the transaction types where the corresponding toggle is enabled (true).
 * 
 * This ensures that when a toggle is turned off in Billing Settings → Transaction Types,
 * that transaction type is completely removed from the new transaction form's type selection.
 * 
 * @param settings - The billing settings document (or partial with toggle fields)
 * @returns Filtered list of DOC_TYPE_OPTIONS where toggles are enabled
 */
import type { DOC_TYPE_OPTIONS } from '@/collections/DocSequences'

export interface BillingSettingsToggles {
  receiptVoucherEnabled?: boolean
  paymentVoucherEnabled?: boolean
  journalVoucherEnabled?: boolean
  contraVoucherEnabled?: boolean
  salesInvoiceEnabled?: boolean
  purchaseInvoiceEnabled?: boolean
  creditNoteEnabled?: boolean
  debitNoteEnabled?: boolean
  grnEnabled?: boolean
  deliveryChallanEnabled?: boolean
}

/**
 * Gets the current billing settings toggles from the payload global config.
 * Returns default all-enabled if settings cannot be fetched.
 */
export async function getBillingSettingsToggles(
  payload: any
): Promise<BillingSettingsToggles> {
  try {
    const result = await payload.findGlobal({
      slug: 'billing-settings',
      depth: 0,
    })

    const toggles: BillingSettingsToggles = {
      receiptVoucherEnabled: true,
      paymentVoucherEnabled: true,
      journalVoucherEnabled: true,
      contraVoucherEnabled: true,
      salesInvoiceEnabled: true,
      purchaseInvoiceEnabled: true,
      creditNoteEnabled: true,
      debitNoteEnabled: true,
      grnEnabled: true,
      deliveryChallanEnabled: true,
    }

    // Safely extract toggle values from the nested structure
    const ts = result?.transactionTypeToggles
    if (ts) {
      if (ts.receiptVoucherEnabled !== undefined) toggles.receiptVoucherEnabled = ts.receiptVoucherEnabled
      if (ts.paymentVoucherEnabled !== undefined) toggles.paymentVoucherEnabled = ts.paymentVoucherEnabled
      if (ts.journalVoucherEnabled !== undefined) toggles.journalVoucherEnabled = ts.journalVoucherEnabled
      if (ts.contraVoucherEnabled !== undefined) toggles.contraVoucherEnabled = ts.contraVoucherEnabled
      if (ts.salesInvoiceEnabled !== undefined) toggles.salesInvoiceEnabled = ts.salesInvoiceEnabled
      if (ts.purchaseInvoiceEnabled !== undefined) toggles.purchaseInvoiceEnabled = ts.purchaseInvoiceEnabled
      if (ts.creditNoteEnabled !== undefined) toggles.creditNoteEnabled = ts.creditNoteEnabled
      if (ts.debitNoteEnabled !== undefined) toggles.debitNoteEnabled = ts.debitNoteEnabled
      if (ts.grnEnabled !== undefined) toggles.grnEnabled = ts.grnEnabled
      if (ts.deliveryChallanEnabled !== undefined) toggles.deliveryChallanEnabled = ts.deliveryChallanEnabled
    }

    return toggles
  } catch {
    // Return all enabled as default if settings cannot be fetched
    return {
      receiptVoucherEnabled: true,
      paymentVoucherEnabled: true,
      journalVoucherEnabled: true,
      contraVoucherEnabled: true,
      salesInvoiceEnabled: true,
      purchaseInvoiceEnabled: true,
      creditNoteEnabled: true,
      debitNoteEnabled: true,
      grnEnabled: true,
      deliveryChallanEnabled: true,
    }
  }
}

/**
 * Filters DOC_TYPE_OPTIONS based on billing settings toggles.
 * Only includes transaction types where the corresponding toggle is true.
 * 
 * @param payload - Payload instance for fetching settings
 * @returns Filtered transaction type options
 */
export async function getFilteredDocTypeOptions(
  payload: any
): Promise<typeof DOC_TYPE_OPTIONS> {
  const toggles = await getBillingSettingsToggles(payload)

  return DOC_TYPE_OPTIONS.filter((option) => {
    const value = option.value as keyof BillingSettingsToggles

    // Map doc type values to toggle field names
    const toggleMap: Record<string, keyof BillingSettingsToggles> = {
      'receipt-voucher': 'receiptVoucherEnabled',
      'payment-voucher': 'paymentVoucherEnabled',
      'journal-voucher': 'journalVoucherEnabled',
      'contra-voucher': 'contraVoucherEnabled',
      'sales-invoice': 'salesInvoiceEnabled',
      'purchase-invoice': 'purchaseInvoiceEnabled',
      'credit-note': 'creditNoteEnabled',
      'debit-note': 'debitNoteEnabled',
      grn: 'grnEnabled',
      'delivery-challan': 'deliveryChallanEnabled',
    }

    const toggleField = toggleMap[value]
    if (!toggleField) return true // include if no mapping (unexpected type)

    return toggles[toggleField] !== false // include if toggle is true or undefined
  })
}