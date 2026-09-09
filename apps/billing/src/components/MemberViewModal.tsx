import { Printer, X } from 'lucide-react'

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
  phoneNumber?: string
  profileImage?: { id: number; url: string } | number | null
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

/* ─────────────────────────────────────────────────────────────
   Read-only field display
   ───────────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-xs font-semibold text-slate-600">{label}:</span>
      <span className="min-h-[1.2em] flex-1 border-b border-dotted border-slate-300 pl-1 text-sm text-slate-800">
        {value || '\u00A0'}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="border-b border-dashed border-slate-300 pb-1 text-sm font-semibold text-slate-700">
        {title}
      </h3>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MemberViewModal
   ───────────────────────────────────────────────────────────── */

export default function MemberViewModal({
  member,
  onClose,
  onEdit,
}: {
  member: Member
  onClose: () => void
  onEdit: (m: Member) => void
}) {
  const img = member.profileImage
  const photoUrl =
    img && typeof img === 'object' && 'url' in img
      ? (img as { url: string }).url
      : ''

  const a = member.application || {}

  const handlePrint = () => {
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150)
    })
  }

  return (
    <>
      {/* ── Screen-only modal ─────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[5vh]">
        <div
          className="relative w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header bar ──────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Member Details</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(member)}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Printer size={12} /> Print
              </button>
              <button
                onClick={onClose}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Body — paper-form layout ────────────────── */}
          <div className="p-6">
            {/* Org header */}
            <div className="mb-4 flex items-center gap-4 border-b-2 border-slate-300 pb-4">
              <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-800">स्यस्यः समाज, यल</h3>
                <p className="text-xs text-slate-600">Syasyah Samaj, Yala</p>
                <p className="text-xs text-slate-500">Phone: 01-XXXXXXX</p>
              </div>
              {/* Photo */}
              <div className="flex h-[120px] w-[100px] flex-col items-center justify-center overflow-hidden rounded border-2 border-dashed border-slate-400 bg-slate-50">
                {photoUrl ? (
                  <img src={photoUrl} alt="Photo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">फोटो</span>
                )}
              </div>
            </div>

            {/* Red title */}
            <div className="mb-5 text-center">
              <h3 className="text-sm font-bold text-red-700 underline decoration-red-600 decoration-2 underline-offset-4">
                साधारण/स्थायी/आजीवन दुज़: (सदस्य) आवेदन फाराम
              </h3>
            </div>

            <div className="space-y-5">
              {/* Identity */}
              <Section title="Identity (पहिचान)">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="नाम (Name)" value={member.fullName} />
                  <Field label="नागरिकता ल्या:" value={a.citizenshipNo} />
                  <Field label="नागरिकता मिति" value={a.citizenshipIssuedDateBs} />
                  <Field label="जिल्ला (District)" value={a.citizenshipDistrict} />
                </div>
              </Section>

              {/* Address & Contact */}
              <Section title="Address & Contact (ठेगाना)">
                <Field label="स्थायी ठेगाना" value={a.addressPermanent} />
                <Field label="अस्थाई ठेगाना" value={a.addressTemporary} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="इमेल" value={member.email} />
                  <Field label="फोन" value={member.phoneNumber} />
                  <Field label="मोबाइल" value={a.mobile} />
                </div>
              </Section>

              {/* Personal */}
              <Section title="Personal (व्यक्तिगत)">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="रक्ता (Blood)" value={member.idCardDetails?.bloodGroup} />
                  <Field label="विशिष्टता" value={a.specialQualification} />
                  <Field label="पेशा (Occupation)" value={a.occupation} />
                  <Field label="कार्यालय" value={a.officeName} />
                </div>
              </Section>

              {/* Family */}
              <Section title="Family (पारिवारिक)">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="बाजेको नाम" value={a.grandfatherName} />
                  <Field label="बाबुको नाम" value={a.fatherName} />
                  <Field label="ससुराको नाम" value={a.fatherInLawName} />
                  <Field label="पत्नीको नाम" value={a.spouseName} />
                  <Field label="छोराको नाम" value={a.sonName} />
                  <Field label="छोरीको नाम" value={a.daughterName} />
                </div>
              </Section>

              {/* Membership */}
              <Section title="Membership & Fee (दुज़ तथा शुल्क)">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="दुज़ (Type)" value={member.membershipType?.name} />
                  <Field label="आवेदन मिति (BS)" value={a.appliedDateBs} />
                  <Field label="Payment Status" value={member.paymentStatus} />
                  <Field label="Renewal Date" value={member.renewalDate || undefined} />
                </div>
              </Section>
            </div>

            {/* Footer note */}
            <div className="mt-5 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
              दस्तखत: नागरिकताका फोटो कापि संलग्न गर्नादिस् ।
            </div>
          </div>
        </div>
      </div>

      {/* ── Print-only replica (hidden on screen) ─────────── */}
      <style>{`
        @media print {
          body > *:not(.member-print-sheet) { display: none !important; }
          .member-print-sheet { display: block !important; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
        }
      `}</style>
      <div className="member-print-sheet hidden">
        <div className="mb-4 flex items-center gap-4 border-b-2 border-black pb-3">
          <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          <div className="flex-1">
            <div className="text-base font-bold">स्यस्यः समाज, यल</div>
            <div className="text-xs">Syasyah Samaj, Yala</div>
          </div>
          <div className="flex h-[100px] w-[80px] flex-col items-center justify-center border border-black">
            {photoUrl && <img src={photoUrl} alt="" className="h-full w-full object-cover" />}
            <span className="text-[9pt]">फोटो</span>
          </div>
        </div>
        <div className="mb-4 text-center text-[13pt] font-bold text-red-700 underline">
          साधारण/स्थायी/आजीवन दुज़: (सदस्य) आवेदन फाराम
        </div>
        <div className="space-y-3 text-[10pt]">
          <div className="grid grid-cols-2 gap-x-5">
            <div><b>नाम:</b> {member.fullName}</div>
            <div><b>नागरिकता:</b> {a.citizenshipNo}</div>
            <div><b>मिति:</b> {a.citizenshipIssuedDateBs}</div>
            <div><b>जिल्ला:</b> {a.citizenshipDistrict}</div>
          </div>
          <div><b>स्थायी ठेगाना:</b> {a.addressPermanent}</div>
          <div><b>अस्थाई ठेगाना:</b> {a.addressTemporary}</div>
          <div className="grid grid-cols-3 gap-x-5">
            <div><b>इमेल:</b> {member.email}</div>
            <div><b>फोन:</b> {member.phoneNumber}</div>
            <div><b>मोबाइल:</b> {a.mobile}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-5">
            <div><b>रक्ता:</b> {member.idCardDetails?.bloodGroup}</div>
            <div><b>विशिष्टता:</b> {a.specialQualification}</div>
            <div><b>पेशा:</b> {a.occupation}</div>
            <div><b>कार्यालय:</b> {a.officeName}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-5">
            <div><b>बाजेको नाम:</b> {a.grandfatherName}</div>
            <div><b>बाबुको नाम:</b> {a.fatherName}</div>
            <div><b>ससुराको नाम:</b> {a.fatherInLawName}</div>
            <div><b>पत्नीको नाम:</b> {a.spouseName}</div>
            <div><b>छोराको नाम:</b> {a.sonName}</div>
            <div><b>छोरीको नाम:</b> {a.daughterName}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-5">
            <div><b>दुज़:</b> {member.membershipType?.name}</div>
            <div><b>आवेदन मिति:</b> {a.appliedDateBs}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-between text-[9pt]">
          <div className="w-1/3"><div className="border-t border-black pt-1">दस्तखत</div></div>
          <div className="w-1/3"><div className="border-t border-black pt-1">रसिद नं.</div></div>
          <div className="w-1/3"><div className="border-t border-black pt-1">मिति</div></div>
        </div>
        <div className="mt-4 border border-black p-2 text-center text-[9pt]">
          दस्तखत: नागरिकताका फोटो कापि संलग्न गर्नादिस् ।
        </div>
      </div>
    </>
  )
}
