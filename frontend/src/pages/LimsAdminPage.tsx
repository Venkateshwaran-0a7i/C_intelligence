import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Search, ServerCrash } from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { LimsAdminRow } from '../types'
import { formatDate } from '../lib/format'

export default function LimsAdminPage() {
  const [rows, setRows] = useState<LimsAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getLimsAdmin()
      setRows(data.results)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load LIMS data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.sc_value.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }, [rows, filter])

  const linked = rows.filter((r) => r.linked_product_count > 0).length
  const unlinked = rows.length - linked

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-200 bg-teal-50">
          <FlaskConical className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">LIMS Sample Cards</h1>
          <p className="text-sm text-slate-500">
            Browse all sample cards from <span className="font-mono text-xs">lims_sc</span>
          </p>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total samples', value: rows.length },
            { label: 'Linked to a product', value: linked },
            { label: 'Unlinked', value: unlinked },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center"
            >
              <p className="text-2xl font-semibold text-slate-900">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by LIMS ID or description…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <FlaskConical className="h-8 w-8 animate-pulse" />
            <p className="text-sm">Loading LIMS data…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <ServerCrash className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <p className="text-xs text-slate-400">
            Showing {filtered.length} of {rows.length} sample card
            {rows.length !== 1 ? 's' : ''}
          </p>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left">LIMS ID (sc_value)</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Sample date</th>
                  <th className="px-4 py-3 text-center">Linked products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm italic text-slate-400"
                    >
                      No sample cards match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.sc_value}
                      className="transition-colors hover:bg-slate-50"
                    >
                      {/* LIMS ID */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {r.sc_value}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-slate-700">
                        {r.description || (
                          <span className="italic text-slate-400">—</span>
                        )}
                      </td>

                      {/* Sample date */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {r.sampling_date ? formatDate(r.sampling_date) : '—'}
                      </td>

                      {/* Linked products badge */}
                      <td className="px-4 py-3 text-center">
                        {r.linked_product_count > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                            {r.linked_product_count} product
                            {r.linked_product_count !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-400">
                            Unlinked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
