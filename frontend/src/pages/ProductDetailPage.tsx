import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  FlaskConical,
  LinkIcon,
  ServerCrash,
  PackageSearch,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { ApiError } from '../lib/api'
import type {
  ExpandedHistoryEntry,
  ProductDetailResponse,
} from '../types'
import { FieldValue, ChipList } from '../components/Field'
import NutritionTable from '../components/NutritionTable'
import LimsPanel from '../components/LimsPanel'
import LimsSearchModal from '../components/LimsSearchModal'
import Timeline from '../components/Timeline'
import EmptyState from '../components/EmptyState'
import { SkeletonDetail } from '../components/Skeletons'
import { ProductThumbnail } from '../components/ProductCard'

type Tab = 'details' | 'lims' | 'timeline'

function identityLabel(v: string | undefined): string {
  if (!v || v === 'Not Available') return ''
  return v
}

export default function ProductDetailPage() {
  const { productId = '' } = useParams()
  const [detail, setDetail] = useState<ProductDetailResponse | null>(null)
  const [history, setHistory] = useState<ExpandedHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('details')
  const [limsModalOpen, setLimsModalOpen] = useState(false)

  // Tracks which specific scan the LIMS modal is targeting (from timeline or header button)
  const [limsModalTarget, setLimsModalTarget] = useState<{
    productDataId: string
    currentSc: string | null
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, h] = await Promise.all([
        api.getProductDetail(productId),
        api.getProductHistory(productId, true),
      ])
      setDetail(d)
      setHistory(h.history)
    } catch (e) {
      setDetail(null)
      setHistory([])
      setError(e instanceof ApiError ? e.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState
          variant="error"
          icon={error ? <ServerCrash className="h-10 w-10" /> : <PackageSearch className="h-10 w-10" />}
          title={error ? "Can't reach the backend" : 'Product not found'}
          message={error ?? `No product found with id ${productId}.`}
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to products
            </Link>
          }
        />
      </div>
    )
  }

  const info = detail.product_info
  const latest = detail.latest_product_data
  const limsResults = detail.lims_results

  // Sort scan_history by analyzed_at descending so latestScan always matches
  // detail.latest_product_data (which the backend selects via max analyzed_at),
  // regardless of MongoDB insertion order.
  const latestScan = [...(info.scan_history ?? [])].sort(
    (a, b) => (b.analyzed_at ?? '').localeCompare(a.analyzed_at ?? ''),
  )[0]

  const productDataId = latestScan?.product_data_id ?? ''
  const scanCount = info.scan_history?.length ?? 0
  const identity = latest?.product_identification
  const mfg = latest?.manufacturing_information
  const pricing = latest?.pricing_information
  const identifiers = latest?.product_identifiers

  const subtitle =
    [info.brand, info.variant, info.net_quantity]
      .filter((s) => s && s.trim() !== '' && s !== 'Not Available')
      .join(' · ') || 'Unnamed product'

  const limsModalQuery = [info.brand, info.product_name, info.variant]
    .filter((s) => s && s !== 'Not Available')
    .join(' ')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'lims', label: 'Lab results (LIMS)' },
    { key: 'timeline', label: `Timeline (${scanCount})` },
  ]

  /** Open the LIMS modal targeting a specific scan. */
  const handleOpenLimsModal = (productDataId: string, currentSc: string | null) => {
    setLimsModalTarget({ productDataId, currentSc })
    setLimsModalOpen(true)
  }

  /** Open the LIMS modal targeting the latest scan (header / LIMS-tab shortcut). */
  const handleOpenLimsModalForLatest = () => {
    handleOpenLimsModal(productDataId, latestScan?.lims_sc_value ?? null)
  }

  const handleLimsClose = () => {
    setLimsModalOpen(false)
    setLimsModalTarget(null)
  }

  const handleLimsAttached = () => {
    setLimsModalOpen(false)
    setLimsModalTarget(null)
    void load()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <ProductThumbnail imageId={info.first_uploaded_image} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {info.product_name || 'Unnamed product'}
            </h1>
            {info.is_competitor ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Competitor
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                Own product
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {identityLabel(info.division) && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                {info.division}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {scanCount} scan{scanCount === 1 ? '' : 's'} recorded
            </span>
            {/* Always-visible LIMS link shortcut in the header (targets latest scan) */}
            {productDataId && (
              <button
                type="button"
                onClick={handleOpenLimsModalForLatest}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700"
              >
                <LinkIcon className="h-3 w-3" />
                {latestScan?.lims_sc_value ? 'Replace LIMS sample' : 'Link LIMS sample'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-md px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-b-2 border-slate-800 text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && latest && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Identification
            </h3>
            <dl className="space-y-4">
              <FieldValue
                label="Category"
                value={identity?.product_category?.value}
                confidence={identity?.product_category?.confidence}
              />
              <FieldValue
                label="Subcategory"
                value={identity?.product_subcategory?.value}
                confidence={identity?.product_subcategory?.confidence}
              />
              <FieldValue
                label="Package type"
                value={identity?.package_type?.value}
                confidence={identity?.package_type?.confidence}
              />
              <FieldValue
                label="Barcode"
                value={identifiers?.barcode}
                mono
              />
            </dl>
            <ChipList
              label="Front claims"
              items={latest.packaging_claims?.front_package_claims}
            />
            <ChipList
              label="Back claims"
              items={latest.packaging_claims?.back_package_claims}
            />
            <ChipList label="Ingredients" items={latest.ingredients_information?.ingredients} />
            <ChipList
              label="Certifications"
              items={latest.packaging_claims?.certifications}
            />
          </div>

          {/* Right column */}
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Nutrition
              </h3>
              <NutritionTable productData={latest} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Manufacturer
              </h3>
              <dl className="space-y-4">
                <FieldValue
                  label="Name"
                  value={latest.manufacturer_information?.manufacturer_name?.value}
                  confidence={
                    latest.manufacturer_information?.manufacturer_name?.confidence
                  }
                />
                <FieldValue
                  label="Address"
                  value={latest.manufacturer_information?.manufacturer_address?.value}
                  confidence={
                    latest.manufacturer_information?.manufacturer_address?.confidence
                  }
                />
                <FieldValue
                  label="Country of origin"
                  value={latest.manufacturer_information?.country_of_origin?.value}
                  confidence={
                    latest.manufacturer_information?.country_of_origin?.confidence
                  }
                />
                <ChipList
                  label="Manufacturing units"
                  items={latest.manufacturer_information?.manufacturing_units}
                />
              </dl>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Manufacturing &amp; pricing
              </h3>
              <dl className="space-y-4">
                <FieldValue
                  label="Manufacturing date"
                  value={mfg?.date_of_manufacturing?.value}
                  confidence={mfg?.date_of_manufacturing?.confidence}
                  mono
                />
                <FieldValue
                  label="Expiry date"
                  value={mfg?.expiry_date?.value}
                  confidence={mfg?.expiry_date?.confidence}
                  mono
                />
                <FieldValue
                  label="Best before"
                  value={mfg?.best_before?.value}
                  confidence={mfg?.best_before?.confidence}
                  mono
                />
                <FieldValue
                  label="Batch number"
                  value={mfg?.batch_number?.value}
                  confidence={mfg?.batch_number?.confidence}
                  mono
                />
                <FieldValue
                  label="MRP"
                  value={pricing?.mrp?.value}
                  confidence={pricing?.mrp?.confidence}
                />
              </dl>
            </div>
          </div>
        </div>
      )}

      {tab === 'details' && !latest && (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10" />}
          title="No scan data"
          message="This product has no recent scan data to display."
        />
      )}

      {tab === 'lims' && (
        <div className="space-y-3">
          {/* Always-visible Link / Replace button at the top of the LIMS tab */}
          {productDataId && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleOpenLimsModalForLatest}
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-600 bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
              >
                <LinkIcon className="h-4 w-4" />
                {latestScan?.lims_sc_value ? 'Replace LIMS sample' : 'Link LIMS sample'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {latestScan?.lims_sc_value && limsResults ? (
              <LimsPanel limsResults={limsResults} />
            ) : (
              <EmptyState
                icon={<FlaskConical className="h-10 w-10" />}
                title="No LIMS sample linked"
                message="Link a LIMS sample to this latest scan to view its lab results."
                action={
                  productDataId ? (
                    <button
                      type="button"
                      onClick={handleOpenLimsModalForLatest}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-600 bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Link a LIMS sample
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <Timeline
          entries={history}
          productId={info._id}
          onLinkLims={(pdId, currentSc) => handleOpenLimsModal(pdId, currentSc)}
        />
      )}

      {limsModalOpen && limsModalTarget && (
        <LimsSearchModal
          productId={info._id}
          productDataId={limsModalTarget.productDataId}
          defaultQuery={limsModalQuery}
          business={info.business}
          division={info.division}
          onClose={handleLimsClose}
          onAttached={handleLimsAttached}
        />
      )}
    </div>
  )
}
