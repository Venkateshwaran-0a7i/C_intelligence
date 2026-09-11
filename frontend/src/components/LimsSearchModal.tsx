import { useEffect, useState } from 'react'
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
  const [query, setQuery] = useState(defaultQuery)
  const [results, setResults] = useState<LimsSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  const runSearch = async (q: string) => {
    setSearching(true)
    setError(null)
    setSearched(true)
    try {
      const data = await api.searchLims(q)
      setResults(data.results)
    } catch (e) {
      setResults([])
      setError(e instanceof ApiError ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  // Pre-fill + auto search once. Never auto-select a result.
  useEffect(() => {
    if (defaultQuery.trim()) {
      void runSearch(defaultQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-800">
            Link a LIMS sample
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch(query)
            }}
            placeholder="Search LIMS samples…"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void runSearch(query)}
            disabled={searching || !query.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {searching && <p className="text-sm text-slate-500">Searching…</p>}
          {!searching && !error && searched && results.length === 0 && (
            <p className="text-sm italic text-slate-400">
              No LIMS samples matched "{query}".
            </p>
          )}
          <ul className="space-y-2">
            {results.map((r) => (
              <li
                key={r.sc_value}
                className="rounded-lg border border-slate-200 p-3"
              >
                <p className="text-sm text-slate-800">{r.description}</p>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500">
                      {r.sc_value}
                    </span>
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
