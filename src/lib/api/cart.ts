import { apiFetch } from './client'
import { store } from '../../store'

export const CART_UPDATED_EVENT = 'fleek:cart-updated'
const CART_COUNT_KEY = 'fleek_cart_item_count'
const GUEST_CART_KEY = 'fleek_guest_cart'

function isAuthed(): boolean {
  return Boolean(store.getState().auth.accessToken)
}

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

// ---------- Guest cart (localStorage) ----------
//
// Lets unauthenticated visitors fill a cart locally. The cart page is fully
// usable for guests; only checkout requires sign-in. On login we merge the
// guest cart into the server cart via `mergeGuestCartIntoServer`.

interface GuestItem {
  // We use product.id as the line id so adding the same product twice merges.
  id: string
  product: CartLineProduct
  quantity: number
}

interface GuestCartShape {
  items: GuestItem[]
}

function readGuestCart(): GuestCartShape {
  if (typeof window === 'undefined') return { items: [] }
  const raw = window.localStorage.getItem(GUEST_CART_KEY)
  if (!raw) return { items: [] }
  try {
    const parsed = JSON.parse(raw) as GuestCartShape
    if (parsed && Array.isArray(parsed.items)) return parsed
  } catch {
    // fall through to empty
  }
  return { items: [] }
}

function writeGuestCart(next: GuestCartShape) {
  if (typeof window === 'undefined') return
  if (next.items.length === 0) window.localStorage.removeItem(GUEST_CART_KEY)
  else window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next))
}

function guestCartToCart(g: GuestCartShape): Cart {
  const items: CartItem[] = g.items.map((line) => {
    const unit_price = line.product.price_per_piece * line.product.piece_count
    return {
      id: line.id,
      product: line.product,
      quantity: line.quantity,
      unit_price,
      line_total: unit_price * line.quantity,
    }
  })
  return {
    items,
    subtotal: items.reduce((sum, i) => sum + i.line_total, 0),
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
  }
}

export function clearGuestCart() {
  writeGuestCart({ items: [] })
}

// Push every guest-cart line to the server, then drop the local copy. Called
// after a successful login so the user's pre-auth selections aren't lost.
// Lines are POSTed in parallel — they're independent inserts, so the previous
// serial loop was N round-trips of pure wait. `allSettled` keeps the
// best-effort semantics: a stale product 404 doesn't abort the rest.
export async function mergeGuestCartIntoServer(): Promise<void> {
  const guest = readGuestCart()
  if (guest.items.length === 0) return
  await Promise.allSettled(
    guest.items.map((line) =>
      apiFetch<{ cart: Cart }>('/cart/items', {
        method: 'POST',
        auth: true,
        json: { product_id: line.product.id, quantity: line.quantity },
      }),
    ),
  )
  clearGuestCart()
  // Force a refresh so callers see the merged server state.
  cachedCart = null
  try {
    await getCart(undefined, { force: true })
  } catch {
    // ignore — broadcast will fire if it succeeds
  }
}

export async function addToCart(
  productId: string,
  quantity = 1,
  productSnapshot?: CartLineProduct,
) {
  if (!isAuthed()) {
    if (!productSnapshot) {
      throw new Error('Product details required to add to a guest cart.')
    }
    const guest = readGuestCart()
    const existing = guest.items.find((line) => line.id === productId)
    if (existing) existing.quantity += quantity
    else guest.items.push({ id: productId, product: productSnapshot, quantity })
    writeGuestCart(guest)
    const cart = guestCartToCart(guest)
    broadcastCart(cart)
    return { cart }
  }

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
  if (!isAuthed()) {
    const cart = guestCartToCart(readGuestCart())
    broadcastCart(cart)
    return Promise.resolve({ cart })
  }

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
  if (!isAuthed()) {
    const guest = readGuestCart()
    const line = guest.items.find((l) => l.id === itemId)
    if (line) line.quantity = quantity
    writeGuestCart(guest)
    const cart = guestCartToCart(guest)
    broadcastCart(cart)
    return { cart }
  }
  const res = await apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, {
    method: 'PATCH',
    auth: true,
    json: { quantity },
  })
  broadcastCart(res.cart)
  return res
}

export async function removeCartItem(itemId: string) {
  if (!isAuthed()) {
    const guest = readGuestCart()
    guest.items = guest.items.filter((l) => l.id !== itemId)
    writeGuestCart(guest)
    const cart = guestCartToCart(guest)
    broadcastCart(cart)
    return { cart }
  }
  const res = await apiFetch<{ cart: Cart }>(`/cart/items/${itemId}`, {
    method: 'DELETE',
    auth: true,
  })
  broadcastCart(res.cart)
  return res
}

// The cart is scoped to the signed-in user, so any access-token change
// (logout, login, switch-account, silent token rotation) must invalidate the
// in-memory cache and pull a fresh server cart. Without this, switching from
// account A to account B in the same tab would render A's cart and counts
// until the user manually refreshed.
let lastCartToken: string | null = store.getState().auth.accessToken
store.subscribe(() => {
  const nextToken = store.getState().auth.accessToken
  if (nextToken === lastCartToken) return
  lastCartToken = nextToken
  clearCartCache()
  if (nextToken) {
    // Authed → pull the new user's cart and broadcast so the badge updates.
    getCart(undefined, { force: true }).catch(() => {})
  } else {
    // Logged out → fall back to whatever's in the guest cart (usually empty)
    // and broadcast so listeners reset.
    broadcastCart(guestCartToCart(readGuestCart()))
  }
})
