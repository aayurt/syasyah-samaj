import { useEffect, useState } from 'react'
import { Download, Plus, Pencil, Trash2 } from 'lucide-react'
import { api, useSyncState, fmt } from '../lib/api'
import { useT } from '../lib/i18n'
import { downloadCsv } from '../lib/csv'
import { pushToast } from '../lib/toast'
import SearchBox from '../components/SearchBox'

type MembershipType = {
  id: number
  name: string
  fee: number
  periodMonths: number
  description?: string
  active: boolean
}

const emptyForm = { name: '', fee: '', periodMonths: '12', description: '' }

export default function MembershipTypes() {
  const t = useT()
  const { cacheVersion } = useSyncState()
  const [types, setTypes] = useState<MembershipType[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api<{ docs: MembershipType[] }>('/membership-types', { query: { limit: 100, depth: 0 } })
      .then((res) => setTypes(res.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [cacheVersion])

  const filtered = search
    ? types.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : types

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      name: form.name,
      fee: Number(form.fee),
      periodMonths: Number(form.periodMonths) || 12,
      description: form.description,
      active: true,
    }
    try {
      if (editing) {
        await api(`/membership-types/${editing}`, { method: 'PATCH', body })
        pushToast('success', 'Membership type updated')
      } else {
        await api('/membership-types', { method: 'POST', body })
        pushToast('success', 'Membership type created')
      }
      setForm(emptyForm)
      setEditing(null)
      setShowForm(false)
      load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    }
  }

  const handleEdit = (t: MembershipType) => {
    setForm({
      name: t.name,
      fee: String(t.fee),
      periodMonths: String(t.periodMonths),
      description: t.description || '',
    })
    setEditing(t.id)
    setShowForm(true)
  }

  const handleDelete = async (t: MembershipType) => {
    if (!confirm(`Delete "${t.name}"?`)) return
    try {
      await api(`/membership-types/${t.id}`, { method: 'DELETE' })
      pushToast('success', 'Deleted')
      load()
    } catch (err) {
      pushToast('error', 'Failed', err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">{t('membershipTypes.title', 'Membership Types')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCsv('membership-types.csv', ['Name', 'Fee', 'Period (months)', 'Description', 'Active'],
              filtered.map((t) => [t.name, t.fee, t.periodMonths, t.description || '', t.active ? 'Yes' : 'No']))
            }
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> CSV
          </button>
          <SearchBox value={search} onChange={setSearch} placeholder={t('membershipTypes.searchPlaceholder', 'Search types…')} />
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); setForm(emptyForm) }}
            className="inline-flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
          >
            <Plus size={14} />
            {t('membershipTypes.addType', 'Add Type')}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {editing ? t('membershipTypes.editType', 'Edit Membership Type') : t('membershipTypes.newType', 'New Membership Type')}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder={t('common.name', 'Name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-crimson-500 focus:outline-none"
            />
            <input
              type="number"
              placeholder={t('membershipTypes.fee', 'Fee (NPR)')}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: e.target.value })}
              required
              min={0}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-crimson-500 focus:outline-none"
            />
            <input
              type="number"
              placeholder={t('membershipTypes.period', 'Period (months)')}
              value={form.periodMonths}
              onChange={(e) => setForm({ ...form, periodMonths: e.target.value })}
              min={1}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-crimson-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700"
              >
                {editing ? t('modal.update', 'Update') : t('modal.create', 'Create')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}
                className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && types.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">{t('common.loading', 'Loading…')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          {search ? t('membershipTypes.noTypesMatch', 'No types match.') : t('membershipTypes.noMembershipTypes', 'No membership types yet.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('common.name', 'Name')}</th>
                <th className="px-4 py-3">{t('membershipTypes.fee', 'Fee')}</th>
                <th className="px-4 py-3">{t('membershipTypes.period', 'Period')}</th>
                <th className="px-4 py-3">{t('common.description', 'Description')}</th>
                <th className="px-4 py-3">{t('status.active', 'Active')}</th>
                <th className="px-4 py-3 text-right">{t('settings.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((mt) => (
                <tr key={mt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{mt.name}</td>
                  <td className="px-4 py-3 text-slate-600">{fmt(mt.fee)}</td>
                  <td className="px-4 py-3 text-slate-600">{t('membershipTypes.periodMonths', mt.periodMonths + ' months').replace('{n}', String(mt.periodMonths))}</td>
                  <td className="px-4 py-3 text-slate-500">{mt.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      mt.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {mt.active ? t('status.active', 'Active') : t('membershipTypes.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(mt)}
                        title="Edit"
                        className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(mt)}
                        title="Delete"
                        className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
