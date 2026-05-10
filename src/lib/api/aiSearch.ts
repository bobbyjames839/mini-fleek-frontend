import { apiFetch } from './client'
import type { ProductSummary, ProductSort } from './products'

export interface ParsedSearchFilter {
  category_slug: string | null
  vendor_slug: string | null
  vendor_countries: string[]
  brand_contains: string | null
  grade: string | null
  free_text: string | null
  max_price_per_piece: number | null
  min_price_per_piece: number | null
  max_total_price: number | null
  min_total_price: number | null
  min_piece_count: number | null
  max_piece_count: number | null
  sort: ProductSort | 'price_per_piece_asc' | 'price_per_piece_desc'
}

export interface AiSearchResponse {
  query: string
  parsed: ParsedSearchFilter
  products: ProductSummary[]
  total: number
  limit: number
}

export function aiSearch(query: string, limit?: number, signal?: AbortSignal) {
  return apiFetch<AiSearchResponse>('/products/search', {
    method: 'POST',
    json: { query, ...(limit ? { limit } : {}) },
    signal,
  })
}
