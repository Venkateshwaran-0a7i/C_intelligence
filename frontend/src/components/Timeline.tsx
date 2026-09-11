import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, History } from 'lucide-react'
import type { ExpandedHistoryEntry } from '../types'
import { formatDateTime } from '../lib/format'

function LimsStatusBadge({ entry }: { entry: ExpandedHistoryEntry }) {
  return entry.lims_sc_value ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
      <CheckCircle2 className="h-3 w-3" />
      LIMS linked
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      No LIMS
    </span>
  )
}

function summary(entry: ExpandedHistoryEntry) {
  const data = entry.product_data
  if (!data) return null
  const claims = [
    ...(data.packaging_claims?.front_package_claims ?? []),
    ...(data.packaging_claims?.back_package_claims ?? []),
  ].filter((c) => c && c.trim() !== '')
  const ingredients = (data.ingredients_information?.ingredients ?? []).filter(
    (i) => i && i.trim() !== '',
  )
  return { claims, ingredients }
}

export default function Timeline({
  entries,
}: {
  entries: ExpandedHistoryEntry[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <History className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No scans recorded for this product yet.</p>
      </div>
    )
  }

  // Newest first
  const sorted = [...entries].sort((a, b) =>
    (b.analyzed_at ?? '').localeCompare(a.analyzed_at ?? ''),
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <ol className="space-y-2">
      {sorted.map((entry) => {
        const key = entry.product_data_id
        const isOpen = expanded.has(key)
        const s = summary(entry)
        return (
          <li key={key} className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-800">
                  {formatDateTime(entry.analyzed_at)}
                </span>
                <LimsStatusBadge entry={entry} />
                {entry.lims_sc_value && (
                  <span className="font-mono text-xs text-slate-500">
                    {entry.lims_sc_value}
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 py-3">
                {s ? (
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Claims
                      </h5>
                      {s.claims.length === 0 ? (
                        <p className="mt-1 text-sm italic text-slate-400">None</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {s.claims.map((c, i) => (
                            <span
                              key={i}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Ingredients
                      </h5>
                      {s.ingredients.length === 0 ? (
                        <p className="mt-1 text-sm italic text-slate-400">None</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {s.ingredients.slice(0, 12).map((it, i) => (
                            <span
                              key={i}
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                            >
                              {it}
                            </span>
                          ))}
                          {s.ingredients.length > 12 && (
                            <span className="text-xs text-slate-400">
                              +{s.ingredients.length - 12} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {entry.product_data?.metadata?.model && (
                      <p className="text-xs text-slate-400">
                        Model: <span className="font-mono">{entry.product_data.metadata.model}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-400">
                    Full scan data not available.
                  </p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
