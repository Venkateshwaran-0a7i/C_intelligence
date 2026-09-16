import { Calendar, FlaskConical, Hash } from 'lucide-react'
import type { LimsResults } from '../types'
import { formatDate } from '../lib/format'

// ── Analysis rendering helpers ────────────────────────────────────────────────

const VALUE_KEYS = ['value_f', 'value_s', 'result', 'result_value', 'value', 'RESULT']
const UNIT_KEYS  = ['unit', 'UNIT']
const NAME_KEYS  = ['description', 'pa_desc', 'pa_name', 'parameter_name', 'test_name', 'param_name', 'analysis_name', 'PA_NAME']
const LAB_KEYS   = ['parameter', 'method', 'instrument', 'lower_limit', 'upper_limit', 'limit']

function displayName(a: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    if (a[k] && String(a[k]) !== 'Not Available') return String(a[k])
  }
  return ''
}

function findValue(a: Record<string, unknown>): string {
  const vf = a['value_f']
  if (typeof vf === 'number' && !Number.isNaN(vf)) {
    return Number.isInteger(vf) ? String(vf) : String(vf)
  }
  for (const k of VALUE_KEYS) {
    if (a[k] !== undefined && a[k] !== null && String(a[k]) !== '') return String(a[k])
  }
  return ''
}

function findUnit(a: Record<string, unknown>): string {
  for (const k of UNIT_KEYS) {
    if (a[k]) return String(a[k])
  }
  const ad = a['additional_data']
  if (ad && typeof ad === 'object' && (ad as Record<string, unknown>)['UNIT']) {
    return String((ad as Record<string, unknown>)['UNIT'])
  }
  return ''
}

function extraFields(a: Record<string, unknown>): [string, string][] {
  const used = new Set([
    ...NAME_KEYS, ...VALUE_KEYS, ...UNIT_KEYS,
    'pg', 'sc', 'pa', 'id', '_id',
    'created_at', 'updated_at', 'assign_date',
    'additional_data',
  ])
  const extra: [string, string][] = []
  for (const [k, v] of Object.entries(a)) {
    if (used.has(k)) continue
    if (v === undefined || v === null) continue
    const s = typeof v === 'object' ? '' : String(v)
    if (s === '' || s === 'Not Available') continue
    extra.push([k, s])
  }
  return extra
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LimsPanel({ limsResults }: { limsResults: LimsResults }) {
  const groups = limsResults.parameter_groups ?? []
  const sample = limsResults.sample ?? {}

  const scValue    = String(sample.sc_value   ?? sample.SC_VALUE   ?? '')
  const description = String(sample.description ?? sample.DESCRIPTION ?? '')
  const samplingDate = String(sample.sampling_date ?? sample.SAMPLING_DATE ?? '')

  return (
    <div className="space-y-5">

      {/* ── Linked sample identity card ──────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-teal-200 bg-teal-50">
        {/* Header strip */}
        <div className="flex items-center gap-2 border-b border-teal-100 bg-teal-100/60 px-4 py-2">
          <FlaskConical className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Linked LIMS sample
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3 sm:flex sm:items-start sm:gap-6">
          {/* LIMS ID */}
          <div className="flex items-start gap-2 sm:w-56 sm:shrink-0">
            <Hash className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-teal-500">
                LIMS ID
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-teal-900">
                {scValue || '—'}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-3 h-px bg-teal-100 sm:my-0 sm:h-auto sm:w-px" />

          {/* Description + date */}
          <div className="flex-1 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-teal-500">
              Description
            </p>
            <p className="text-sm font-medium text-teal-900">
              {description || <span className="italic text-teal-400">No description</span>}
            </p>
            {samplingDate && (
              <p className="inline-flex items-center gap-1 text-xs text-teal-600">
                <Calendar className="h-3 w-3" />
                Sampled {formatDate(samplingDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Parameter groups or empty state ──────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <FlaskConical className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            No parameter results are available for this sample yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, i) => {
            const groupName =
              String(group.PG_NAME ?? group.parameter_group_name ?? '').trim() ||
              `Group ${i + 1}`
            const analyses = group.analyses ?? []
            return (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <h4 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
                  {groupName}
                </h4>
                <ul className="divide-y divide-slate-100">
                  {analyses.map((a, j) => {
                    const name  = displayName(a)
                    const value = findValue(a)
                    const unit  = findUnit(a)
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
      )}
    </div>
  )
}
