import { useEffect, useMemo, useState } from 'react'
import { Search, X, Calendar } from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { LimsSearchResult } from '../types'
import { formatDate } from '../lib/format'

interface LimsSearchModalProps {
  productId: string
  productDataId: string
  defaultQuery: string
  onClose: () => void
  onAttached: (scValue: string) => void
}

export default function LimsSearchModal({
  productId,
  productDataId,
  defaultQuery,
  onClose,
  onAttached,
}: LimsSearchModalProps) {
  const [all, setAll] = useState<LimsSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState(defaultQuery)
  const [linking, setLinking] = useState<string | null>(null)

  // Fetch the full list once on open — no per-keystroke network calls
  useEffect(() => {
    setLoading(true)
    api
      .listLims()
      .then((data) => setAll(data.results))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Failed to load LIMS samples'),
      )
      .finally(() => setLoading(false))
  }, [])

  // Client-side filter — instant, no round-trips
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (r) =>
        r.description?.toLowerCase().includes(q) ||
        r.sc_value?.toLowerCase().includes(q),
    )
  }, [all, filter])

  const handleUse = async (scValue: string) => {
    setLinking(scValue)
    setError(null)
    try {
      await api.attachLims(productDataId, {
        product_id: productId,
        lims_sc_value: scValue,
        confirmed_by: 'user',
      })
      onAttached(scValue)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to link LIMS sample')
      setLinking(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">Link a LIMS sample</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter the list…"
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-slate-500">Loading LIMS samples…</p>}

          {!loading && !error && (
            <p className="mb-2 text-xs text-slate-400">
              Showing {filtered.length} of {all.length} LIMS sample(s)
            </p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm italic text-slate-400">
              No samples match this filter.
            </p>
          )}

          <ul className="space-y-2">
            {filtered.map((r) => (
              <li key={r.sc_value} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{r.description}</p>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">{r.sc_value}</span>
                    {r.sampling_date && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {formatDate(r.sampling_date)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleUse(r.sc_value)}
                    disabled={linking === r.sc_value}
                    className="rounded-md border border-teal-600 bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {linking === r.sc_value ? 'Linking…' : 'Use this'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
