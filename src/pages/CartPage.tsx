import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { ApiError } from '../lib/api/client'
import {
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
  type CartItem,
} from '../lib/api/cart'
import { formatGBP } from '../lib/money'
import { useAppSelector } from '../store/hooks'

export function CartPage() {
  const navigate = useNavigate()
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))

  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleAuthError = useCallback(() => {
    navigate('/login', { state: { from: '/cart' } })
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getCart(controller.signal)
      .then((res) => setCart(res.cart))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          handleAuthError()
          return
        }
        setError(err instanceof ApiError ? err.message : 'Could not load your cart.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [isAuthed, handleAuthError])

  async function applyMutation(
    item: CartItem,
    mutator: () => Promise<{ cart: Cart }>,
  ) {
    setPendingItemId(item.id)
    setActionError(null)
    try {
      const res = await mutator()
      setCart(res.cart)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError()
        return
      }
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setPendingItemId(null)
    }
  }

  function changeQuantity(item: CartItem, next: number) {
    if (next < 1) return
    if (next === item.quantity) return
    applyMutation(item, () => updateCartItem(item.id, next))
  }

  function removeItem(item: CartItem) {
    applyMutation(item, () => removeCartItem(item.id))
  }

  const isEmpty = !loading && !error && (cart?.items.length ?? 0) === 0

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />

      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8 md:py-12 lg:px-10">
        <Reveal as="section" className="mb-8 md:mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
            Your bundles
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-fleek-text md:text-4xl">
            Shopping cart
          </h1>
          <p className="mt-2 text-sm text-fleek-muted">
            Review your bundles, adjust quantities, then head to checkout when you’re ready.
          </p>
        </Reveal>

        {loading ? (
          <CartSkeleton />
        ) : error ? (
          <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5">
            <p className="text-base font-semibold text-fleek-text">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-fleek-primary-dark"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyCart />
        ) : cart ? (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
            <section className="space-y-4">
              {actionError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {actionError}
                </div>
              ) : null}

              <ul className="space-y-4">
                {cart.items.map((item) => {
                  const isPending = pendingItemId === item.id
                  return (
                    <li
                      key={item.id}
                      className="overflow-hidden rounded-3xl border border-fleek-border bg-white p-4 shadow-sm shadow-amber-900/5 md:p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <Link
                          to={`/product/${item.product.id}`}
                          className="relative aspect-[4/3] w-full flex-none overflow-hidden rounded-2xl border border-fleek-border bg-fleek-bg md:h-32 md:w-44"
                        >
                          {item.product.primary_photo ? (
                            <img
                              src={item.product.primary_photo}
                              alt={item.product.name}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.14em] text-fleek-muted">
                              No photo
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-[0.12em] text-fleek-muted">
                            <Link
                              to={`/products?vendor=${encodeURIComponent(item.product.vendor.slug)}`}
                              className="text-fleek-primary transition hover:underline"
                            >
                              {item.product.vendor.name}
                            </Link>
                            <span aria-hidden="true">•</span>
                            <span>{item.product.piece_count} pieces</span>
                          </div>

                          <h2 className="mt-1 text-base font-semibold leading-snug text-fleek-text md:text-lg">
                            <Link
                              to={`/product/${item.product.id}`}
                              className="transition hover:text-fleek-primary"
                            >
                              {item.product.name}
                            </Link>
                          </h2>

                          <p className="mt-1 text-xs text-fleek-muted">
                            {formatGBP(item.product.price_per_piece)} per piece
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center rounded-full border border-fleek-border bg-white">
                              <button
                                type="button"
                                onClick={() => changeQuantity(item, item.quantity - 1)}
                                disabled={isPending || item.quantity <= 1}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-fleek-text transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="min-w-8 text-center text-sm font-semibold text-fleek-text">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => changeQuantity(item, item.quantity + 1)}
                                disabled={isPending}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-fleek-text transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              disabled={isPending}
                              className="text-sm font-semibold text-fleek-muted transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Remove
                            </button>

                            {isPending ? (
                              <span className="inline-flex items-center gap-2 text-xs text-fleek-muted">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-fleek-muted/40 border-t-fleek-primary" />
                                Updating…
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 text-right md:min-w-[8rem]">
                          <p className="text-lg font-semibold text-fleek-text">
                            {formatGBP(item.line_total, { precision: 0 })}
                          </p>
                          {item.quantity > 1 ? (
                            <p className="text-xs text-fleek-muted">
                              {formatGBP(item.unit_price, { precision: 0 })} × {item.quantity}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="pt-2">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-fleek-primary transition hover:underline"
                >
                  ← Continue browsing bundles
                </Link>
              </div>
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                  Order summary
                </h2>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fleek-muted">
                      Subtotal ({cart.item_count} {cart.item_count === 1 ? 'bundle' : 'bundles'})
                    </dt>
                    <dd className="font-semibold text-fleek-text">
                      {formatGBP(cart.subtotal, { precision: 0 })}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-fleek-muted">Shipping</dt>
                    <dd className="text-fleek-muted">Calculated at checkout</dd>
                  </div>
                </dl>

                <div className="mt-5 flex items-baseline justify-between border-t border-fleek-border/70 pt-4">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                    Estimated total
                  </span>
                  <span className="text-2xl font-semibold text-fleek-text">
                    {formatGBP(cart.subtotal, { precision: 0 })}
                  </span>
                </div>

                {isAuthed ? (
                  <Link
                    to="/checkout"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-fleek-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg"
                  >
                    Proceed to checkout
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      state={{ from: '/checkout' }}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-fleek-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg"
                    >
                      Log in to check out
                      <span aria-hidden="true">→</span>
                    </Link>
                    <p className="mt-3 text-center text-xs text-fleek-muted">
                      You need an account to place an order. Your cart will be kept.
                    </p>
                  </>
                )}

                <ul className="mt-5 space-y-2 border-t border-fleek-border/70 pt-4 text-xs text-fleek-muted">
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-fleek-primary">✓</span>
                    Buyer protection on every order
                  </li>
                  <li className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-fleek-primary">✓</span>
                    Per-piece pricing locked when you check out
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5 md:p-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-fleek-primary">
        ◫
      </div>
      <h2 className="mt-5 text-xl font-semibold text-fleek-text md:text-2xl">
        Your cart is empty
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fleek-muted">
        Browse the marketplace and add a bundle — graded vintage and secondhand stock from verified
        wholesalers, sold per-bundle with per-piece pricing.
      </p>
      <Link
        to="/products"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg"
      >
        Browse all bundles
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-3xl border border-fleek-border bg-white/60"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
    </div>
  )
}
