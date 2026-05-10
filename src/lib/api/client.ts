import { store } from '../../store'
import { clearCredentials } from '../../store/authSlice'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000'

// Treat the token as dead 30s before its real expiry to avoid races against
// server clocks and in-flight requests.
const EXPIRY_GRACE_SECONDS = 30

function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false
  return Math.floor(Date.now() / 1000) >= expiresAt - EXPIRY_GRACE_SECONDS
}

export class ApiError extends Error {
  status: number
  details?: string[]
  constructor(status: number, message: string, details?: string[]) {
    super(message)
    this.status = status
    this.details = details
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean
  json?: unknown
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth, json, headers: initHeaders, ...rest } = options
  const headers = new Headers(initHeaders)

  let body: BodyInit | undefined
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  if (auth) {
    const { accessToken, expiresAt } = store.getState().auth
    // Bail proactively if the persisted token is past its TTL — otherwise
    // every authed page (cart, orders, checkout) makes a doomed request and
    // bounces to login as if the user had been signed out, even though the
    // store still says they're signed in.
    if (accessToken && isTokenExpired(expiresAt)) {
      store.dispatch(clearCredentials())
      throw new ApiError(401, 'Your session has expired. Please log in again.')
    }
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers, body })
  const text = await response.text()
  const data = text ? safeJson(text) : null

  if (!response.ok) {
    // Server-side rejection of our token (expired/revoked) — clear the local
    // credentials so the UI flips to its logged-out state instead of looping
    // through redirects to /login while the store still claims authed.
    if (response.status === 401 && auth) {
      store.dispatch(clearCredentials())
    }
    const message =
      (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`) || 'Request failed'
    const details =
      data && typeof data === 'object' && 'details' in data && Array.isArray(data.details)
        ? (data.details as string[])
        : undefined
    throw new ApiError(response.status, message, details)
  }

  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
