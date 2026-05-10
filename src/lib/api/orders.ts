import { apiFetch } from './client'
import { clearCartCache } from './cart'
import { store } from '../../store'

export interface ShippingAddress {
  full_name: string
  line1: string
  line2: string | null
  city: string
  postcode: string
  country: string
}

export interface OrderLineItem {
  id: string
  product_id: string
  product_name: string
  product_slug: string
  primary_photo: string | null
  vendor_name: string
  piece_count: number
  quantity: number
  unit_price: number
  line_total: number
}

export interface Order {
  id: string
  status: 'placed' | 'shipped' | 'cancelled'
  created_at: string
  shipping_address: ShippingAddress
  items: OrderLineItem[]
  subtotal: number
  total: number
}

// Per-id cache + in-flight dedup. Mirrors the `getProduct` pattern in
// products.ts so:
//   - Returning to an already-viewed order is instant (no network).
//   - React 18 StrictMode's double-invoke of effects doesn't cause the first
//     request to be aborted by its own cleanup.
//   - Two components mounting at once share a single request.
const orderCache = new Map<string, Order>()
const inflightOrders = new Map<string, Promise<{ order: Order }>>()

let cachedOrderList: { orders: OrderSummary[] } | null = null
let inflightOrderList: Promise<{ orders: OrderSummary[] }> | null = null

function clearOrderCaches() {
  orderCache.clear()
  inflightOrders.clear()
  cachedOrderList = null
  inflightOrderList = null
}

export async function placeOrder(shipping_address: ShippingAddress) {
  const res = await apiFetch<{ order: Order }>('/checkout', {
    method: 'POST',
    auth: true,
    json: { shipping_address },
  })
  // Server clears the cart on success; mirror that on the client.
  clearCartCache()
  // The new order belongs in the cache, and the cached list (if any) is now
  // stale. Seed the detail cache from the response, then drop the list cache.
  orderCache.set(res.order.id, res.order)
  cachedOrderList = null
  inflightOrderList = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fleek:cart-updated', {
        detail: { items: [], subtotal: 0, item_count: 0 },
      }),
    )
  }
  return res
}

export function getOrder(
  id: string,
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<{ order: Order }> {
  if (!options.force) {
    const cached = orderCache.get(id)
    if (cached) return Promise.resolve({ order: cached })
  }

  let shared = inflightOrders.get(id)
  if (!shared) {
    shared = apiFetch<{ order: Order }>(`/orders/${encodeURIComponent(id)}`, { auth: true })
      .then((res) => {
        orderCache.set(id, res.order)
        return res
      })
      .finally(() => {
        inflightOrders.delete(id)
      })
    inflightOrders.set(id, shared)
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

export interface OrderSummary {
  id: string
  status: Order['status']
  subtotal: number
  total: number
  item_count: number
  created_at: string
}

export function listOrders(
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<{ orders: OrderSummary[] }> {
  if (!options.force && cachedOrderList) {
    return Promise.resolve(cachedOrderList)
  }

  if (!inflightOrderList) {
    inflightOrderList = apiFetch<{ orders: OrderSummary[] }>('/orders', { auth: true })
      .then((res) => {
        cachedOrderList = res
        return res
      })
      .finally(() => {
        inflightOrderList = null
      })
  }
  const request = inflightOrderList

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

// Orders are scoped to the signed-in user, so ANY access-token change has
// to drop the caches — logout, login, switching accounts in the same tab,
// silent token rotation. Comparing against the previous token value catches
// account-switch (A → B) which a simple "token went null" check would miss.
let lastOrderToken: string | null = store.getState().auth.accessToken
store.subscribe(() => {
  const nextToken = store.getState().auth.accessToken
  if (nextToken === lastOrderToken) return
  lastOrderToken = nextToken
  clearOrderCaches()
})
