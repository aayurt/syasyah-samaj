'use client'
import React, { useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import { Button, TextInput } from '@payloadcms/ui'

export const SyncSheets: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1C3HJK_dA_lhtXPqyhNUYSuWFTRCjUiGa1BndZMMm_qA/edit?usp=sharing')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleSync = async () => {
    setLoading(true)
    setStatus('Syncing...')
    try {
      const response = await fetch('/api/members/sync-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheetUrl }),
      })
      const data = await response.json()
      if (data.success) {
        setStatus(`Successfully synced ${data.count} members!`)
      } else {
        setStatus(`Error: ${data.error}`)
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h3>Sync Members from Google Sheets</h3>
      <div style={{ marginBottom: '10px' }}>
        <TextInput
           label="Google Sheet URL"
           path="sheetUrl"
           value={sheetUrl}
           onChange={(e: any) => setSheetUrl(e.target.value)}
        />
      </div>
      <Button onClick={handleSync} disabled={loading}>
        {loading ? 'Syncing...' : 'Start Sync'}
      </Button>
      {status && <p style={{ marginTop: '10px' }}>{status}</p>}
    </div>
  )
}
