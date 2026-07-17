'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tenant {
  id: string
  name: string
  slug: string
}

interface PreviewRow {
  email: string
  fullName: string
  memberId: string
  phone: string
  status: string
  action: 'new' | 'update' | 'skip'
  selected: boolean
  remove: boolean
}

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: '4px',
  padding: '1.25rem',
  marginBottom: '1.5rem',
}

const headingStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--theme-elevation-800)',
  margin: '0 0 0.25rem 0',
}

const descriptionStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--theme-elevation-500)',
  margin: '0 0 1rem 0',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  background: 'var(--theme-input-bg)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: '4px',
  color: 'var(--theme-elevation-800)',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  marginBottom: '0.375rem',
  color: 'var(--theme-elevation-800)',
}

const btnBase: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  borderRadius: '4px',
  border: '1px solid var(--theme-elevation-200)',
  cursor: 'pointer',
  transition: 'all 0.1s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
}

export const SyncSheets: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState(
    'https://docs.google.com/spreadsheets/d/1C3HJK_dA_lhtXPqyhNUYSuWFTRCjUiGa1BndZMMm_qA/edit?usp=sharing',
  )
  const [tenantId, setTenantId] = useState<string>('')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [confirmSync, setConfirmSync] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/tenants?limit=100&depth=0')
      .then((r) => r.json())
      .then((d) => setTenants(d.docs || []))
      .catch(() => {})
  }, [])

  const handlePreview = useCallback(async () => {
    setError('')
    setStatus('Loading preview...')
    setPreview(null)

    try {
      const csvUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv')
      const res = await fetch(csvUrl)
      const csvText = await res.text()

      const { parseCSV } = await import('@/utilities/csv')
      const records = parseCSV<Record<string, string>>(csvText)

      const existingRes = await fetch('/api/members?limit=1000&depth=0')
      const existingData = await existingRes.json()
      const existingDocs: any[] = existingData.docs || []
      const existingByMemberId = new Map(
        existingDocs.filter((m: any) => m.memberId).map((m: any) => [m.memberId, m]),
      )
      const existingByEmail = new Map(
        existingDocs.filter((m: any) => m.email).map((m: any) => [m.email.toLowerCase(), m]),
      )

      const rows: PreviewRow[] = records.map((r: any) => {
        const memberId = r['Member ID'] || r['memberId'] || r['ID'] || r['id'] || ''
        const email = r['Email'] || r['email'] || ''
        const fullName = r['Full Name'] || r['Name'] || r['fullName'] || ''

        let action: 'new' | 'update' | 'skip'
        if (memberId && existingByMemberId.has(memberId)) {
          action = 'update'
        } else if (email && existingByEmail.has(email.toLowerCase())) {
          action = 'update'
        } else if (!email) {
          action = 'skip'
        } else {
          action = 'new'
        }

        return {
          email,
          fullName,
          memberId,
          phone: r['Phone'] || r['phone'] || r['Phone Number'] || r['phone number'] || '',
          status: r['Status'] || r['status'] || '',
          action,
          selected: action !== 'skip',
          remove: false,
        }
      })

      setPreview(rows)
      const newCount = rows.filter((r) => r.action === 'new').length
      const updateCount = rows.filter((r) => r.action === 'update').length
      setStatus(`Found ${rows.length} rows — ${newCount} new, ${updateCount} existing`)
    } catch (err: any) {
      setError(err.message)
      setStatus('')
    }
  }, [sheetUrl])

  const toggleRow = useCallback((idx: number) => {
    setPreview((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const row: PreviewRow = { ...next[idx]!, selected: !next[idx]!.selected }
      next[idx] = row
      return next
    })
  }, [])

  const toggleRemove = useCallback((idx: number) => {
    setPreview((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const row: PreviewRow = { ...next[idx]!, remove: !next[idx]!.remove }
      if (row.remove) row.selected = true
      next[idx] = row
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setPreview((prev) => prev?.map((r): PreviewRow => ({ ...r, selected: true, remove: false })) ?? null)
  }, [])

  const deselectAll = useCallback(() => {
    setPreview((prev) => prev?.map((r): PreviewRow => ({ ...r, selected: false, remove: false })) ?? null)
  }, [])

  const handleSync = useCallback(async () => {
    setConfirmSync(false)
    setLoading(true)
    setStatus('Syncing...')
    setError('')

    try {
      const selectedIndices = preview
        ?.map((r, i) => (r.selected && !r.remove ? i : -1))
        .filter((i) => i >= 0) ?? []
      const removeIndices = preview
        ?.map((r, i) => (r.remove ? i : -1))
        .filter((i) => i >= 0) ?? []

      const body: Record<string, any> = { sheetUrl }
      if (tenantId) body.tenantId = tenantId
      if (selectedIndices.length || removeIndices.length) {
        body.selectedIndices = selectedIndices
        body.removeIndices = removeIndices
      }
      const res = await fetch('/api/members/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.created !== undefined) {
        setStatus(`✅ ${data.created} created, ${data.updated} updated, ${data.skipped} skipped, ${data.removed ?? 0} removed`)
        if (data.errors?.length) setError(data.errors.slice(0, 3).join('\n'))
        setPreview(null)
        router.refresh()
      } else {
        setError(data.error || 'Unknown error')
        setStatus('')
      }
    } catch (err: any) {
      setError(err.message)
      setStatus('')
    }
    setLoading(false)
  }, [sheetUrl, tenantId, preview])

  const handleExport = useCallback(async () => {
    try {
      setError('')
      const res = await fetch('/api/members?limit=10000&depth=1')
      if (!res.ok) {
        setError(`Export failed: ${res.status} ${res.statusText}`)
        setStatus('')
        return
      }
      const data = await res.json()
      const docs: any[] = data.docs || []
      if (docs.length === 0) {
        setStatus('No members to export')
        return
      }
      const { generateCSV } = await import('@/utilities/csv')

      const records = docs.map((m: any) => ({
        'Full Name': m.fullName || '',
        'Email': m.email || '',
        'Member ID': m.memberId || '',
        'Phone': m.phoneNumber || '',
        'Status': m.status || '',
        'Bio': m.bio || '',
        'Twitter': m.socialLinks?.twitter || '',
        'LinkedIn': m.socialLinks?.linkedin || '',
        'Website': m.socialLinks?.website || '',
        'Expiry Date': m.expiryDate || '',
        'Joined Date': m.joinedDate || '',
        'Blood Group': m.idCardDetails?.bloodGroup || '',
        'Emergency Contact': m.idCardDetails?.emergencyContact || '',
      }))

      const csv = generateCSV(records)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `members-export-${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(`Exported ${records.length} members`)
    } catch (err: any) {
      setError(err.message)
      setStatus('')
    }
  }, [])

  return (
    <div style={cardStyle}>
      <h3 style={headingStyle}>Sync Members from Google Sheets</h3>
      <p style={descriptionStyle}>
        Import member data from a published Google Sheet, or export current members as CSV
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <label style={labelStyle}>Google Sheet URL</label>
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            style={inputStyle}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
        </div>
        <div style={{ minWidth: '180px' }}>
          <label style={labelStyle}>Ilaka (optional)</label>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTenantId('')}
              style={{
                ...btnBase,
                background: !tenantId ? 'var(--theme-elevation-100)' : 'var(--theme-input-bg)',
                borderColor: !tenantId ? 'var(--theme-elevation-300)' : 'var(--theme-elevation-200)',
                fontWeight: !tenantId ? 600 : 400,
              }}
            >
              All
            </button>
            {tenants.map((t) => {
              const isSelected = tenantId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTenantId(t.id)}
                  style={{
                    ...btnBase,
                    background: isSelected ? 'var(--theme-elevation-100)' : 'var(--theme-input-bg)',
                    borderColor: isSelected ? 'var(--theme-elevation-300)' : 'var(--theme-elevation-200)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {preview && preview.length > 0 && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={selectAll} style={{ ...btnBase, background: 'var(--theme-input-bg)', fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
            Select All
          </button>
          <button type="button" onClick={deselectAll} style={{ ...btnBase, background: 'var(--theme-input-bg)', fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
            Deselect All
          </button>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid var(--theme-elevation-200)',
          borderRadius: '4px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--theme-elevation-100)' }}>
                <th style={{ ...thStyle, width: 36, textAlign: 'center' }}></th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Member ID</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} style={{
                  borderBottom: '1px solid var(--theme-elevation-100)',
                  opacity: row.remove ? 0.7 : 1,
                  background: row.selected && !row.remove ? 'transparent' : 'var(--theme-elevation-50)',
                }}>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={() => toggleRow(i)}
                    />
                  </td>
                  <td style={tdStyle}>{row.fullName}</td>
                  <td style={tdStyle}>{row.email}</td>
                  <td style={tdStyle}>{row.memberId}</td>
                  <td style={tdStyle}>{row.phone}</td>
                  <td style={tdStyle}>{row.status}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {row.remove ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: 'var(--theme-error-100)',
                          color: 'var(--theme-error-700)',
                        }}>
                          remove
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: row.action === 'new'
                            ? 'var(--theme-success-100)'
                            : row.action === 'update'
                              ? 'var(--theme-warning-100)'
                              : 'var(--theme-elevation-100)',
                          color: row.action === 'new'
                            ? 'var(--theme-success-700)'
                            : row.action === 'update'
                              ? 'var(--theme-warning-700)'
                              : 'var(--theme-elevation-600)',
                        }}>
                          {row.action}
                        </span>
                      )}
                      {row.action === 'update' && (
                        <button
                          type="button"
                          onClick={() => toggleRemove(i)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--theme-error-300)',
                            borderRadius: '3px',
                            color: 'var(--theme-error-500)',
                            cursor: 'pointer',
                            fontSize: '0.6875rem',
                            padding: '1px 6px',
                            fontWeight: 500,
                          }}
                        >
                          {row.remove ? 'undo' : 'remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--theme-error-500)', margin: '0 0 0.5rem 0', whiteSpace: 'pre-wrap' }}>
          {error}
        </p>
      )}
      {status && !error && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--theme-elevation-500)', margin: '0 0 0.5rem 0' }}>
          {status}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading || !sheetUrl}
          style={{
            ...btnBase,
            background: 'var(--theme-input-bg)',
            opacity: loading || !sheetUrl ? 0.5 : 1,
          }}
        >
          Preview
        </button>
        {preview && (
          <button
            type="button"
            onClick={() => setConfirmSync(true)}
            disabled={loading}
            style={{
              ...btnBase,
              background: 'var(--theme-elevation-800)',
              color: 'var(--theme-elevation-0)',
              borderColor: 'var(--theme-elevation-800)',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Syncing...' : 'Sync'}
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          style={{
            ...btnBase,
            background: 'var(--theme-input-bg)',
          }}
        >
          Export Saved Members
        </button>
      </div>

      {confirmSync && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--theme-warning-100)',
          border: '1px solid var(--theme-warning-300)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--theme-warning-900)', fontWeight: 500 }}>
            Sync {preview?.filter((r) => r.selected && !r.remove).length || 0} members?
          </span>
          <button
            type="button"
            onClick={handleSync}
            disabled={loading}
            style={{
              ...btnBase,
              background: 'var(--theme-error-500)',
              color: '#fff',
              borderColor: 'var(--theme-error-500)',
              fontSize: '0.8125rem',
              padding: '0.375rem 0.75rem',
            }}
          >
            Confirm Sync
          </button>
          <button
            type="button"
            onClick={() => setConfirmSync(false)}
            disabled={loading}
            style={{
              ...btnBase,
              background: 'var(--theme-input-bg)',
              fontSize: '0.8125rem',
              padding: '0.375rem 0.75rem',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--theme-elevation-700)',
  borderBottom: '1px solid var(--theme-elevation-200)',
  position: 'sticky',
  top: 0,
  background: 'var(--theme-elevation-100)',
}

const tdStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  color: 'var(--theme-elevation-700)',
}
