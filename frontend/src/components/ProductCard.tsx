import { Link } from 'react-router-dom'
import { Box } from 'lucide-react'
import type { ProductListItem } from '../types'
import { timeAgo, formatDate } from '../lib/format'
import api from '../lib/api'

function OwnBadge({ isCompetitor }: { isCompetitor?: boolean | null }) {
  if (isCompetitor === null || isCompetitor === undefined) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        Unclassified
      </span>
    )
  }
  if (isCompetitor) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        Competitor
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
      Own product
    </span>
  )
}

function ProductThumbnail({ imageId }: { imageId?: string }) {
  if (!imageId) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
        <Box className="h-8 w-8" />
      </div>
    )
  }
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <img
        src={api.getImageUrl(imageId)}
        alt="Product"
        className="h-full w-full object-cover"
        onError={(e) => {
          // Replace broken img with fallback placeholder icon
          const wrapper = e.currentTarget.closest('div')
          if (wrapper) {
            wrapper.innerHTML =
              '<div class="flex h-full w-full items-center justify-center text-slate-400">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
              '</div>'
          }
        }}
      />
    </div>
  )
}

export { ProductThumbnail }

export default function ProductCard({ product }: { product: ProductListItem }) {
  const subtitle = [product.brand, product.variant, product.net_quantity]
    .filter((s) => s && s.trim() !== '' && s !== 'Not Available')
    .join(' · ')

  return (
    <Link
      to={`/products/${product._id}`}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <ProductThumbnail imageId={product.first_uploaded_image} size={16} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {product.product_name || 'Unnamed product'}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
          {product.division && product.division !== 'Not Available' && (
            <span className="mt-1.5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              {product.division}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <OwnBadge isCompetitor={product.is_competitor} />
        <span className="text-xs text-slate-500">
          {product.scan_count} scan{product.scan_count === 1 ? '' : 's'}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-slate-400" title={formatDate(product.latest_analyzed_at)}>
        Analyzed {timeAgo(product.latest_analyzed_at)}
      </p>
    </Link>
  )
}
