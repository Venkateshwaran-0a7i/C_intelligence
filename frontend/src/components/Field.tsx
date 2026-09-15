import type { ReactNode } from 'react'
import ConfidenceBadge from './ConfidenceBadge'

interface FieldProps {
  label: string
  children: ReactNode
  className?: string
}

export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{children}</dd>
    </div>
  )
}

interface FieldValueProps {
  label: string
  value: string | null | undefined
  confidence?: string
  mono?: boolean
  className?: string
  fallback?: string
}

export function FieldValue({
  label,
  value,
  confidence,
  mono,
  className,
  fallback = 'Not Available',
}: FieldValueProps) {
  const notAvailable = !value || value === 'Not Available' || value.trim() === ''
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </dt>
        {confidence && <ConfidenceBadge value={confidence} />}
      </div>
      <dd
        className={`mt-1 text-sm ${mono ? 'font-mono' : ''} ${
          notAvailable ? 'text-slate-400 italic' : 'text-slate-900'
        }`}
      >
        {notAvailable ? fallback : value}
      </dd>
    </div>
  )
}

interface ChipListProps {
  label: string
  items?: (string | { value?: string; confidence?: string } | null)[] | null
  className?: string
}

/** Safely coerce a chip item — string or {value} object — to display text. */
function chipText(item: string | { value?: string } | null | undefined): string {
  if (item == null) return ''
  if (typeof item === 'string') return item.trim()
  if (typeof item === 'object' && 'value' in item) {
    return (item.value ?? '').toString().trim()
  }
  return String(item).trim()
}

export function ChipList({ label, items, className }: ChipListProps) {
  const list = (items ?? [])
    .map(chipText)
    .filter((text) => text !== '' && text !== 'Not Available')

  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2">
        {list.length === 0 ? (
          <span className="text-sm italic text-slate-400">Not Available</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {list.map((item, i) => (
              <li
                key={i}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  )
}

interface TextBlockProps {
  label: string
  value?: string | null
  mono?: boolean
  className?: string
}

export function TextBlock({ label, value, mono, className }: TextBlockProps) {
  const empty = !value || value === 'Not Available' || value.trim() === ''
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm whitespace-pre-wrap ${
          mono ? 'font-mono' : ''
        } ${empty ? 'italic text-slate-400' : 'text-slate-900'}`}
      >
        {empty ? 'Not Available' : value}
      </dd>
    </div>
  )
}
