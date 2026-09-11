import { FlaskConical } from 'lucide-react'
import type { LimsResults } from '../types'
import { formatDate } from '../lib/format'

// Render one analysis row. The parameter analysis documents (lims_pa) have a
// flexible schema — we display every readable field that carries a value,
// highlighting the most common ones (parameter name / result / unit).
const VALUE_KEYS = ['result', 'result_value', 'value', 'RESULT']
const UNIT_KEYS = ['unit', 'UNIT']
const NAME_KEYS = ['parameter_name', 'test_name', 'param_name', 'analysis_name', 'PA_NAME']
const LAB_KEYS = ['parameter', 'method', 'instrument', 'lower_limit', 'upper_limit', 'limit']

function displayName(a: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    if (a[k] && String(a[k]) !== 'Not Available') return String(a[k])
  }
  return ''
}

function findValue(a: Record<string, unknown>): string {
  for (const k of VALUE_KEYS) {
    if (a[k] !== undefined && a[k] !== null && String(a[k]) !== '') return String(a[k])
  }
  return ''
}

function findUnit(a: Record<string, unknown>): string {
  for (const k of UNIT_KEYS) {
    if (a[k]) return String(a[k])
  }
  return ''
}

function extraFields(a: Record<string, unknown>): [string, string][] {
  const used = new Set([...NAME_KEYS, ...VALUE_KEYS, ...UNIT_KEYS, LAB_KEYS[0]])
  const extra: [string, string][] = []
  for (const [k, v] of Object.entries(a)) {
    if (used.has(k)) continue
    if (v === undefined || v === null) continue
    const s = String(v)
    if (s === '' || s === 'Not Available') continue
    if (k === 'pg' || k === 'sc' || k === '_id') continue
    extra.push([k, s])
  }
  return extra
}

export default function LimsPanel({ limsResults }: { limsResults: LimsResults }) {
  const groups = limsResults.parameter_groups ?? []

  if (groups.length === 0) {
    return (
      <EmptyLimsResults
        sampleDate={limsResults.sample?.SAMPLING_DATE as string | undefined}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <FlaskConical className="h-4 w-4 text-teal-600" />
        <span>
          Sample{' '}
          <span className="font-mono text-slate-700">
            {String(limsResults.sample?.sc_value ?? '')}
          </span>
          {limsResults.sample?.SAMPLING_DATE ? (
            <span className="ml-2 text-slate-400">
              {formatDate(limsResults.sample?.SAMPLING_DATE as string)}
            </span>
          ) : null}
        </span>
      </div>

      {groups.map((group, i) => {
        const groupName =
          String(group.PG_NAME ?? group.parameter_group_name ?? '').trim() ||
          `Group ${i + 1}`
        const analyses = group.analyses ?? []
        return (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <h4 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
              {groupName}
            </h4>
            <ul className="divide-y divide-slate-100">
              {analyses.map((a, j) => {
                const name = displayName(a)
                const value = findValue(a)
                const unit = findUnit(a)
                const extra = extraFields(a)
                return (
                  <li key={j} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-slate-700">
                        {name || <span className="italic text-slate-400">Untitled test</span>}
                      </span>
                      <span className="whitespace-nowrap font-mono text-sm text-slate-900">
                        {value}
                        {unit ? <span className="ml-1 text-slate-500">{unit}</span> : null}
                      </span>
                    </div>
                    {extra.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                        {extra.map(([k, v]) => (
                          <span key={k} className="text-xs text-slate-400">
                            <span className="capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                            <span className="font-mono text-slate-500">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
              {analyses.length === 0 && (
                <li className="px-4 py-3 text-sm italic text-slate-400">
                  No analyses in this group.
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function EmptyLimsResults({ sampleDate }: { sampleDate?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <FlaskConical className="mb-2 h-8 w-8 text-slate-300" />
      <p className="text-sm text-slate-500">
        No parameter results found
        {sampleDate ? ` for sample dated ${formatDate(sampleDate)}` : ''}.
      </p>
    </div>
  )
}
