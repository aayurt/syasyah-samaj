import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard, Download, Edit3, FileText, Image, MoreVertical, Plus, Printer, Table2, Trash2, X } from 'lucide-react'
import { api, useSyncState, fmt } from '../lib/api'
import { API_BASE } from '../lib/base'
import SearchSelect from '../components/SearchSelect'
import { downloadCsv } from '../lib/csv'
import { useSearchParams } from 'react-router-dom'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import SearchBox from '../components/SearchBox'
import { DISTRICTS } from '../lib/districts'
import MemberViewModal from '../components/MemberViewModal'

/* ─────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────── */

type Member = {
  id: number
  fullName: string
  email: string
  membershipType?: { id: number; name: string; fee: number } | null
  paymentStatus?: string
  renewalDate?: string | null
  lastReceipt?: { id: number; number: string } | null
  tenant?: { id: number; name: string; code?: string } | null
  updatedAt?: string
  profileImage?: { id: number; url: string } | number | null
  phoneNumber?: string
  idCardDetails?: { bloodGroup?: string; emergencyContact?: string }
  application?: {
    citizenshipNo?: string
    citizenshipIssuedDateBs?: string
    citizenshipDistrict?: string
    addressPermanent?: string
    addressTemporary?: string
    mobile?: string
    specialQualification?: string
    occupation?: string
    officeName?: string
    fatherName?: string
    grandfatherName?: string
    fatherInLawName?: string
    spouseName?: string
    sonName?: string
    daughterName?: string
    appliedDateBs?: string
  }
}

type ViewMode = 'table' | 'application'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/* ─────────────────────────────────────────────────────────────
   Application Form state
   ───────────────────────────────────────────────────────────── */

const blankForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  membershipTypeId: '',
  bloodGroup: '',
  citizenshipNo: '',
  citizenshipIssuedDateBs: '',
  citizenshipDistrict: '',
  addressPermanent: '',
  addressTemporary: '',
  mobile: '',
  specialQualification: '',
  occupation: '',
  officeName: '',
  grandfatherName: '',
  fatherName: '',
  fatherInLawName: '',
  spouseName: '',
  sonName: '',
  daughterName: '',
  appliedDateBs: '',
  profileImageId: null as number | null,
  profileImageUrl: '',
}

type FormState = typeof blankForm

function toFormState(m: Member): FormState {
  const img = m.profileImage
  const imgUrl = img && typeof img === 'object' && 'url' in img ? (img as { url: string }).url : ''
  const imgId = img && typeof img === 'object' && 'id' in img ? (img as { id: number }).id : typeof img === 'number' ? img : null
  return {
    fullName: m.fullName || '',
    email: m.email || '',
    phoneNumber: (m as Record<string, unknown>).phoneNumber as string || '',
    membershipTypeId: m.membershipType ? String(m.membershipType.id) : '',
    bloodGroup: m.idCardDetails?.bloodGroup || '',
    citizenshipNo: m.application?.citizenshipNo || '',
    citizenshipIssuedDateBs: m.application?.citizenshipIssuedDateBs || '',
    citizenshipDistrict: m.application?.citizenshipDistrict || '',
    addressPermanent: m.application?.addressPermanent || '',
    addressTemporary: m.application?.addressTemporary || '',
    mobile: m.application?.mobile || '',
    specialQualification: m.application?.specialQualification || '',
    occupation: m.application?.occupation || '',
    officeName: m.application?.officeName || '',
    grandfatherName: m.application?.grandfatherName || '',
    fatherName: m.application?.fatherName || '',
    fatherInLawName: m.application?.fatherInLawName || '',
    spouseName: m.application?.spouseName || '',
    sonName: m.application?.sonName || '',
    daughterName: m.application?.daughterName || '',
    appliedDateBs: m.application?.appliedDateBs || '',
    profileImageId: imgId,
    profileImageUrl: imgUrl,
  }
}

/* ─────────────────────────────────────────────────────────────
   Shared form-field helpers
   ───────────────────────────────────────────────────────────── */

function FieldLabel({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-600">
      {label}
      {sublabel && <span className="ml-1 text-slate-400 font-normal">({sublabel})</span>}
    </label>
  )
}

function TextInput({
  value, onChange, placeholder, disabled, className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 ${className}`}
    />
  )
}

function TextArea({
  value, onChange, placeholder, rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-crimson-500 resize-y"
    />
  )
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/* ─────────────────────────────────────────────────────────────
   Section wrapper
   ───────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="border-b border-dashed border-slate-300 pb-1 text-sm font-semibold text-slate-700">
        {title}
      </h3>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Photo Upload & Preview
   ───────────────────────────────────────────────────────────── */

function PhotoUpload({
  imageId, imageUrl, onUpload,
}: {
  imageId: number | null
  imageUrl: string
  onUpload: (id: number, url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('alt', 'Member photo')
      // Use direct fetch — api() always sets Content-Type: application/json
      const res = await fetch(`${API_BASE}/api/media`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = (await res.json()) as { doc: { id: number; url: string } }
      onUpload(data.doc.id, data.doc.url)
      pushToast('success', 'Photo uploaded')
    } catch (err) {
      pushToast('error', 'Upload failed', err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* फोटो frame */}
      <div
        className="flex h-[150px] w-[120px] cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-400 bg-slate-50 overflow-hidden"
        onClick={() => inputRef.current?.click()}
        title="Click to upload photo"
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Member photo" className="h-full w-full object-cover" />
        ) : uploading ? (
          <span className="text-xs text-slate-400">Uploading…</span>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <Image size={24} />
            <span className="text-xs">फोटो</span>
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-500">फोटो</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Print CSS — scoped to this page
   ───────────────────────────────────────────────────────────── */

const PRINT_CSS = `
/* Hide everything on screen */
.print-sheet { display: none !important; }

/* Screen-only: hide in print */
@media print {
  .screen-only, nav, header, .app-sidebar, .app-header, [role="banner"], footer, .no-print,
  button, .pf-photo-label { display: none !important; }

  .print-sheet { display: block !important; }

  /* Reset page */
  @page { size: A4 portrait; margin: 15mm 12mm; }
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }

  /* A4 sheet */
  .print-sheet {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: white !important;
    color: #000 !important;
    font-family: inherit !important;
    font-size: 11pt !important;
    line-height: 1.4 !important;
  }

  .pf-header {
    display: flex !important;
    align-items: flex-start !important;
    gap: 12px !important;
    border-bottom: 2px solid #000 !important;
    padding-bottom: 10px !important;
    margin-bottom: 12px !important;
  }
  .pf-logo { width: 48px !important; height: 48px !important; object-fit: contain !important; }
  .pf-org { flex: 1 !important; }
  .pf-org-name-ne { font-size: 14pt !important; font-weight: 700 !important; color: #000 !important; }
  .pf-org-name-en { font-size: 10pt !important; color: #333 !important; }
  .pf-org-phone { font-size: 9pt !important; color: #555 !important; }
  .pf-photo-box {
    width: 100px !important;
    height: 120px !important;
    border: 1px solid #000 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 9pt !important;
    color: #000 !important;
    flex-shrink: 0 !important;
    overflow: hidden !important;
  }
  .pf-photo-img { width: 100% !important; height: 100% !important; object-fit: cover !important; }

  .pf-title {
    text-align: center !important;
    font-size: 13pt !important;
    font-weight: 700 !important;
    color: #c00 !important;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
    text-decoration-thickness: 1.5px !important;
    margin-bottom: 14px !important;
  }

  .pf-section { margin-bottom: 10px !important; }
  .pf-section-title {
    font-size: 10pt !important;
    font-weight: 700 !important;
    border-bottom: 1px dotted #999 !important;
    padding-bottom: 2px !important;
    margin-bottom: 6px !important;
    color: #000 !important;
  }

  .pf-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 4px 20px !important; }
  .pf-block { margin-bottom: 2px !important; }

  .pf-field { display: flex !important; align-items: baseline !important; gap: 4px !important; margin-bottom: 3px !important; }
  .pf-label { font-weight: 600 !important; white-space: nowrap !important; font-size: 10pt !important; color: #000 !important; }
  .pf-label::after { content: ' :' !important; }
  .pf-value {
    flex: 1 !important;
    border-bottom: 1px dotted #333 !important;
    min-height: 1.2em !important;
    padding-left: 2px !important;
    font-size: 10pt !important;
    color: #000 !important;
  }

  .pf-sig-block {
    display: flex !important;
    justify-content: space-between !important;
    margin-top: 20px !important;
    padding-top: 10px !important;
  }
  .pf-sig-item { width: 30% !important; }
  .pf-sig-line { border-bottom: 1px solid #000 !important; height: 30px !important; }
  .pf-sig-label { font-size: 9pt !important; color: #000 !important; margin-top: 2px !important; }

  .pf-footer {
    border: 1px solid #000 !important;
    padding: 8px !important;
    text-align: center !important;
    font-size: 9pt !important;
    color: #000 !important;
    margin-top: 14px !important;
  }
}
`

/* ─────────────────────────────────────────────────────────────
   PrintableForm — static paper replica for @media print
   ───────────────────────────────────────────────────────────── */

function PrintableForm({ data, photoUrl }: { data: FormState; photoUrl: string }) {
  const fld = (label: string, value: string) => (
    <span className="pf-field">
      <span className="pf-label">{label}</span>
      <span className="pf-value">{value || '\u00A0'}</span>
    </span>
  )

  return (
    <div className="print-sheet">
      {/* ── Org header ─────────────────────────────────── */}
      <div className="pf-header">
        <img src="/logo.png" alt="Logo" className="pf-logo" />
        <div className="pf-org">
          <div className="pf-org-name-ne">स्यस्यः समाज, यल</div>
          <div className="pf-org-name-en">Syasyah Samaj, Yala</div>
          <div className="pf-org-phone">Phone: 01-XXXXXXX</div>
        </div>
        {/* Photo box */}
        <div className="pf-photo-box">
          {photoUrl ? (
            <img src={photoUrl} alt="फोटो" className="pf-photo-img" />
          ) : null}
          <span className="pf-photo-label">फोटो</span>
        </div>
      </div>

      {/* ── Red title ─────────────────────────────────── */}
      <div className="pf-title">
        साधारण/स्थायी/आजीवन दुज़: (सदस्य) आवेदन फाराम
      </div>

      {/* ── Section A: Identity ──────────────────────── */}
      <div className="pf-section">
        <div className="pf-section-title">Identity (पहिचान)</div>
        <div className="pf-grid">
          {fld('ना (नाम)', data.fullName)}
          {fld('नागरिकता ल्या: (नं.)', data.citizenshipNo)}
          {fld('नागरिकता का.मु दि (मिति)', data.citizenshipIssuedDateBs)}
          {fld('नागरिकता का.मु जिल्ला', data.citizenshipDistrict)}
        </div>
      </div>

      {/* ── Section B: Address ──────────────────────── */}
      <div className="pf-section">
        <div className="pf-section-title">Address &amp; Contact (ठेगाना)</div>
        <div className="pf-block">
          {fld('स्थायी ठेगाना', data.addressPermanent)}
        </div>
        <div className="pf-block">
          {fld('अस्थाई ठेगाना', data.addressTemporary)}
        </div>
        <div className="pf-grid">
          {fld('इमेल ठेगाना', data.email)}
          {fld('फोन ल्या:', data.phoneNumber)}
          {fld('मोबाइल ल्या:', data.mobile)}
        </div>
      </div>

      {/* ── Section C: Personal ──────────────────────── */}
      <div className="pf-section">
        <div className="pf-section-title">Personal (व्यक्तिगत)</div>
        <div className="pf-grid">
          {fld('रक्ता', data.bloodGroup)}
          {fld('विशिष्टता', data.specialQualification)}
          {fld('पेशा', data.occupation)}
          {fld('कार्यालयको नाम', data.officeName)}
        </div>
      </div>

      {/* ── Section D: Family ────────────────────────── */}
      <div className="pf-section">
        <div className="pf-section-title">Family (पारिवारिक)</div>
        <div className="pf-grid">
          {fld('बाजेको नाम', data.grandfatherName)}
          {fld('बाबुको नाम', data.fatherName)}
          {fld('ससुराको नाम', data.fatherInLawName)}
          {fld('पति/पत्नीको नाम', data.spouseName)}
          {fld('छोराको नाम', data.sonName)}
          {fld('छोरीको नाम', data.daughterName)}
        </div>
      </div>

      {/* ── Section E: Membership ────────────────────── */}
      <div className="pf-section">
        <div className="pf-section-title">Membership &amp; Fee (दुज़ तथा शुल्क)</div>
        <div className="pf-grid">
          {fld('दुज़', data.membershipTypeId)}
          {fld('आवेदन मिति (बि.सं.)', data.appliedDateBs)}
        </div>
      </div>

      {/* ── Signature / रसिद / मिति block ────────────── */}
      <div className="pf-sig-block">
        <div className="pf-sig-item">
          <div className="pf-sig-line" />
          <div className="pf-sig-label">दस्तखत</div>
        </div>
        <div className="pf-sig-item">
          <div className="pf-sig-line" />
          <div className="pf-sig-label">रसिद नं.</div>
        </div>
        <div className="pf-sig-item">
          <div className="pf-sig-line" />
          <div className="pf-sig-label">मिति</div>
        </div>
      </div>

      {/* ── Footer note ─────────────────────────────── */}
      <div className="pf-footer">
        दस्तखत: नागरिकताका फोटो कापि संलग्न यानादिस ।
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Application Form Component
   ───────────────────────────────────────────────────────────── */

function ApplicationForm({
  members,
  membershipTypes,
  onSaved,
}: {
  members: Member[]
  membershipTypes: { id: number; name: string; fee: number }[]
  onSaved: () => void
}) {
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...blankForm })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchMember, setSearchMember] = useState('')
  const [printPreview, setPrintPreview] = useState<'data' | 'blank' | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Filter members for the edit-picker
  const filteredMembers = searchMember.trim()
    ? members.filter(
        (m) =>
          m.fullName.toLowerCase().includes(searchMember.toLowerCase()) ||
          m.email.toLowerCase().includes(searchMember.toLowerCase()),
      )
    : []

  const loadMember = (m: Member) => {
    setEditingMemberId(m.id)
    setForm(toFormState(m))
    setSearchMember('')
  }

  const startNew = () => {
    setEditingMemberId(null)
    setForm({ ...blankForm })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber || undefined,
        membershipType: form.membershipTypeId ? Number(form.membershipTypeId) : null,
        profileImage: form.profileImageId || null,
        idCardDetails: {
          bloodGroup: form.bloodGroup || undefined,
        },
        application: {
          citizenshipNo: form.citizenshipNo || undefined,
          citizenshipIssuedDateBs: form.citizenshipIssuedDateBs || undefined,
          citizenshipDistrict: form.citizenshipDistrict || undefined,
          addressPermanent: form.addressPermanent || undefined,
          addressTemporary: form.addressTemporary || undefined,
          mobile: form.mobile || undefined,
          specialQualification: form.specialQualification || undefined,
          occupation: form.occupation || undefined,
          officeName: form.officeName || undefined,
          grandfatherName: form.grandfatherName || undefined,
          fatherName: form.fatherName || undefined,
          fatherInLawName: form.fatherInLawName || undefined,
          spouseName: form.spouseName || undefined,
          sonName: form.sonName || undefined,
          daughterName: form.daughterName || undefined,
          appliedDateBs: form.appliedDateBs || undefined,
        },
      }
      if (editingMemberId) {
        await api(`/members/${editingMemberId}`, { method: 'PATCH', body })
        pushToast('success', 'Member updated', form.fullName.trim())
      } else {
        await api('/members', { method: 'POST', body })
        pushToast('success', 'Member created', form.fullName.trim())
      }
      setEditingMemberId(null)
      setForm({ ...blankForm })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member')
    } finally {
      setSaving(false)
    }
  }

  const handlePrint = (mode: 'data' | 'blank') => {
    setPrintPreview(mode)
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print()
        setPrintPreview(null)
      }, 150)
    })
  }

  const printData = printPreview === 'blank' ? { ...blankForm } : form

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      {/* ── Print CSS (injected) ───────────────────────── */}
      <style>{PRINT_CSS}</style>

      {/* ── Screen-only: org header ────────────────────── */}
      <div className="screen-only">
        <div className="mb-6 flex items-center gap-4 border-b-2 border-slate-300 pb-4">
          <img src="/logo.png" alt="Logo" className="h-14 w-14 object-contain" />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">स्यस्यः समाज, यल</h2>
            <p className="text-sm text-slate-600">Syasyah Samaj, Yala</p>
            <p className="text-xs text-slate-500">Phone: 01-XXXXXXX</p>
          </div>
          {/* Photo upload in top-right */}
          <PhotoUpload
            imageId={form.profileImageId}
            imageUrl={form.profileImageUrl}
            onUpload={(id, url) => { set('profileImageId', id); set('profileImageUrl', url) }}
          />
        </div>

        {/* ── Red title ─────────────────────────────────── */}
        <div className="mb-5 text-center">
          <h2 className="text-base font-bold text-red-700 underline decoration-red-600 decoration-2 underline-offset-4">
            साधारण/स्थायी/आजीवन दुज़: (सदस्य) आवेदन फाराम
          </h2>
        </div>

        {/* ── Edit-existing picker ────────────────────────── */}
        <div className="mb-5 rounded border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {editingMemberId ? 'Editing existing member' : 'Edit existing member (optional)'}
              </label>
              <input
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Search by name or email to edit…"
                className="h-[34px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            {editingMemberId && (
              <button
                type="button"
                onClick={startNew}
                className="mt-5 rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                New
              </button>
            )}
          </div>
          {filteredMembers.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white">
              {filteredMembers.slice(0, 10).map((m) => (
                <button
                  key={m.id}
                  onClick={() => loadMember(m)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{m.fullName}</span>
                  <span className="text-xs text-slate-400">{m.email}</span>
                  {m.membershipType && (
                    <span className="ml-auto text-xs text-slate-500">{m.membershipType.name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────── */}
        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* ── Section A: Identity ──────────────────────── */}
          <Section title="Identity (पहिचान)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel label="Full Name (नाम)" />
                <TextInput value={form.fullName} onChange={(v) => set('fullName', v)} placeholder="e.g. Ram Bahadur Shrestha" />
              </div>
              <div>
                <FieldLabel label="Citizenship No. (नागरिकता ल्या:)" />
                <TextInput value={form.citizenshipNo} onChange={(v) => set('citizenshipNo', v)} placeholder="e.g. 12-34-56-78901" />
              </div>
              <div>
                <FieldLabel label="Citizenship Issued Date (BS)" sublabel="YYYY-MM-DD" />
                <TextInput value={form.citizenshipIssuedDateBs} onChange={(v) => set('citizenshipIssuedDateBs', v)} placeholder="2080-01-15" />
              </div>
              <div>
                <FieldLabel label="Citizenship District (जिल्ला)" />
                <Select
                  value={form.citizenshipDistrict}
                  onChange={(v) => set('citizenshipDistrict', v)}
                  options={DISTRICTS.map((d) => ({ value: d.value, label: d.label }))}
                  placeholder="— Select district —"
                />
              </div>
            </div>
          </Section>

          {/* ── Section B: Address & Contact ─────────────── */}
          <Section title="Address & Contact (ठेगाना)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel label="Permanent Address (स्थायी ठेगाना)" />
                <TextArea value={form.addressPermanent} onChange={(v) => set('addressPermanent', v)} placeholder="Ward, VDC/Municipality, District" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel label="Temporary Address (अस्थाई ठेगाना)" />
                <TextArea value={form.addressTemporary} onChange={(v) => set('addressTemporary', v)} placeholder="Current residence address" />
              </div>
              <div>
                <FieldLabel label="Email (इमेल)" />
                <TextInput value={form.email} onChange={(v) => set('email', v)} placeholder="e.g. ram@example.com" />
              </div>
              <div>
                <FieldLabel label="Phone (फोन)" />
                <TextInput value={form.phoneNumber} onChange={(v) => set('phoneNumber', v)} placeholder="e.g. 01-XXXXXXX" />
              </div>
              <div>
                <FieldLabel label="Mobile (मोबाइल)" />
                <TextInput value={form.mobile} onChange={(v) => set('mobile', v)} placeholder="e.g. 98XXXXXXXX" />
              </div>
            </div>
          </Section>

          {/* ── Section C: Personal ──────────────────────── */}
          <Section title="Personal (व्यक्तिगत)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel label="Blood Group (रक्ता)" />
                <Select
                  value={form.bloodGroup}
                  onChange={(v) => set('bloodGroup', v)}
                  options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
                  placeholder="— Select —"
                />
              </div>
              <div>
                <FieldLabel label="Special Qualification (विशिष्टता)" />
                <TextInput value={form.specialQualification} onChange={(v) => set('specialQualification', v)} placeholder="e.g. MBA, PhD" />
              </div>
              <div>
                <FieldLabel label="Occupation (पेशा)" />
                <TextInput value={form.occupation} onChange={(v) => set('occupation', v)} placeholder="e.g. Engineer" />
              </div>
              <div>
                <FieldLabel label="Office Name (कार्यालयको नाम)" />
                <TextInput value={form.officeName} onChange={(v) => set('officeName', v)} placeholder="e.g. Nepal Telecom" />
              </div>
            </div>
          </Section>

          {/* ── Section D: Family ────────────────────────── */}
          <Section title="Family (पारिवारिक)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel label="Grandfather's Name (बाजेको नाम)" />
                <TextInput value={form.grandfatherName} onChange={(v) => set('grandfatherName', v)} />
              </div>
              <div>
                <FieldLabel label="Father's Name (बाबुको नाम)" />
                <TextInput value={form.fatherName} onChange={(v) => set('fatherName', v)} />
              </div>
              <div>
                <FieldLabel label="Father-in-law's Name (ससुराको नाम)" />
                <TextInput value={form.fatherInLawName} onChange={(v) => set('fatherInLawName', v)} />
              </div>
              <div>
                <FieldLabel label="Spouse's Name (पति/पत्नीको नाम)" />
                <TextInput value={form.spouseName} onChange={(v) => set('spouseName', v)} />
              </div>
              <div>
                <FieldLabel label="Son's Name (छोराको नाम)" />
                <TextInput value={form.sonName} onChange={(v) => set('sonName', v)} />
              </div>
              <div>
                <FieldLabel label="Daughter's Name (छोरीको नाम)" />
                <TextInput value={form.daughterName} onChange={(v) => set('daughterName', v)} />
              </div>
            </div>
          </Section>

          {/* ── Section E: Membership & Fee ──────────────── */}
          <Section title="Membership & Fee (दुज़ तथा शुल्क)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel label="Membership Type (दुज़)" />
                <SearchSelect
                  value={form.membershipTypeId}
                  onChange={(v) => set('membershipTypeId', v)}
                  placeholder="— Select type —"
                  options={membershipTypes.map((t) => ({
                    value: t.id,
                    label: t.name,
                    sublabel: fmt(t.fee),
                  }))}
                />
              </div>
              <div>
                <FieldLabel label="Application Date (BS)" sublabel="YYYY-MM-DD" />
                <TextInput value={form.appliedDateBs} onChange={(v) => set('appliedDateBs', v)} placeholder="2082-05-15" />
              </div>
            </div>
          </Section>

          {/* ── Footer note ─────────────────────────────── */}
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
            दस्तखत: नागरिकताका फोटो कापि संलग्न यानादिस ।
          </div>

          {/* ── Save + Print ──────────────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-[38px] items-center gap-1.5 rounded bg-crimson-600 px-5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingMemberId ? 'Update Member' : 'Save Application'}
            </button>
            {editingMemberId && (
              <button
                type="button"
                onClick={() => handlePrint('data')}
                className="inline-flex h-[38px] items-center gap-1.5 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer size={14} /> प्रिन्ट
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePrint('blank')}
              className="inline-flex h-[38px] items-center gap-1.5 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer size={14} /> खाली फाराम प्रिन्ट
            </button>
            {editingMemberId && (
              <button
                type="button"
                onClick={startNew}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Start New
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Print-only: paper replica ───────────────────── */}
      {printPreview && (
        <PrintableForm data={printData} photoUrl={printPreview === 'data' ? form.profileImageUrl : ''} />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Members Page
   ═══════════════════════════════════════════════════════════════ */

export default function Members() {
  const { cacheVersion } = useSyncState()
  const t = useT()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState<number | null>(null)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRoleId, setFormRoleId] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [membershipTypes, setMembershipTypes] = useState<{ id: number; name: string; fee: number }[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRoleId, setEditRoleId] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editError, setEditError] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [viewingMember, setViewingMember] = useState<Member | null>(null)

  useEffect(() => {
    setLoading(true)
    api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, sort: '-updatedAt', ...tenantQuery },
    })
      .then((res) => setMembers(res.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cacheVersion, tenantId])

  // Load membership types for the create form
  useEffect(() => {
    api<{ docs: { id: number; name: string; fee: number }[] }>('/membership-types', {
      query: { limit: 100, sort: 'name', ...tenantQuery },
    })
      .then((r) => setMembershipTypes(r.docs || []))
      .catch(() => {})
  }, [tenantQuery])

  const refreshMembers = useCallback(async () => {
    const refreshed = await api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, sort: '-updatedAt', ...tenantQuery },
    })
    setMembers(refreshed.docs || [])
  }, [tenantQuery])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formName.trim()) { setFormError('Name is required.'); return }
    if (!formEmail.trim()) { setFormError('Email is required.'); return }
    setSubmitting(true)
    try {
      await api('/members', {
        method: 'POST',
        body: {
          fullName: formName.trim(),
          email: formEmail.trim(),
          phoneNumber: formPhone || undefined,
          membershipType: formRoleId ? Number(formRoleId) : undefined,
          status: formStatus,
        },
      })
      pushToast('success', 'Member added', formName.trim())
      setShowForm(false)
      setFormName('')
      setFormEmail('')
      setFormPhone('')
      setFormRoleId('')
      setFormStatus('active')
      await refreshMembers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (m: Member) => {
    setOpenMenu(null)
    setEditingId(m.id)
    setEditName(m.fullName)
    setEditEmail(m.email)
    setEditPhone('')
    setEditRoleId(m.membershipType ? String(m.membershipType.id) : '')
    setEditStatus('active')
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError('')
    if (!editName.trim()) { setEditError('Name is required.'); return }
    if (!editEmail.trim()) { setEditError('Email is required.'); return }
    setEditSubmitting(true)
    try {
      // Saves locally first, syncs in background.
      await api(`/members/${editingId}`, {
        method: 'PATCH',
        body: {
          fullName: editName.trim(),
          email: editEmail.trim(),
          phoneNumber: editPhone || undefined,
          membershipType: editRoleId ? Number(editRoleId) : null,
          status: editStatus,
        },
      })
      pushToast('success', 'Member updated', editName.trim())
      setEditingId(null)
      await refreshMembers()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setEditSubmitting(false)
    }
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'updatedAt'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'desc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((_q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (_q) params.set('q', _q); else params.delete('q')
      if (s.key && s.key !== 'fullName') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'asc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const { visible, setQuery, toggleSort, sort, query } = useSortSearch<Member>(members, {
    searchable: (m) => `${m.fullName || ''} ${m.email || ''} ${m.membershipType?.name || ''}`,
    valueOf: (m, key) => {
      switch (key) {
        case 'fullName': return m.fullName || ''
        case 'email': return m.email || ''
        case 'membershipType': return m.membershipType?.name || ''
        case 'paymentStatus': return m.paymentStatus || ''
        case 'renewalDate': return m.renewalDate || ''
        case 'updatedAt': return (m as Record<string, unknown>).updatedAt as string || ''
        default: return (m as unknown as Record<string, unknown>)[key] as string | number | undefined
      }
    },
    initialQuery: urlQuery,
    initialSort: { key: urlSortKey, dir: urlSortDir },
    onChange: syncToUrl,
  })
  const filtered = visible

  const handleDelete = async (m: Member) => {
    setOpenMenu(null)
    if (!window.confirm(`Delete member "${m.fullName}"? This cannot be undone.`)) return
    try {
      // Queued to the offline outbox — flushes on reconnect when offline.
      await api(`/members/${m.id}`, { method: 'DELETE' })
      pushToast('success', 'Member deleted', m.fullName)
      await refreshMembers()
    } catch (err) {
      pushToast('error', 'Delete failed', err instanceof Error ? err.message : String(err))
    }
  }

  const handlePayFee = async (member: Member) => {
    if (!member.membershipType) {
      pushToast('error', 'No membership type', 'Assign a membership type before collecting payment.')
      return
    }
    setPaying(member.id)
    try {
      const res = await api<{ message: string; receiptNumber: string; amount: number; renewalDate: string }>(
        `/members/${member.id}/pay-fee`,
        { method: 'POST' },
      )
      pushToast('success', 'Fee collected', `${res.receiptNumber} — ${fmt(res.amount)} · Renews ${res.renewalDate}`)
      // Refresh the list from server
      await refreshMembers()
    } catch (err) {
      pushToast('error', 'Payment failed', err instanceof Error ? err.message : String(err))
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header with segmented control ──────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-800">{t('members.title', 'Members')}</h1>
          {/* Segmented control */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Table2 size={14} /> {t('members.table', 'Table')}
            </button>
            <button
              onClick={() => setViewMode('application')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'application'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText size={14} /> {t('members.applicationForm', 'Application Form')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'table' && (
            <>
              <button
                onClick={() => downloadCsv('members.csv', ['Name', 'Email', 'Membership Type', 'Payment Status', 'Renewal Date'],
                  filtered.map((m) => [m.fullName, m.email, m.membershipType?.name || '', m.paymentStatus || '', m.renewalDate || '']))
                }
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Download size={14} /> CSV
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
              >
                <Plus size={14} /> {t('members.newMember', 'Add Member')}
              </button>
              <SearchBox value={query} onChange={setQuery} placeholder={t('members.title', 'Search members…')} />
            </>
          )}
        </div>
      </div>

      {/* ═══ APPLICATION FORM VIEW ══════════════════════════ */}
      {viewMode === 'application' && (
        <ApplicationForm
          members={members}
          membershipTypes={membershipTypes}
          onSaved={refreshMembers}
        />
      )}

      {/* ═══ TABLE VIEW ═════════════════════════════════════ */}
      {viewMode === 'table' && (
        <>
          {/* ── Create form ─────────────────────────────────── */}
          {showForm && (
            <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{t('members.newMember', 'New Member')}</h3>
                <button type="button" onClick={() => { setShowForm(false); setFormError('') }} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              {formError && (
                <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
                  <input
                    value={formName} onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Aayurt Shrestha"
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
                  <input
                    type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. aayurt@example.com"
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                  <input
                    value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. +977-9800000000"
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Membership Type</label>
                  <SearchSelect
                    value={formRoleId}
                    onChange={setFormRoleId}
                    placeholder="— None —"
                    options={membershipTypes.map((t) => ({
                      value: t.id,
                      label: t.name,
                      sublabel: fmt(t.fee),
                    }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                  <SearchSelect
                    value={formStatus}
                    onChange={setFormStatus}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'suspended', label: 'Suspended' },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit" disabled={submitting}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                >
                  {submitting ? t('msg.saving', 'Creating…') : t('members.newMember', 'Create Member')}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setFormError('') }} className="text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ── Edit form ─────────────────────────────────── */}
          {editingId && (
            <form onSubmit={handleUpdate} className="rounded-lg border border-crimson-200 bg-crimson-50/30 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{t('members.title', 'Edit Member')}</h3>
                <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              {editError && (
                <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
                  <input
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
                  <input
                    type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                  <input
                    value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Membership Type</label>
                  <SearchSelect
                    value={editRoleId}
                    onChange={setEditRoleId}
                    placeholder="— None —"
                    options={membershipTypes.map((t) => ({
                      value: t.id,
                      label: t.name,
                      sublabel: fmt(t.fee),
                    }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                  <SearchSelect
                    value={editStatus}
                    onChange={setEditStatus}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'suspended', label: 'Suspended' },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit" disabled={editSubmitting}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                >
                  {editSubmitting ? t('msg.saving', 'Saving…') : t('common.save', 'Save Changes')}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-500 hover:text-slate-700">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <DataStatus />
          {loading && members.length === 0 ? (
            <TableSkeleton rows={6} />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {query ? t('members.noMembers', 'No members match your search.') : t('members.noMembers', 'No members yet.')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <tr>
                    <SortableTh label={t('common.name', 'Name')} sortKey="fullName" sort={sort} onSort={toggleSort} />
                    <SortableTh label={t('common.email', 'Email')} sortKey="email" sort={sort} onSort={toggleSort} />
                    <SortableTh label={t('common.type', 'Type')} sortKey="membershipType" sort={sort} onSort={toggleSort} />
                    <SortableTh label={t('common.status', 'Status')} sortKey="paymentStatus" sort={sort} onSort={toggleSort} />
                    <SortableTh label={t('members.title', 'Renewal')} sortKey="renewalDate" sort={sort} onSort={toggleSort} />
                    <SortableTh label={t('members.title', 'Updated')} sortKey="updatedAt" sort={sort} onSort={toggleSort} />
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{m.fullName}</td>
                      <td className="px-4 py-3 text-slate-600">{m.email}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {m.membershipType?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : m.paymentStatus === 'overdue'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.paymentStatus || 'unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{m.renewalDate || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {(m as Record<string, unknown>).updatedAt ? new Date((m as Record<string, unknown>).updatedAt as string).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {m.paymentStatus !== 'paid' && m.membershipType && (
                            <button
                              onClick={() => handlePayFee(m)}
                              disabled={paying === m.id}
                              className="inline-flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                            >
                              <CreditCard size={12} />
                              {paying === m.id ? t('msg.saving', 'Processing…') : t('members.payFee', 'Pay Fee')}
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                              className="rounded border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                              aria-label="Actions"
                            >
                              <MoreVertical size={14} />
                            </button>
                            {openMenu === m.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                                <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                  <button
                                    onClick={() => { setOpenMenu(null); setViewingMember(m) }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <FileText size={12} /> {t('common.view', 'View Details')}
                                  </button>
                                  <button
                                    onClick={() => startEdit(m)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Edit3 size={12} /> {t('common.edit', 'Edit Member')}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(m)}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={12} /> {t('common.delete', 'Delete Member')}
                                  </button>
                                  {m.lastReceipt && (
                                    <button
                                      onClick={() => { setOpenMenu(null); window.open(`/print/receipt/${m.lastReceipt!.id}`, '_blank') }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    >
                                      <Download size={12} /> {t('common.view', 'View Receipt')}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setOpenMenu(null); handlePayFee(m) }}
                                    disabled={paying === m.id || m.paymentStatus === 'paid'}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                  >
                                    <CreditCard size={12} /> {t('members.payFee', 'Pay Fee')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {viewingMember && (
        <MemberViewModal
          member={viewingMember}
          onClose={() => setViewingMember(null)}
          onEdit={(m) => { setViewingMember(null); startEdit(m) }}
        />
      )}
    </div>
  )
}
