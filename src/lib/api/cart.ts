import { apiFetch } from './client'

export const CART_UPDATED_EVENT = 'fleek:cart-updated'
const CART_COUNT_KEY = 'fleek_cart_item_count'

// Cached outside the component tree so a remount of <MainMenu /> on route
// change can render the badge synchronously — without it, every page nav
// flickers the count to 0 until GET /cart resolves.
let cachedCartCount = readCachedCount()

function readCachedCount(): number {
  if (typeof window === 'undefined') return 0
  const raw = window.sessionStorage.getItem(CART_COUNT_KEY)
  const n = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function getCachedCartCount(): number {
  return cachedCartCount
}

export function setCachedCartCount(count: number) {
  cachedCartCount = count
  if (typeof window === 'undefined') return
  if (count > 0) window.sessionStorage.setItem(CART_COUNT_KEY, String(count))
  else window.sessionStorage.removeItem(CART_COUNT_KEY)
}

// Full cart, cached across MainMenu remounts so navigating between pages does
// not fire GET /cart every time. Mutations keep this in sync via broadcastCart.
let cachedCart: Cart | null = null
let inflightGetCart: Promise<{ cart: Cart }> | null = null

function broadcastCart(cart: Cart) {
  cachedCart = cart
  setCachedCartCount(cart.item_count)
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<Cart>(CART_UPDATED_EVENT, { detail: cart }))
}

export function clearCartCache() {
  cachedCart = null
  inflightGetCart = null
  setCachedCartCount(0)
}

export interface CartLineProduct {
  id: string
  name: string
  slug: string
  primary_photo: string | null
  piece_count: number
  price_per_piece: number
  vendor: { name: string; slug: string }
}

export interface CartItem {
  id: string
  product: CartLineProduct
  quantity: number
  unit_price: number
  line_total: number
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  item_count: number
}

export async function addToCart(productId: string, quantity = 1) {
  const res = await apiFetch<{ cart: Cart }>('/cart/items', {
    method: 'POST',
    auth: true,
    json: { product_id: productId, quantity },
  })
  broadcastCart(res.cart)
  return res
}

// Single source of truth for the cart on the client.
//
// 1. If we already have it cached, return it immediately — no network call.
//    This is the hot path for navigation between pages, where MainMenu
//    remounts on every route change and would otherwise re-fetch.
// 2. If a fetch is already in flight, share that promise so concurrent callers
//    (MainMenu + CartPage on /cart, plus React 18 StrictMode double-mounts)
//    coalesce onto one network request.
// 3. `force: true` bypasses the cache, e.g. for explicit refresh.
// 4. Per-caller AbortSignal only rejects that caller's promise; the shared
//    request keeps running so other callers still get their data.
export function getCart(
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<{ cart: Cart }> {
  if (!options.force && cachedCart) {
    return Promise.resolve({ cart: cachedCart })
  }

  if (!inflightGetCart) {
    inflightGetCart = apiFetch<{ cart: Cart }>('/cart', { auth: true })
      .then((res) => {
        broadcastCart(res.cart)
        return res
      })
      .finally(() => {
        inflightGetCart = null
      })
  }
  const shared = inflightGetCart

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

export async function updateCartItem(itemId: string, quantity: number) {
  const res = await apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, {
    method: 'PATCH',
    auth: true,
    json: { quantity },
  })
  broadcastCart(res.cart)
  return res
}

export async function removeCartItem(itemId: string) {
  const res = await apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, {
    method: 'DELETE',
    auth: true,
  })
  broadcastCart(res.cart)
  return res
}
