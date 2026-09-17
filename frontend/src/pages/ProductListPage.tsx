import { useCallback, useEffect, useRef, useState } from 'react'
import { PackageSearch, ServerCrash } from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { FilterOptions } from '../types'
import FilterBar, { type CompetitorFilter, type UploadedDataFilter } from '../components/FilterBar'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import { SkeletonGrid } from '../components/Skeletons'

const PAGE_SIZE = 20

const EMPTY_FILTER_OPTIONS: FilterOptions = {
  businesses: [],
  divisions: [],
  brands: [],
  product_categories: [],
}

export default function ProductListPage() {
  const [items, setItems] = useState<import('../types').ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(EMPTY_FILTER_OPTIONS)

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [business, setBusiness] = useState('')
  const [division, setDivision] = useState('')
  const [brand, setBrand] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [competitor, setCompetitor] = useState<CompetitorFilter>('all')
  const [uploadedData, setUploadedData] = useState<UploadedDataFilter>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Debounce search — 300 ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = (v: string) => {
    setSearch(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(v)
      setPage(1)
    }, 300)
  }

  // Fetch filter options once on mount
  useEffect(() => {
    api
      .getFilterOptions()
      .then(setFilterOptions)
      .catch(() => {
        // Non-fatal — filters just show "No options yet" instead of real values
      })
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const isCompetitor =
        competitor === 'all' ? undefined : competitor === 'competitor'
      const data = await api.getProducts({
        page,
        page_size: PAGE_SIZE,
        business: business || undefined,
        division: division || undefined,
        brand: brand || undefined,
        product_category: productCategory || undefined,
        is_competitor: isCompetitor,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: debouncedSearch || undefined,
        uploaded_data: uploadedData || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setItems([])
      setTotal(0)
      setError(e instanceof ApiError ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [page, business, division, brand, productCategory, competitor, dateFrom, dateTo, debouncedSearch, uploadedData])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  const resetPage = useCallback(() => setPage(1), [])

  const handleBusinessChange = (v: string) => { setBusiness(v); resetPage() }
  const handleDivisionChange = (v: string) => { setDivision(v); resetPage() }
  const handleBrandChange = (v: string) => { setBrand(v); resetPage() }
  const handleProductCategoryChange = (v: string) => { setProductCategory(v); resetPage() }
  const handleCompetitorChange = (v: CompetitorFilter) => { setCompetitor(v); resetPage() }
  const handleUploadedDataChange = (v: UploadedDataFilter) => { setUploadedData(v); resetPage() }
  const handleDateFromChange = (v: string) => { setDateFrom(v); resetPage() }
  const handleDateToChange = (v: string) => { setDateTo(v); resetPage() }

  const hasActiveFilters =
    debouncedSearch || business || division || brand || productCategory ||
    competitor !== 'all' || uploadedData || dateFrom || dateTo

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        business={business}
        onBusinessChange={handleBusinessChange}
        division={division}
        onDivisionChange={handleDivisionChange}
        brand={brand}
        onBrandChange={handleBrandChange}
        productCategory={productCategory}
        onProductCategoryChange={handleProductCategoryChange}
        competitor={competitor}
        onCompetitorChange={handleCompetitorChange}
        uploadedData={uploadedData}
        onUploadedDataChange={handleUploadedDataChange}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
        filterOptions={filterOptions}
      />

      {error ? (
        <EmptyState
          variant="error"
          icon={<ServerCrash className="h-10 w-10" />}
          title="Can't reach the backend"
          message={error}
          action={
            <button
              type="button"
              onClick={() => void fetchProducts()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
          }
        />
      ) : loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title={hasActiveFilters ? 'No products match your search' : 'No products yet'}
          message={
            hasActiveFilters
              ? 'Try adjusting or clearing your filters to see more results.'
              : 'Upload a product to get started.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <Pagination
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
