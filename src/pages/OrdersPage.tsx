import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { ApiError } from '../lib/api/client'
import { listOrders, type OrderSummary } from '../lib/api/orders'
import { formatGBP } from '../lib/money'
import { useAppSelector } from '../store/hooks'

const STATUS_COPY: Record<OrderSummary['status'], { label: string; className: string }> = {
  placed: {
    label: 'Placed',
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

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' })

export function OrdersPage() {
  const navigate = useNavigate()
  // Depend on the token value, not just the bool, so a same-tab account
  // switch (A → B) re-fires this effect with B's credentials.
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleAuthError = useCallback(() => {
    navigate('/login', { state: { from: '/orders' } })
  }, [navigate])

  useEffect(() => {
    if (!accessToken) {
      handleAuthError()
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setOrders(null)
    listOrders(controller.signal)
      .then((res) => setOrders(res.orders))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          handleAuthError()
          return
        }
        setError(err instanceof ApiError ? err.message : 'Could not load your orders.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [accessToken, handleAuthError])

  const isEmpty = !loading && !error && (orders?.length ?? 0) === 0

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
            Account
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-fleek-text md:text-4xl">Your orders</h1>
          <p className="mt-2 text-sm text-fleek-muted">
            Every bundle you’ve placed, newest first. Click an order to see line items, the
            shipping address, and totals.
          </p>
        </Reveal>

        {loading ? (
          <OrdersSkeleton />
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
          <EmptyOrders />
        ) : orders ? (
          <ul className="space-y-4">
            {orders.map((order) => {
              const status = STATUS_COPY[order.status]
              return (
                <li key={order.id}>
                  <Link
                    to={`/orders/${order.id}`}
                    className="flex flex-col gap-4 rounded-3xl border border-fleek-border bg-white p-5 shadow-sm shadow-amber-900/5 transition hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:shadow-md md:flex-row md:items-center md:p-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-[0.1em] ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span className="font-mono uppercase tracking-[0.12em] text-fleek-muted">
                          #{shortId(order.id)}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-semibold text-fleek-text md:text-lg">
                        {dateFormatter.format(new Date(order.created_at))}
                      </p>
                      <p className="text-xs text-fleek-muted">
                        {order.item_count} {order.item_count === 1 ? 'bundle' : 'bundles'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-fleek-muted">
                          Total
                        </p>
                        <p className="text-lg font-semibold text-fleek-text">
                          {formatGBP(order.total, { precision: 0 })}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="text-fleek-muted transition group-hover:text-fleek-primary"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}

function shortId(id: string) {
  return id.split('-')[0]?.toUpperCase() ?? id.slice(0, 8).toUpperCase()
}

function EmptyOrders() {
  return (
    <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5 md:p-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-fleek-primary">
        ⌖
      </div>
      <h2 className="mt-5 text-xl font-semibold text-fleek-text md:text-2xl">No orders yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fleek-muted">
        Once you place an order, you’ll find it here with line items, shipping details, and totals.
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

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-3xl border border-fleek-border bg-white/60"
        />
      ))}
    </div>
  )
}
