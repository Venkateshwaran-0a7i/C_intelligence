// Typed API client for the GptModel FastAPI backend.
// Base URL from VITE_API_URL or VITE_API_BASE_URL, defaulting to http://localhost:8000.

import type {
  AttachLimsBody,
  ConfirmProductBody,
  ExtractResponse,
  HealthResponse,
  LimsAdminRow,
  LimsSearchResult,
  MatchResponse,
  PaginatedProducts,
  ProductDetailResponse,
  ProductHistoryResponse,
  ProductInfoDoc,
  ProductListFilters,
} from '../types'

function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }
  return 'http://localhost:8000'
}

const BASE_URL = getBaseUrl()

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, init)
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the backend at ${BASE_URL}. Is FastAPI running?`,
      null,
    )
  }

  if (!res.ok) {
    let detail: unknown = null
    let message = `Request failed with status ${res.status}`
    try {
      detail = await res.json()
      if (detail && typeof detail === 'object') {
        const d = detail as { detail?: unknown; message?: string }
        if (typeof d.detail === 'string') message = d.detail
        else if (typeof (d.detail as { message?: string })?.message === 'string') {
          message = (d.detail as { message: string }).message
        } else if (typeof d.message === 'string') {
          message = d.message
        }
      }
    } catch {
      // ignore JSON parse failure
    }
    throw new ApiError(res.status, message, detail)
  }

  return res.json() as Promise<T>
}

function toQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue
    sp.set(k, String(v))
  }
  return sp.toString()
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  getProducts: (filters: ProductListFilters = {}) => {
    const q = toQuery({ ...filters })
    return request<PaginatedProducts>(`/products${q ? `?${q}` : ''}`)
  },

  getProductDetail: (productId: string) =>
    request<ProductDetailResponse>(`/products/${encodeURIComponent(productId)}`),

  getProductHistory: (productId: string, expand = false) =>
    request<ProductHistoryResponse>(
      `/products/${encodeURIComponent(productId)}/history?expand=${expand}`,
    ),

  matchProducts: (params: {
    product_name?: string
    brand?: string
    variant?: string
    net_quantity?: string
    barcode?: string
  }) => {
    const q = toQuery({ ...params })
    return request<MatchResponse>(`/products/match${q ? `?${q}` : ''}`)
  },

  confirmProduct: (body: ConfirmProductBody) =>
    request<ProductInfoDoc>('/products/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  // multipart/form-data — do NOT set Content-Type (browser sets the boundary)
  extract: (formData: FormData) =>
    request<ExtractResponse>('/extract', { method: 'POST', body: formData }),

  listLims: (limit = 1000) =>
    request<{ results: LimsSearchResult[]; count: number }>(
      `/lims/list?limit=${limit}`,
    ),

  getLimsAdmin: (limit = 2000) =>
    request<{ results: LimsAdminRow[]; count: number }>(
      `/lims/admin?limit=${limit}`,
    ),

  attachLims: (productDataId: string, body: AttachLimsBody) =>
    request<ProductInfoDoc>(
      `/product-data/${encodeURIComponent(productDataId)}/lims`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),

  getImageUrl: (imageId: string) => `${BASE_URL}/images/${encodeURIComponent(imageId)}`,
}

export default api
