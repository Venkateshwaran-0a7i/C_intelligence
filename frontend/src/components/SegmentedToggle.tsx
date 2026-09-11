interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

export default function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              active
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
