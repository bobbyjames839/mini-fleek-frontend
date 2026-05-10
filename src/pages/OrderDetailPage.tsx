import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { ApiError } from '../lib/api/client'
import { getOrder, type Order } from '../lib/api/orders'
import { formatGBP } from '../lib/money'
import { useAppSelector } from '../store/hooks'

const STATUS_COPY: Record<Order['status'], { label: string; className: string }> = {
  placed: {
    label: 'Order placed',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  shipped: {
    label: 'Shipped',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
})

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))
  const justPlaced = Boolean((location.state as { justPlaced?: boolean } | null)?.justPlaced)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)

  const handleAuthError = useCallback(() => {
    navigate('/login', { state: { from: `/orders/${id ?? ''}` } })
  }, [navigate, id])

  useEffect(() => {
    if (!isAuthed) {
      handleAuthError()
      return
    }
    if (!id) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setStatus(null)

    getOrder(id, controller.signal)
      .then((res) => setOrder(res.order))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          handleAuthError()
          return
        }
        setOrder(null)
        if (err instanceof ApiError) {
          setStatus(err.status)
          setError(err.message)
        } else {
          setError('Could not load this order.')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [id, isAuthed, handleAuthError])

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />

      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8 md:py-12 lg:px-10">
        {loading ? (
          <OrderSkeleton />
        ) : error || !order ? (
          <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5">
            <p className="text-base font-semibold text-fleek-text">
              {status === 404
                ? 'We couldn’t find that order.'
                : status === 403
                  ? 'This order belongs to a different account.'
                  : error || 'Could not load this order.'}
            </p>
            <Link
              to="/products"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-fleek-primary-dark"
            >
              Back to bundles
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            <Reveal as="section" className="mb-8 md:mb-10">
              {justPlaced ? (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                  ✓ Order confirmed
                </p>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                  Order
                </p>
              )}
              <h1 className="mt-1 text-3xl font-semibold text-fleek-text md:text-4xl">
                {justPlaced ? 'Thanks — your order is in.' : `Order #${shortId(order.id)}`}
              </h1>
              <p className="mt-2 text-sm text-fleek-muted">
                {justPlaced
                  ? `We’ve placed your order and notified the vendor${order.items.length > 1 ? 's' : ''}. A copy of this page lives at /orders/${order.id} — bookmark it.`
                  : `Placed on ${dateFormatter.format(new Date(order.created_at))}.`}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 font-semibold uppercase tracking-[0.1em] ${STATUS_COPY[order.status].className}`}
                >
                  {STATUS_COPY[order.status].label}
                </span>
                <span className="font-mono uppercase tracking-[0.12em] text-fleek-muted">
                  ID · {order.id}
                </span>
              </div>
            </Reveal>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
              <section className="space-y-6">
                <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-8">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                    {order.items.length} {order.items.length === 1 ? 'bundle' : 'bundles'}
                  </h2>

                  <ul className="mt-5 space-y-4">
                    {order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-4 border-t border-fleek-border/70 pt-4 first:border-t-0 first:pt-0 md:flex-row md:items-start"
                      >
                        <Link
                          to={`/product/${item.product_id}`}
                          className="relative aspect-[4/3] w-full flex-none overflow-hidden rounded-2xl border border-fleek-border bg-fleek-bg md:h-28 md:w-40"
                        >
                          {item.primary_photo ? (
                            <img
                              src={item.primary_photo}
                              alt={item.product_name}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.14em] text-fleek-muted">
                              No photo
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fleek-primary">
                            {item.vendor_name}
                          </p>
                          <h3 className="mt-1 text-base font-semibold leading-snug text-fleek-text md:text-lg">
                            <Link
                              to={`/product/${item.product_id}`}
                              className="transition hover:text-fleek-primary"
                            >
                              {item.product_name}
                            </Link>
                          </h3>
                          <p className="mt-1 text-xs text-fleek-muted">
                            {item.piece_count} pieces · {item.quantity}{' '}
                            {item.quantity === 1 ? 'bundle' : 'bundles'}
                          </p>
                          <p className="mt-2 text-xs text-fleek-muted">
                            {formatGBP(item.unit_price, { precision: 0 })} per bundle
                          </p>
                        </div>

                        <p className="text-right text-base font-semibold text-fleek-text md:min-w-[6rem]">
                          {formatGBP(item.line_total, { precision: 0 })}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-8">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                    Shipping address
                  </h2>
                  <address className="mt-4 not-italic text-sm leading-relaxed text-fleek-text">
                    <p className="font-semibold">{order.shipping_address.full_name}</p>
                    <p className="text-fleek-muted">{order.shipping_address.line1}</p>
                    {order.shipping_address.line2 ? (
                      <p className="text-fleek-muted">{order.shipping_address.line2}</p>
                    ) : null}
                    <p className="text-fleek-muted">
                      {order.shipping_address.city}, {order.shipping_address.postcode}
                    </p>
                    <p className="text-fleek-muted">{order.shipping_address.country}</p>
                  </address>
                </article>
              </section>

              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                    Summary
                  </h2>

                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex items-baseline justify-between">
                      <dt className="text-fleek-muted">Subtotal</dt>
                      <dd className="font-semibold text-fleek-text">
                        {formatGBP(order.subtotal, { precision: 0 })}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-fleek-muted">Shipping</dt>
                      <dd className="text-fleek-muted">Free demo shipping</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex items-baseline justify-between border-t border-fleek-border/70 pt-4">
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                      Total
                    </span>
                    <span className="text-2xl font-semibold text-fleek-text">
                      {formatGBP(order.total, { precision: 0 })}
                    </span>
                  </div>

                  <Link
                    to="/products"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-fleek-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg"
                  >
                    Keep browsing
                    <span aria-hidden="true">→</span>
                  </Link>

                  <ul className="mt-5 space-y-2 border-t border-fleek-border/70 pt-4 text-xs text-fleek-muted">
                    <li className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-fleek-primary">✓</span>
                      Buyer protection on grading and missing pieces
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-fleek-primary">✓</span>
                      We’ll email you when each vendor ships
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

function shortId(id: string) {
  return id.split('-')[0]?.toUpperCase() ?? id.slice(0, 8).toUpperCase()
}

function OrderSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded-full bg-white/60" />
        <div className="h-9 w-80 animate-pulse rounded-full bg-white/60" />
        <div className="h-4 w-64 animate-pulse rounded-full bg-white/60" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
        <div className="space-y-4">
          <div className="h-72 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
          <div className="h-44 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
        </div>
        <div className="h-80 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
      </div>
    </div>
  )
}
