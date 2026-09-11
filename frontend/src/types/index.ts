// TypeScript types mirroring the GptModel FastAPI backend responses.

export type Confidence = 'High' | 'Medium' | 'Low' | string

export interface ConfidenceField {
  value: string
  confidence?: Confidence
}

// ── GET /health ──────────────────────────────────────────────────────────────
export interface HealthResponse {
  status: string
  gateway_raw: string
  gateway_effective: string
  default_model: string
  api_key_set: boolean
  api_key_preview: string
}

// ── GET /products (list_products) ────────────────────────────────────────────
export interface ProductListItem {
  _id: string
  product_name: string
  brand: string
  variant: string
  net_quantity: string
  business: string
  division: string
  product_category: string
  is_competitor?: boolean
  first_uploaded_image?: string
  created_at: string
  scan_count: number
  latest_analyzed_at: string | null
}

export interface PaginatedProducts {
  total: number
  page: number
  page_size: number
  items: ProductListItem[]
}

export interface ProductListFilters {
  page?: number
  page_size?: number
  business?: string
  division?: string
  brand?: string
  product_category?: string
  is_competitor?: boolean
  date_from?: string
  date_to?: string
}

// ── GET /products/{id} (get_product_detail) ─────────────────────────────────
export interface ScanHistoryEntry {
  product_data_id: string
  analyzed_at: string
  lims_sc_value: string | null
  lims_confirmed_by: string | null
  product_match_confirmed_by: string
}

export interface ProductInfoDoc {
  _id: string
  product_name: string
  brand: string
  variant: string
  net_quantity: string
  business: string
  division: string
  product_category: string
  is_competitor?: boolean
  first_uploaded_image?: string
  created_at: string
  scan_history: ScanHistoryEntry[]
}

// ── product_data document (from prompt.py schema) ───────────────────────────
export interface ImageRef {
  filename: string
  content_type: string
  size: number
  gridfs_id: string
}

export interface ProductDataDoc {
  _id: string
  analyzed_at: string
  metadata: {
    model: string
    image_filenames: string[]
    source: string
    created_at: string
    images?: ImageRef[]
    detected_language?: string
    ocr_confidence?: string
    image_count?: number
  }
  product_identification: {
    product_name: ConfidenceField
    product_brand: ConfidenceField
    business: ConfidenceField
    division: ConfidenceField
    product_category: ConfidenceField
    product_subcategory?: ConfidenceField
    product_variant: ConfidenceField
    sku: ConfidenceField
    sku_pack?: ConfidenceField
    package_type: ConfidenceField
    package_contents: string[]
    grammage: ConfidenceField
    net_quantity: ConfidenceField
  }
  packaging_claims: {
    front_package_claims: string[]
    back_package_claims: string[]
    certifications: string[]
  }
  ingredients_information: {
    ingredients: string[]
    active_ingredients: string[]
    allergens: string[]
    preservatives: string[]
    artificial_additives: string[]
  }
  nutrition_information: Record<string, unknown>
  manufacturer_information: {
    manufacturer_name: ConfidenceField
    manufacturer_address: ConfidenceField
    manufacturing_units: string[]
    marketer_name: ConfidenceField
    packer_name: ConfidenceField
    customer_care: { phone: string; email: string; website: string }
    country_of_origin: ConfidenceField
  }
  manufacturing_information: {
    date_of_manufacturing: ConfidenceField
    packed_date: ConfidenceField
    best_before: ConfidenceField
    expiry_date: ConfidenceField
    batch_number: ConfidenceField
    lot_number: ConfidenceField
  }
  pricing_information: {
    mrp: { value: string; currency: string; confidence: string }
  }
  product_usage: {
    usage_instructions: string
    storage_instructions: string
    preparation_instructions: string
    warnings: string[]
    caution: string[]
  }
  product_identifiers: {
    barcode: string
    qr_code: string
    product_code: string
  }
  ai_generated_information?: {
    product_summary: string
    experience?: string
    key_benefits?: string[]
    target_problems?: string[]
    unique_selling_points?: string[]
    health_score?: string
    ingredient_match_percentage?: string
    competitive_advantages?: string[]
    missing_ingredients?: string[]
    unique_claims?: string[]
  }
}

export interface ProductDetailResponse {
  product_info: ProductInfoDoc
  latest_product_data: ProductDataDoc | null
  lims_results: LimsResults | null
}

// ── GET /products/{id}/history?expand=true ──────────────────────────────────
export interface ExpandedHistoryEntry extends ScanHistoryEntry {
  product_data?: ProductDataDoc | null
  lims_results?: LimsResults | null
}

export interface ProductHistoryResponse {
  product_id: string
  expand: boolean
  history: ExpandedHistoryEntry[]
}

// ── LIMS ────────────────────────────────────────────────────────────────────
export interface LimsSearchResult {
  sc: string
  sc_value: string
  description: string
  sampling_date: string
}

export interface LimsPAAnalysis {
  _id?: string
  sc?: string
  pg?: string
  [key: string]: unknown
}

export interface LimsParameterGroup {
  _id?: string
  sc?: string
  pg?: string
  PG_NAME?: string
  analyses: LimsPAAnalysis[]
  [key: string]: unknown
}

export interface LimsResults {
  sample: Record<string, unknown>
  parameter_groups: LimsParameterGroup[]
}

// ── GET /products/match ─────────────────────────────────────────────────────
export interface MatchCandidate {
  product_id: string
  product_name: string
  brand: string
  variant: string
  net_quantity: string
  score: number
}

export interface MatchResponse {
  candidates: MatchCandidate[]
  count: number
}

// ── POST /extract ───────────────────────────────────────────────────────────
export interface ExtractResponse {
  extracted_json: ProductDataDoc
  product_data_id?: string
  analyzed_at?: string
  image_ids?: string[]
}

// ── POST /products/confirm ──────────────────────────────────────────────────
export interface ConfirmProductBody {
  product_data_id: string
  action: 'link' | 'create_new'
  product_id?: string
  confirmed_by: string
}

// ── POST /product-data/{id}/lims ────────────────────────────────────────────
export interface AttachLimsBody {
  product_id: string
  lims_sc_value: string
  confirmed_by: string
}

// ── Nutrition helper — the nutrition_information object is flexible but we
//    render the "approx_values_per_serve" table when present. ────────────────
export interface NutritionRow {
  nutrient: string
  per_serving: string
  per_100g: string
  unit: string
}
