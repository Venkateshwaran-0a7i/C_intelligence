import { Search } from 'lucide-react'
import SegmentedToggle from './SegmentedToggle'

export type CompetitorFilter = 'all' | 'own' | 'competitor'

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  business: string
  onBusinessChange: (v: string) => void
  division: string
  onDivisionChange: (v: string) => void
  brand: string
  onBrandChange: (v: string) => void
  competitor: CompetitorFilter
  onCompetitorChange: (v: CompetitorFilter) => void
  businessOptions: string[]
}

const inputClasses =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none'

export default function FilterBar({
  search,
  onSearchChange,
  business,
  onBusinessChange,
  division,
  onDivisionChange,
  brand,
  onBrandChange,
  competitor,
  onCompetitorChange,
  businessOptions,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search this page…"
          className={`${inputClasses} w-full pl-9`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Business
          <select
            value={business}
            onChange={(e) => onBusinessChange(e.target.value)}
            className={inputClasses}
          >
            <option value="">All businesses</option>
            {businessOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Division
          <input
            type="text"
            value={division}
            onChange={(e) => onDivisionChange(e.target.value)}
            placeholder="Division…"
            className={inputClasses}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Brand
          <input
            type="text"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            placeholder="Brand…"
            className={inputClasses}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Scope</span>
        <SegmentedToggle<CompetitorFilter>
          options={[
            { value: 'all', label: 'All' },
            { value: 'own', label: 'Own product' },
            { value: 'competitor', label: 'Competitor' },
          ]}
          value={competitor}
          onChange={onCompetitorChange}
        />
      </div>
    </div>
  )
}
