import { apiFetch } from './client'

// Mirrors backend/API_CONTRACT.md: GET /reviews
//
// Site-wide testimonials about Fleek as a whole — not tied to a product.
// Returned newest-first with a summary block (count + average rating).

export interface Review {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  created_at: string
}

export interface ReviewSummary {
  count: number
  average_rating: number | null
}

export interface ReviewsResponse {
  reviews: Review[]
  summary: ReviewSummary
}

// Cached + in-flight dedup. The home page fires `getReviews` on mount, and
// React 18 StrictMode double-invokes effects in dev — without dedup, that
// produces two GETs where the first gets aborted by its own cleanup. Per-caller
// AbortSignals only reject that caller's promise; the shared request survives.
let cached: ReviewsResponse | null = null
let inflight: Promise<ReviewsResponse> | null = null

export function getReviews(
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<ReviewsResponse> {
  if (!options.force && cached) {
    return Promise.resolve(cached)
  }

  if (!inflight) {
    inflight = apiFetch<ReviewsResponse>('/reviews')
      .then((res) => {
        cached = res
        return res
      })
      .finally(() => {
        inflight = null
      })
  }
  const shared = inflight

  if (!signal) return shared

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
    shared.then(
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
