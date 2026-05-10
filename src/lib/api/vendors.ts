import { apiFetch } from './client'

export interface Vendor {
  id: string
  name: string
  slug: string
  country: string
  rating: number | null
  image_url?: string | null
}

export function listVendors(signal?: AbortSignal) {
  return apiFetch<{ vendors: Vendor[] }>('/vendors', { signal })
}
