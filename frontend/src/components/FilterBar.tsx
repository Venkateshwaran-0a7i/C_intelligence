import { Search } from 'lucide-react'
import SegmentedToggle from './SegmentedToggle'
import type { FilterOptions } from '../types'

export type CompetitorFilter = 'all' | 'own' | 'competitor'

export type UploadedDataFilter = '' | 'has_images' | 'missing_images' | 'needs_review'

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  business: string
  onBusinessChange: (v: string) => void
  division: string
  onDivisionChange: (v: string) => void
  brand: string
  onBrandChange: (v: string) => void
  productCategory: string
  onProductCategoryChange: (v: string) => void
  competitor: CompetitorFilter
  onCompetitorChange: (v: CompetitorFilter) => void
  uploadedData: UploadedDataFilter
  onUploadedDataChange: (v: UploadedDataFilter) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  filterOptions: FilterOptions
}

const PERIOD_PRESETS = [
  { label: 'All time', days: null },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last quarter', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
]

const selectClasses =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none'

const inputClasses =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none'

function EmptyOption({ label }: { label: string }) {
  return (
    <option value="" disabled hidden={false}>
      {label}
    </option>
  )
}

export default function FilterBar({
  search,
  onSearchChange,
  business,
  onBusinessChange,
  division,
  onDivisionChange,
  brand,
  onBrandChange,
  productCategory,
  onProductCategoryChange,
  competitor,
  onCompetitorChange,
  uploadedData,
  onUploadedDataChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  filterOptions,
}: FilterBarProps) {
  /** Detect which period preset (if any) matches the current date range. */
  const activePeriod = (() => {
    if (!dateFrom && !dateTo) return 'all_time'
    for (const p of PERIOD_PRESETS) {
      if (p.days === null) continue
      const expectedFrom = new Date(Date.now() - p.days * 86_400_000)
        .toISOString()
        .slice(0, 10)
      if (dateFrom === expectedFrom && !dateTo) return String(p.days)
    }
    return 'custom'
  })()

  const applyPeriod = (days: number | null) => {
    if (days === null) {
      onDateFromChange('')
      onDateToChange('')
      return
    }
    const to = new Date()
    const from = new Date(to.getTime() - days * 86_400_000)
    onDateFromChange(from.toISOString().slice(0, 10))
    onDateToChange('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search all products…"
          className={`${inputClasses} w-full pl-9`}
        />
      </div>

      {/* Dropdowns row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Business */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Business
          <select
            value={business}
            onChange={(e) => onBusinessChange(e.target.value)}
            className={selectClasses}
          >
            <option value="">All businesses</option>
            {filterOptions.businesses.length === 0 ? (
              <option value="" disabled>No options yet</option>
            ) : (
              filterOptions.businesses.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))
            )}
          </select>
        </label>

        {/* Division */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Division
          <select
            value={division}
            onChange={(e) => onDivisionChange(e.target.value)}
            className={selectClasses}
          >
            <option value="">All divisions</option>
            {filterOptions.divisions.length === 0 ? (
              <option value="" disabled>No options yet</option>
            ) : (
              filterOptions.divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))
            )}
          </select>
        </label>

        {/* Brand */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Brand
          <select
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            className={selectClasses}
          >
            <option value="">All brands</option>
            {filterOptions.brands.length === 0 ? (
              <option value="" disabled>No options yet</option>
            ) : (
              filterOptions.brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))
            )}
          </select>
        </label>

        {/* Product Category */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Category
          <select
            value={productCategory}
            onChange={(e) => onProductCategoryChange(e.target.value)}
            className={selectClasses}
          >
            <option value="">All categories</option>
            {filterOptions.product_categories.length === 0 ? (
              <option value="" disabled>No categories yet</option>
            ) : (
              filterOptions.product_categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))
            )}
          </select>
        </label>

        {/* Uploaded data */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Uploaded data
          <select
            value={uploadedData}
            onChange={(e) => onUploadedDataChange(e.target.value as UploadedDataFilter)}
            className={selectClasses}
          >
            <option value="">All</option>
            <option value="has_images">Has images</option>
            <option value="missing_images">Missing images</option>
            <option value="needs_review">Needs review</option>
          </select>
        </label>
      </div>

      {/* Date range + Period row */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Period
          <select
            value={activePeriod === 'custom' ? 'custom' : (activePeriod === 'all_time' ? 'all_time' : activePeriod)}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'all_time') applyPeriod(null)
              else if (v !== 'custom') applyPeriod(Number(v))
            }}
            className={selectClasses}
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.days ?? 'all'} value={p.days === null ? 'all_time' : String(p.days)}>
                {p.label}
              </option>
            ))}
            {activePeriod === 'custom' && (
              <option value="custom">Custom range</option>
            )}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={inputClasses}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={inputClasses}
          />
        </label>
      </div>

      {/* Scope (competitor toggle) */}
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
