const STYLES: Record<string, string> = {
  High: 'bg-teal-100 text-teal-800 border-teal-200',
  Medium: 'bg-slate-100 text-slate-600 border-slate-200',
  Low: 'bg-amber-100 text-amber-800 border-amber-200',
}

const DEFAULTS: Record<string, string> = {
  High: 'bg-teal-100 text-teal-800 border-teal-200',
  Medium: 'bg-slate-100 text-slate-600 border-slate-200',
  Low: 'bg-amber-100 text-amber-800 border-amber-200',
}

export default function ConfidenceBadge({
  value,
}: {
  value: string | null | undefined
}) {
  if (!value) return null
  const key = value in DEFAULTS ? value : 'Medium'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none ${STYLES[key] ?? STYLES.Medium}`}
    >
      {value}
    </span>
  )
}
