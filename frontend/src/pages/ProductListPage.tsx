import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageSearch, ServerCrash } from 'lucide-react'
import api, { ApiError } from '../lib/api'
import type { ProductListItem } from '../types'
import FilterBar, { type CompetitorFilter } from '../components/FilterBar'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import EmptyState from '../components/EmptyState'
import { SkeletonGrid } from '../components/Skeletons'

const PAGE_SIZE = 20

export default function ProductListPage() {
  const [items, setItems] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [business, setBusiness] = useState('')
  const [division, setDivision] = useState('')
  const [brand, setBrand] = useState('')
  const [competitor, setCompetitor] = useState<CompetitorFilter>('all')

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
        is_competitor: isCompetitor,
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
  }, [page, business, division, brand, competitor])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  const resetPage = useCallback(() => setPage(1), [])

  const handleBusinessChange = (v: string) => {
    setBusiness(v)
    resetPage()
  }
  const handleDivisionChange = (v: string) => {
    setDivision(v)
    resetPage()
  }
  const handleBrandChange = (v: string) => {
    setBrand(v)
    resetPage()
  }
  const handleCompetitorChange = (v: CompetitorFilter) => {
    setCompetitor(v)
    resetPage()
  }

  // Client-side text search over the already-fetched page.
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((p) =>
      [p.product_name, p.brand, p.variant, p.net_quantity]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    )
  }, [items, search])

  const businessOptions = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((p) => p.business)
            .filter((b): b is string => Boolean(b) && b !== 'Not Available'),
        ),
      ).sort(),
    [items],
  )

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        business={business}
        onBusinessChange={handleBusinessChange}
        division={division}
        onDivisionChange={handleDivisionChange}
        brand={brand}
        onBrandChange={handleBrandChange}
        competitor={competitor}
        onCompetitorChange={handleCompetitorChange}
        businessOptions={businessOptions}
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
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No products found"
          message={
            search
              ? 'No products on this page match your text search. Try clearing the search or applying different filters.'
              : 'No products match the current filters. Upload a product to get started.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((p) => (
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
