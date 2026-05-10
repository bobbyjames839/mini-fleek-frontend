import { apiFetch } from './client'

// Types mirror backend/API_CONTRACT.md. Money is integer pence.

export interface VendorRef {
  id: string
  name: string
  slug: string
}

export interface CategoryRef {
  id: string
  name: string
  slug: string
}

export type ProductStatus = 'active' | 'sold_out'

export interface ProductSummary {
  id: string
  name: string
  slug: string
  brand: string | null
  primary_photo: string | null
  piece_count: number
  total_price: number
  price_per_piece: number
  original_total_price: number | null
  discount_pct: number | null
  status: ProductStatus
  vendor: VendorRef
  category: CategoryRef
}

export interface VendorDetail extends VendorRef {
  country: string
  rating: number | null
  about?: string | null
}

export interface PercentRow {
  pct: number
  // Per the contract, breakdown rows are { grade | brand | size, pct }.
  // We allow any string key alongside `pct` for flexible rendering.
  [key: string]: string | number
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string | null
  brand: string | null
  photos: string[]
  piece_count: number
  total_price: number
  price_per_piece: number
  original_total_price: number | null
  discount_pct: number | null
  status: ProductStatus
  grade: string | null
  grading_breakdown: PercentRow[] | null
  brand_mix: PercentRow[] | null
  size_split: PercentRow[] | null
  vendor: VendorDetail
  category: CategoryRef
}

export interface ProductListResponse {
  products: ProductSummary[]
  total: number
  limit: number
  offset: number
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc'

export interface ProductListParams {
  category?: string | string[]
  vendor?: string | string[]
  q?: string
  sort?: ProductSort
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export function listProducts(params: ProductListParams = {}) {
  const { signal, category, vendor, ...rest } = params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  // Multi-value: comma-separated. The UI also filters client-side, so this
  // works even if the backend only honours a single slug per param.
  if (category) {
    const value = Array.isArray(category) ? category.filter(Boolean).join(',') : category
    if (value) query.set('category', value)
  }
  if (vendor) {
    const value = Array.isArray(vendor) ? vendor.filter(Boolean).join(',') : vendor
    if (value) query.set('vendor', value)
  }
  const qs = query.toString()
  return apiFetch<ProductListResponse>(`/products${qs ? `?${qs}` : ''}`, { signal })
}

// Per-id cache + in-flight dedup. The detail page fires `getProduct` on mount,
// and React 18 StrictMode double-invokes effects in dev — without this, the
// first request gets aborted by its own cleanup and surfaces as a failure.
// Caching also means returning to a previously-viewed product is instant.
const productCache = new Map<string, ProductDetail>()
const inflightProducts = new Map<string, Promise<{ product: ProductDetail }>>()

export function getProduct(
  id: string,
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<{ product: ProductDetail }> {
  if (!options.force) {
    const cached = productCache.get(id)
    if (cached) return Promise.resolve({ product: cached })
  }

  let shared = inflightProducts.get(id)
  if (!shared) {
    shared = apiFetch<{ product: ProductDetail }>(`/products/${encodeURIComponent(id)}`)
      .then((res) => {
        productCache.set(id, res.product)
        return res
      })
      .finally(() => {
        inflightProducts.delete(id)
      })
    inflightProducts.set(id, shared)
  }
  const request = shared

  if (!signal) return request

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort)
    request.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        if (!signal.aborted) resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        if (!signal.aborted) reject(err)
      },
    )
  })
}
