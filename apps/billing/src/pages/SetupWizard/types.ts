import type { ComponentType } from 'react'
import type { BillingSettings } from '../../lib/types'
import type { AIModel } from '../../lib/ai/schemas'
import type { TenantOption } from '../../lib/tenant'

export interface StepDef {
  key: string
  title: string
  blurb: string
  icon: ComponentType<{ size?: number; className?: string }>
  optional?: boolean
}

export interface CompanyFormData {
  companyName: string
  companyPan: string
  companyContact: string
  companyEmail: string
  companyAddress: string
}

export interface SubCompanyFormData {
  name: string
  code: string
  type: 'illaka'
  active: boolean
  slug: string
  pan: string
}

export interface NewParentCompanyFormData {
  name: string
  code: string
  pan: string
  contact: string
  email: string
  address: string
}

export interface SeedColumn {
  key: string
  label: string
  type: 'readonly' | 'text' | 'number' | 'select' | 'boolean'
  options?: string[]
}

export interface SeedTableProps {
  collection: string
  title: string
  subtitle: string
  seedKey: string
  stepKey?: string
  seedLabel: string
  icon: React.ReactNode
  columns: SeedColumn[]
  aiModel?: AIModel
  aiLabel?: string
  seedRows?: any[]
  depth?: number
  tenantId: string
  tenantQuery: Record<string, any>
  setSeedDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setAiOpen: (open: boolean) => void
  setAiInitialModel: (model: AIModel | null) => void
  onSuccess?: () => void
  isInherited?: boolean
  inheritedFromParentName?: string
}
