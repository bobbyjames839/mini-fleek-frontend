import { store } from '../../store'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000'

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
    const token = store.getState().auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers, body })
  const text = await response.text()
  const data = text ? safeJson(text) : null

  if (!response.ok) {
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
