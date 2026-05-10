import { apiFetch } from './client'

export interface Category {
  id: string
  name: string
  slug: string
  image_url?: string | null
}

export function listCategories(signal?: AbortSignal) {
  return apiFetch<{ categories: Category[] }>('/categories', { signal })
}
