import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { ProductCard } from '../components/ProductCard'
import { Reveal } from '../components/Reveal'
import { ApiError } from '../lib/api/client'
import {
  getProduct,
  type ProductDetail,
  type PercentRow,
} from '../lib/api/products'
import { addToCart } from '../lib/api/cart'
import { formatGBP } from '../lib/money'
import { useAppSelector } from '../store/hooks'

interface PercentRowsProps {
  rows: PercentRow[]
  labelKey: string
}

function PercentRows({ rows, labelKey }: PercentRowsProps) {
  return (
    <ul className="space-y-3">
      {rows.map((row, index) => {
        const label = String(row[labelKey] ?? '—')
        const pct = Number(row.pct ?? 0)
        return (
          <li key={`${label}-${index}`}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-fleek-text">{label}</span>
              <span className="text-fleek-muted">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-50">
              <div
                className="h-full rounded-full bg-fleek-primary"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))

  const catalogProducts = useAppSelector((state) => state.catalog.products)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartFeedback, setCartFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Fetch the product whenever the route id changes.
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setActivePhoto(0)
    setQuantity(1)
    setCartFeedback(null)

    getProduct(id, controller.signal)
      .then((res) => setProduct(res.product))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setProduct(null)
        if (err instanceof ApiError && err.status === 404) {
          setError('We couldn’t find that bundle. It may have sold out or been removed.')
        } else {
          setError(err instanceof ApiError ? err.message : 'Could not load the product.')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [id])

  // Other bundles from the same vendor — derived from the redux catalogue,
  // which was loaded once on app boot. No extra network request needed.
  const related = useMemo(() => {
    if (!product) return []
    return catalogProducts
      .filter((p) => p.vendor.slug === product.vendor.slug && p.id !== product.id)
      .slice(0, 4)
  }, [product, catalogProducts])

  const photos = product?.photos?.length ? product.photos : []
  const mainPhoto = photos[activePhoto] ?? photos[0]

  const isSoldOut = product?.status === 'sold_out'
  const lineTotal = useMemo(() => (product ? product.total_price * quantity : 0), [product, quantity])

  // While the URL id and loaded product diverge (the moment between clicking a
  // new product and the useEffect firing), keep showing the skeleton so the
  // user never sees stale content or an empty/not-found flash.
  const isStale = product !== null && product.id !== id
  const showSkeleton = loading || isStale || (!product && !error)

  async function handleAddToCart() {
    if (!product) return
    if (!isAuthed) {
      navigate('/login', { state: { from: `/product/${product.id}` } })
      return
    }
    setAddingToCart(true)
    setCartFeedback(null)
    try {
      await addToCart(product.id, quantity)
      setCartFeedback({
        kind: 'success',
        message: `Added ${quantity} × ${product.name} to your cart.`,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login', { state: { from: `/product/${product.id}` } })
        return
      }
      setCartFeedback({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not add to cart.',
      })
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />

      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12 lg:px-10">
        {showSkeleton ? (
          <DetailSkeleton />
        ) : error || !product ? (
          <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5">
            <p className="text-base font-semibold text-fleek-text">
              {error || 'Product not found.'}
            </p>
            <Link
              to="/products"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-fleek-primary-dark"
            >
              Browse all bundles
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            <nav className="mb-6 text-sm text-fleek-muted" aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link to="/" className="transition hover:text-fleek-primary">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link to="/products" className="transition hover:text-fleek-primary">
                    Bundles
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    to={`/products?category=${encodeURIComponent(product.category.slug)}`}
                    className="transition hover:text-fleek-primary"
                  >
                    {product.category.name}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="truncate font-medium text-fleek-text">{product.name}</li>
              </ol>
            </nav>

            {/* Hero: gallery + buy box */}
            <Reveal as="section" className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
              {/* Gallery */}
              <div className="space-y-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-fleek-border bg-fleek-bg shadow-sm shadow-amber-900/5">
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={product.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.14em] text-fleek-muted">
                      No photo provided
                    </div>
                  )}

                  {product.discount_pct ? (
                    <span className="absolute left-4 top-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-md shadow-emerald-900/20">
                      -{product.discount_pct}% off
                    </span>
                  ) : null}
                  {isSoldOut ? (
                    <span className="absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white">
                      Sold out
                    </span>
                  ) : null}

                  {photos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhoto((i) => (i - 1 + photos.length) % photos.length)
                        }
                        aria-label="Previous photo"
                        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-fleek-border bg-white/90 text-fleek-text shadow-md shadow-amber-900/15 backdrop-blur transition hover:-translate-y-1/2 hover:border-fleek-primary/60 hover:bg-white md:left-4 md:h-11 md:w-11"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 3l-5 5 5 5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePhoto((i) => (i + 1) % photos.length)}
                        aria-label="Next photo"
                        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-fleek-border bg-white/90 text-fleek-text shadow-md shadow-amber-900/15 backdrop-blur transition hover:-translate-y-1/2 hover:border-fleek-primary/60 hover:bg-white md:right-4 md:h-11 md:w-11"
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3l5 5-5 5" />
                        </svg>
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        {activePhoto + 1} / {photos.length}
                      </div>
                    </>
                  ) : null}
                </div>

                {photos.length > 1 ? (
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        onClick={() => setActivePhoto(index)}
                        aria-label={`Show photo ${index + 1}`}
                        className={`aspect-square overflow-hidden rounded-2xl border transition ${
                          activePhoto === index
                            ? 'border-fleek-primary ring-2 ring-fleek-primary/40'
                            : 'border-fleek-border hover:border-fleek-primary/40'
                        }`}
                      >
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Buy box */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-fleek-muted">
                    <Link
                      to={`/products?vendor=${encodeURIComponent(product.vendor.slug)}`}
                      className="text-fleek-primary transition hover:underline"
                    >
                      {product.vendor.name}
                    </Link>
                    <span aria-hidden="true">•</span>
                    <span>{product.vendor.country}</span>
                    {product.vendor.rating !== null ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>★ {product.vendor.rating.toFixed(1)}</span>
                      </>
                    ) : null}
                  </div>

                  <h1 className="mt-2 text-2xl font-semibold leading-tight text-fleek-text md:text-3xl">
                    {product.name}
                  </h1>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.grade ? (
                      <span className="rounded-full bg-fleek-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                        {product.grade}
                      </span>
                    ) : null}
                    {product.brand ? (
                      <span className="rounded-full border border-fleek-border bg-fleek-bg px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fleek-text">
                        {product.brand}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-fleek-border bg-fleek-bg px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-fleek-text">
                      {product.category.name}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-fleek-border bg-fleek-bg p-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-fleek-muted">
                        Bundle total
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <p className="text-2xl font-semibold text-fleek-text">
                          {formatGBP(product.total_price, { precision: 0 })}
                        </p>
                        {product.original_total_price ? (
                          <p className="text-sm text-fleek-muted line-through">
                            {formatGBP(product.original_total_price, { precision: 0 })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-fleek-muted">
                        Per piece
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-fleek-primary">
                        {formatGBP(product.price_per_piece)}
                      </p>
                      <p className="text-xs text-fleek-muted">{product.piece_count} pieces</p>
                    </div>
                  </div>

                  {/* Quantity stepper + Add to cart */}
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-fleek-text">Bundles</span>
                      <div className="flex items-center rounded-full border border-fleek-border bg-white">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={isSoldOut || quantity <= 1}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-fleek-text transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-fleek-text">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => q + 1)}
                          disabled={isSoldOut}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-fleek-text transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <span className="ml-auto text-sm font-semibold text-fleek-text">
                        {formatGBP(lineTotal, { precision: 0 })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isSoldOut || addingToCart}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-fleek-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                    >
                      {addingToCart ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Adding…
                        </>
                      ) : isSoldOut ? (
                        'Sold out'
                      ) : isAuthed ? (
                        <>
                          Add to cart
                          <span aria-hidden="true">→</span>
                        </>
                      ) : (
                        'Log in to add to cart'
                      )}
                    </button>

                    {cartFeedback ? (
                      <div
                        role={cartFeedback.kind === 'error' ? 'alert' : 'status'}
                        className={`rounded-2xl border px-3 py-2 text-sm ${
                          cartFeedback.kind === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {cartFeedback.kind === 'success' ? (
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true">✓</span>
                            {cartFeedback.message}{' '}
                            <Link to="/cart" className="font-semibold underline-offset-2 hover:underline">
                              View cart
                            </Link>
                          </span>
                        ) : (
                          cartFeedback.message
                        )}
                      </div>
                    ) : null}
                  </div>

                  <ul className="mt-5 space-y-2 border-t border-fleek-border/70 pt-4 text-xs text-fleek-muted">
                    <li className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-fleek-primary">✓</span>
                      Buyer protection on grading and missing pieces
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-fleek-primary">✓</span>
                      Ships direct from {product.vendor.country}
                    </li>
                    <li className="flex items-start gap-2">
                      <span aria-hidden="true" className="text-fleek-primary">✓</span>
                      Per-piece pricing locked at checkout
                    </li>
                  </ul>
                </div>
              </aside>
            </Reveal>

            {/* Vendor card */}
            <Reveal as="section" className="mt-12 md:mt-16">
              <article className="overflow-hidden rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-amber-50 text-base font-semibold text-fleek-primary">
                      {product.vendor.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                        Sold by
                      </p>
                      <h2 className="text-xl font-semibold text-fleek-text">{product.vendor.name}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-fleek-muted">
                        <span>{product.vendor.country}</span>
                        {product.vendor.rating !== null ? (
                          <>
                            <span aria-hidden="true">•</span>
                            <span>★ {product.vendor.rating.toFixed(1)}</span>
                          </>
                        ) : null}
                      </p>
                      {product.vendor.about ? (
                        <p className="mt-3 max-w-2xl text-sm text-fleek-muted">{product.vendor.about}</p>
                      ) : null}
                    </div>
                  </div>

                  <Link
                    to={`/products?vendor=${encodeURIComponent(product.vendor.slug)}`}
                    className="inline-flex items-center gap-1.5 self-start rounded-full border border-fleek-border bg-white px-4 py-2 text-sm font-semibold text-fleek-text transition hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:text-fleek-primary"
                  >
                    All bundles from this vendor
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            </Reveal>

            {/* Bundle details */}
            <Reveal as="section" className="mt-12 md:mt-16">
              <header className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                  Inside the bundle
                </p>
                <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                  Bundle details
                </h2>
              </header>

              <div className="grid gap-4 lg:grid-cols-3">
                {product.description ? (
                  <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 lg:col-span-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                      Description
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fleek-muted">
                      {product.description}
                    </p>
                  </article>
                ) : null}

                {product.grading_breakdown?.length ? (
                  <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                        Grading breakdown
                      </h3>
                      <GradingInfo />
                    </div>
                    <p className="mt-1 text-xs text-fleek-muted">
                      Distribution of grades inside the bundle.
                    </p>
                    <div className="mt-5">
                      <PercentRows rows={product.grading_breakdown} labelKey="grade" />
                    </div>
                  </article>
                ) : null}

                {product.brand_mix?.length ? (
                  <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                      Brand mix
                    </h3>
                    <p className="mt-1 text-xs text-fleek-muted">Headline brands you can expect.</p>
                    <div className="mt-5">
                      <PercentRows rows={product.brand_mix} labelKey="brand" />
                    </div>
                  </article>
                ) : null}

                {product.size_split?.length ? (
                  <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                      Size split
                    </h3>
                    <p className="mt-1 text-xs text-fleek-muted">
                      Approximate size distribution across the bundle.
                    </p>
                    <div className="mt-5">
                      <PercentRows rows={product.size_split} labelKey="size" />
                    </div>
                  </article>
                ) : null}
              </div>
            </Reveal>

            {/* More from vendor */}
            {related.length ? (
              <Reveal as="section" className="mt-12 md:mt-16">
                <header className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                      Same vendor
                    </p>
                    <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                      More from {product.vendor.name}
                    </h2>
                  </div>
                  <Link
                    to={`/products?vendor=${encodeURIComponent(product.vendor.slug)}`}
                    className="hidden text-sm font-semibold text-fleek-primary transition hover:underline md:inline-flex"
                  >
                    View vendor →
                  </Link>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {related.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </Reveal>
            ) : null}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

const GRADE_DEFINITIONS: { grade: string; summary: string }[] = [
  { grade: 'Grade A', summary: 'Excellent. Minimal to no visible wear. Resale-ready as-is.' },
  { grade: 'Grade B', summary: 'Good. Light wear, no major flaws. Standard secondhand stock.' },
  { grade: 'Grade C', summary: 'Fair. Visible wear or small flaws. Best for repair / upcycle.' },
]

function GradingInfo() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="What do these grades mean?"
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-fleek-border bg-white text-[11px] font-semibold text-fleek-muted transition hover:border-fleek-primary/60 hover:text-fleek-primary"
      >
        i
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute right-0 z-20 mt-2 w-72 origin-top-right rounded-2xl border border-fleek-border bg-white p-4 text-left shadow-xl shadow-amber-900/15"
        >
          <p className="text-sm font-semibold text-fleek-text">How grading works</p>
          <p className="mt-1 text-xs text-fleek-muted">
            Every bundle is hand-graded by the vendor and verified before listing.
          </p>
          <ul className="mt-3 space-y-2">
            {GRADE_DEFINITIONS.map((row) => (
              <li key={row.grade} className="text-xs">
                <span className="font-semibold text-fleek-text">{row.grade}</span>
                <span className="text-fleek-muted"> — {row.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-4 w-64 animate-pulse rounded-full bg-white/60" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
        <div className="aspect-[4/3] animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
        <div className="h-[28rem] animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
      </div>
    </div>
  )
}
