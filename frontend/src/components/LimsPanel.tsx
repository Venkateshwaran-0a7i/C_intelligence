import { Calendar, FlaskConical, Hash } from 'lucide-react'
import type { LimsResults, LimsParameterGroup } from '../types'
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

/** Coerce any item to a plain trimmed string (mirrors Timeline.tsx toText). */
function toText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object' && 'value' in (v as object))
    return String((v as { value?: unknown }).value ?? '').trim()
  return String(v).trim()
}

// ── Structured table types ────────────────────────────────────────────────────

interface ParamRow {
  name: string
  value: string
  unit: string
  status: 'resulted' | 'pending'
}

function buildRow(a: Record<string, unknown>): ParamRow {
  const name =
    toText(a['description']) ||
    toText(a['pa_desc']) ||
    toText(a['pa_name']) ||
    toText(a['parameter_name']) ||
    toText(a['test_name']) ||
    toText(a['param_name']) ||
    toText(a['analysis_name']) ||
    toText(a['PA_NAME']) ||
    'Untitled test'
  const value = findValue(a)
  const unit = findUnit(a)
  // value_f: 0 is a real result — findValue() returns '0' via the
  // typeof-number check, so value !== '' and status is 'resulted'.
  return { name, value, unit, status: value === '' ? 'pending' : 'resulted' }
}

function StatusBadge({ status }: { status: ParamRow['status'] }) {
  return status === 'resulted' ? (
    <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
      Resulted
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
      Pending
    </span>
  )
}

// ── Shared parameter-group renderer ──────────────────────────────────────────

export function LimsParameterGroups({ groups }: { groups: LimsParameterGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <FlaskConical className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">
          No parameter results are available for this sample yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gi) => {
        const groupName =
          String(group.PG_NAME ?? group.parameter_group_name ?? '').trim() ||
          `Group ${gi + 1}`
        const analyses = group.analyses ?? []

        if (analyses.length === 0) {
          return (
            <div key={gi} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <h4 className="text-sm font-semibold text-slate-800">{groupName}</h4>
              </div>
              <p className="px-4 py-3 text-sm italic text-slate-400">
                No tests assigned to this group.
              </p>
            </div>
          )
        }

        const rows = analyses.map(buildRow)
        const resultedCount = rows.filter((r) => r.status === 'resulted').length

        return (
          <div key={gi} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* Group header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <h4 className="text-sm font-semibold text-slate-800">{groupName}</h4>
              <span className="text-xs text-slate-500">
                {resultedCount} / {rows.length} resulted
              </span>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Parameter</th>
                    <th className="px-4 py-2">Value</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">{row.name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-900">
                        {row.value || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.unit || '—'}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
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

      {/* ── Parameter groups ──────────────────────────────────────────────── */}
      <LimsParameterGroups groups={groups} />
    </div>
  )
}
