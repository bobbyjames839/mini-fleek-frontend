import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { useAppSelector } from '../store/hooks'
import { formatGBP } from '../lib/money'
import { getReviews, type Review } from '../lib/api/reviews'

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States',
  PK: 'Pakistan',
  IN: 'India',
  LV: 'Latvia',
  PL: 'Poland',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
}

function countryLabel(code: string) {
  return COUNTRY_NAMES[code] || code
}

const sourcingSteps = [
  {
    number: '01',
    title: 'Browse & filter',
    detail:
      'Discover bundles by category, brand, grade, and per-piece price across every verified vendor.',
  },
  {
    number: '02',
    title: 'Reserve your bundle',
    detail:
      'Add to cart with full pricing transparency — total, per-piece, and piece count are always visible pre-checkout.',
  },
  {
    number: '03',
    title: 'Ship & receive',
    detail:
      'Vendors dispatch direct to your address. Buyer protection covers condition, grading, and missing pieces.',
  },
]

export function HomePage() {
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))
  const allProducts = useAppSelector((state) => state.catalog.products)
  const categories = useAppSelector((state) => state.catalog.categories)
  const vendors = useAppSelector((state) => state.catalog.vendors)
  const featuredProducts = allProducts.slice(0, 3)
  const homeCategories = categories.slice(0, 4)

  // Bundles per vendor, derived from the catalogue.
  const bundlesByVendor = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allProducts) {
      map.set(p.vendor.slug, (map.get(p.vendor.slug) ?? 0) + 1)
    }
    return map
  }, [allProducts])

  // Top categories per vendor, used as real tags on the featured vendor card.
  const categoriesByVendor = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const p of allProducts) {
      const inner = map.get(p.vendor.slug) ?? new Map<string, number>()
      inner.set(p.category.name, (inner.get(p.category.name) ?? 0) + 1)
      map.set(p.vendor.slug, inner)
    }
    const result = new Map<string, string[]>()
    for (const [slug, counts] of map) {
      result.set(
        slug,
        Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name),
      )
    }
    return result
  }, [allProducts])

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => {
      const ra = a.rating ?? 0
      const rb = b.rating ?? 0
      if (rb !== ra) return rb - ra
      return (bundlesByVendor.get(b.slug) ?? 0) - (bundlesByVendor.get(a.slug) ?? 0)
    })
  }, [vendors, bundlesByVendor])

  const featuredVendor = sortedVendors[0] ?? null
  const supportingVendors = sortedVendors.slice(1, 4)

  const sourceCountries = useMemo(
    () => new Set(vendors.map((v) => v.country)).size,
    [vendors],
  )

  const heroStats = [
    { value: allProducts.length.toLocaleString(), label: 'Active bundles' },
    { value: vendors.length.toLocaleString(), label: 'Verified vendors' },
    { value: sourceCountries.toLocaleString(), label: 'Source countries' },
  ]

  // Real brand list, derived from product.brand. Loops twice for the marquee.
  const partnerBrands = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const p of allProducts) {
      const b = p.brand?.trim()
      if (!b || seen.has(b)) continue
      seen.add(b)
      out.push(b)
    }
    return out
  }, [allProducts])
  const brandLoop = partnerBrands.length ? [...partnerBrands, ...partnerBrands] : []

  // One-shot fetch of every review (mirrors the `GET /products` "fetch once,
  // filter in browser" pattern). We pick the three strongest to feature.
  const [allReviews, setAllReviews] = useState<Review[]>([])
  const [reviewSummary, setReviewSummary] = useState<{ count: number; average: number | null }>({
    count: 0,
    average: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    getReviews(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setAllReviews(res.reviews)
        setReviewSummary({
          count: res.summary.count,
          average: res.summary.average_rating,
        })
      })
      .catch(() => {
        // Silent — section hides when there are no reviews to show.
      })
    return () => controller.abort()
  }, [])

  const featuredReviews = useMemo(() => {
    return [...allReviews]
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating
        const aTitle = a.title ? 1 : 0
        const bTitle = b.title ? 1 : 0
        if (bTitle !== aTitle) return bTitle - aTitle
        return b.body.length - a.body.length
      })
      .slice(0, 3)
  }, [allReviews])

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[40rem] -right-40 h-[28rem] w-[28rem] rounded-full bg-amber-300/25 blur-3xl"
      />

      <SiteHeader />

      <main className="relative z-10 w-full pb-16 md:pb-24">
        {/* Hero — full bleed */}
        <section className="-mt-px">
          <div className="relative overflow-hidden bg-slate-950">
            <img
              src="https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=2200&q=80"
              alt="Vintage fashion rails in a wholesale showroom"
              className="h-[88vh] min-h-[600px] w-full object-cover opacity-90 md:h-[78vh] md:min-h-[520px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/50 to-transparent" />

            <div className="absolute inset-0 flex items-center pb-32 md:pb-20">
              <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-6 md:px-8 md:py-10 lg:px-10">
                <div className="max-w-2xl space-y-4 text-white fleek-fade-up md:space-y-5">
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 backdrop-blur sm:text-xs">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Wholesale marketplace · Live
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
                    Source graded vintage inventory from verified global vendors.
                  </h1>
                  <p className="max-w-xl text-sm text-slate-100/90 sm:text-base md:text-lg">
                    Built for buyers to discover, compare, and purchase bundle inventory across
                    trusted supply partners.
                  </p>

                  <div className="flex flex-wrap gap-2.5 pt-1 sm:gap-3">
                    <Link
                      to="/products"
                      className="inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-900/20 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-xl sm:px-5 sm:py-3"
                    >
                      Browse bundles
                      <span aria-hidden="true">→</span>
                    </Link>
                    <button
                      type="button"
                      className="rounded-full border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 sm:px-5 sm:py-3"
                    >
                      Contact sales
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-slate-950/55 backdrop-blur fleek-fade-in"
                 style={{ animationDelay: '200ms' }}
            >
              <div className="mx-auto grid w-full max-w-7xl grid-cols-3 divide-x divide-white/15 px-2 sm:px-4 md:px-8 lg:px-10">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-0.5 px-2 py-3 text-center text-white sm:px-4 sm:py-4"
                  >
                    <span className="text-base font-semibold sm:text-lg md:text-2xl">{stat.value}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-amber-100/80 sm:text-[11px] sm:tracking-[0.14em] md:text-xs">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl space-y-20 px-4 pt-20 md:space-y-28 md:px-8 lg:px-10">
        {/* Brand marquee */}
        <Reveal as="section" className="space-y-6">
          <div className="">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
              Trusted by resale teams
            </p>
            <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
              Brands buyers source on MiniFleek
            </h2>
          </div>

          {brandLoop.length ? (
            <div className="marquee-shell">
              <div
                className="marquee-track py-5"
                style={{ animationDuration: `${Math.max(20, partnerBrands.length * 3.5)}s` }}
              >
                {brandLoop.map((brand, index) => (
                  <span
                    key={`${brand}-${index}`}
                    className="marquee-item text-base font-semibold uppercase tracking-[0.18em] text-fleek-muted transition hover:text-fleek-text md:text-lg"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </Reveal>

        {/* Categories — circular nav */}
        <Reveal as="section" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                Start sourcing
              </p>
              <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                Shop by category
              </h2>
            </div>
            <Link
              to="/products"
              className="hidden text-sm font-semibold text-fleek-primary transition hover:underline md:inline-flex"
            >
              See all categories →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {homeCategories.map((category) => {
              const count = allProducts.filter((p) => p.category.slug === category.slug).length
              return (
                <Link
                  key={category.slug}
                  to={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-slate-900 shadow-sm shadow-amber-900/5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-900/15"
                >
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-50 text-3xl font-semibold text-fleek-primary">
                      {category.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 md:p-5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/80">
                        {count} {count === 1 ? 'bundle' : 'bundles'}
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold text-white md:text-xl">
                        {category.name}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/95 text-fleek-primary shadow-md shadow-amber-900/20 transition duration-300 group-hover:translate-x-0.5 group-hover:bg-fleek-primary group-hover:text-white"
                    >
                      →
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </Reveal>

        {/* How sourcing works */}
        <Reveal as="section">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
              How sourcing works
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-fleek-text md:text-3xl">
              From browse to delivery in three steps
            </h2>
            <p className="mt-3 text-sm text-fleek-muted">
              Per-piece pricing, transparent grading, and buyer protection on every order — no
              surprises between checkout and your warehouse door.
            </p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3">
            <div
              aria-hidden="true"
              className="absolute left-6 right-6 top-12 hidden h-px bg-gradient-to-r from-fleek-border via-fleek-primary/40 to-fleek-border md:block"
            />

            {sourcingSteps.map((step) => (
              <article
                key={step.number}
                className="relative flex flex-col gap-3 rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-900/10"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-fleek-primary text-sm font-semibold text-white shadow-md shadow-amber-900/20">
                    {step.number}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-muted"
                  >
                    Step
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-fleek-text">{step.title}</h3>
                <p className="text-sm text-fleek-muted">{step.detail}</p>
              </article>
            ))}
          </div>
        </Reveal>

        {/* Featured bundles */}
        <Reveal as="section" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                Hand-picked
              </p>
              <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                Featured bundles this week
              </h2>
            </div>
            <Link
              to="/products"
              className="hidden text-sm font-semibold text-fleek-primary transition hover:underline md:inline-flex"
            >
              View all bundles →
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-fleek-border bg-white shadow-sm shadow-amber-900/5 transition-colors duration-150 ease-out hover:border-fleek-primary/50"
              >
                <div className="relative overflow-hidden">
                  {product.primary_photo ? (
                    <img
                      src={product.primary_photo}
                      alt={product.name}
                      loading="lazy"
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 w-full items-center justify-center bg-fleek-bg text-xs uppercase tracking-[0.14em] text-fleek-muted">
                      No photo
                    </div>
                  )}
                  {product.discount_pct ? (
                    <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white shadow-md shadow-emerald-900/20">
                      -{product.discount_pct}%
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h3 className="text-lg font-semibold text-fleek-text transition-colors duration-150 group-hover:text-fleek-primary-dark">
                    {product.name}
                  </h3>

                  <div className="mt-auto flex items-baseline gap-2 pt-2">
                    <span className="text-xl font-semibold text-fleek-text">
                      {formatGBP(product.total_price, { precision: 0 })}
                    </span>
                    <span className="ml-auto text-xs text-fleek-muted">
                      {formatGBP(product.price_per_piece)}/pc
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>

        {/* Sourcing partners — asymmetric mosaic */}
        <Reveal as="section" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                Who you&apos;re buying from
              </p>
              <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                Sourcing partners
              </h2>
            </div>
            <Link
              to="/products"
              className="hidden text-sm font-semibold text-fleek-primary transition hover:underline md:inline-flex"
            >
              All vendors →
            </Link>
          </div>

          {featuredVendor ? (
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <article className="group relative overflow-hidden rounded-3xl border border-fleek-border bg-slate-950 shadow-sm shadow-amber-900/5 transition duration-300 hover:shadow-lg hover:shadow-amber-900/10">
                {featuredVendor.image_url ? (
                  <img
                    src={featuredVendor.image_url}
                    alt={featuredVendor.name}
                    className="h-72 w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 md:h-full md:min-h-[20rem]"
                  />
                ) : (
                  <div className="h-72 w-full bg-gradient-to-br from-slate-800 to-slate-950 md:h-full md:min-h-[20rem]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />

                <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fleek-primary shadow-sm">
                  <span aria-hidden="true">★</span>
                  Top-rated vendor
                </div>

                <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 text-white md:p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                    <span>{countryLabel(featuredVendor.country)}</span>
                    {featuredVendor.rating !== null ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>★ {featuredVendor.rating.toFixed(1)}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">•</span>
                    <span>
                      {bundlesByVendor.get(featuredVendor.slug) ?? 0}{' '}
                      {(bundlesByVendor.get(featuredVendor.slug) ?? 0) === 1 ? 'bundle' : 'bundles'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-semibold leading-tight md:text-3xl">
                    {featuredVendor.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    {(categoriesByVendor.get(featuredVendor.slug) ?? []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur"
                      >
                        {tag}
                      </span>
                    ))}
                    <Link
                      to={`/products?vendor=${encodeURIComponent(featuredVendor.slug)}`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-fleek-primary shadow-md shadow-amber-900/20 transition hover:-translate-y-0.5 hover:bg-amber-50"
                    >
                      View vendor
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </article>

              <div className="grid gap-3">
                {supportingVendors.map((vendor) => {
                  const count = bundlesByVendor.get(vendor.slug) ?? 0
                  const focus = (categoriesByVendor.get(vendor.slug) ?? []).slice(0, 2).join(' · ')
                  return (
                    <Link
                      key={vendor.slug}
                      to={`/products?vendor=${encodeURIComponent(vendor.slug)}`}
                      className="group flex items-center gap-4 rounded-2xl border border-fleek-border bg-white p-4 text-left shadow-sm shadow-amber-900/5 transition duration-200 hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:shadow-md"
                    >
                      {vendor.image_url ? (
                        <img
                          src={vendor.image_url}
                          alt={vendor.name}
                          className="h-12 w-12 flex-none rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-amber-50 text-base font-semibold text-fleek-primary">
                          {vendor.name
                            .split(' ')
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join('')}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-fleek-text">
                            {vendor.name}
                          </p>
                          {vendor.rating !== null ? (
                            <p className="flex-none text-xs font-semibold text-fleek-muted">
                              ★ {vendor.rating.toFixed(1)}
                            </p>
                          ) : null}
                        </div>
                        {focus ? (
                          <p className="truncate text-xs text-fleek-muted">{focus}</p>
                        ) : null}
                        <p className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-fleek-muted">
                          <span>{countryLabel(vendor.country)}</span>
                          <span aria-hidden="true">•</span>
                          <span>
                            {count} {count === 1 ? 'bundle' : 'bundles'}
                          </span>
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="text-fleek-muted opacity-0 transition group-hover:translate-x-1 group-hover:text-fleek-primary group-hover:opacity-100"
                      >
                        →
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
        </Reveal>

        {/* Reviews */}
        {featuredReviews.length ? (
          <Reveal as="section" className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                  Trusted by buyers
                </p>
                <h2 className="text-2xl font-semibold text-fleek-text md:text-3xl">
                  What resellers say about MiniFleek
                </h2>
              </div>
              {reviewSummary.average !== null ? (
                <div className="hidden items-center gap-1.5 text-sm text-fleek-muted md:flex">
                  <span className="text-fleek-primary">
                    {'★'.repeat(Math.round(reviewSummary.average))}
                  </span>
                  <span className="font-semibold text-fleek-text">
                    {reviewSummary.average.toFixed(1)}
                  </span>
                  <span>
                    · {reviewSummary.count} {reviewSummary.count === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featuredReviews.map((review) => (
                <article
                  key={review.id}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-7"
                >
                  <div
                    aria-label={`${review.rating} out of 5 stars`}
                    className="text-base tracking-[0.2em] text-fleek-primary"
                  >
                    {'★'.repeat(review.rating)}
                    <span className="text-fleek-border">{'★'.repeat(5 - review.rating)}</span>
                  </div>

                  {review.title ? (
                    <p className="text-sm font-semibold text-fleek-text">{review.title}</p>
                  ) : null}

                  <p className="flex-1 text-sm leading-relaxed text-fleek-text">
                    “{review.body}”
                  </p>

                  <div className="flex items-center gap-3 border-t border-fleek-border/70 pt-4">
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-fleek-primary">
                      {review.reviewer_name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fleek-text">
                        {review.reviewer_name}
                      </p>
                      <p className="truncate text-xs uppercase tracking-[0.1em] text-fleek-muted">
                        Verified MiniFleek buyer
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        ) : null}

        {/* Sign-up CTA */}
        {!isAuthed ? (
          <Reveal as="section">
            <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fleek-primary via-amber-600 to-amber-500 p-8 text-white shadow-xl shadow-amber-900/15 md:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-amber-200/20 blur-2xl"
              />

              <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                    Get started
                  </p>
                  <h2 className="text-3xl font-semibold leading-tight md:text-4xl">
                    Create a buyer account and start sourcing in minutes.
                  </h2>
                  <p className="max-w-lg text-sm text-amber-50/90">
                    Free to join. Browse bundles, save vendors, and track every order from the same dashboard.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 md:justify-end">
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-fleek-primary shadow-md shadow-amber-900/20 transition hover:-translate-y-0.5 hover:bg-amber-50"
                  >
                    Create account
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-full border border-white/50 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
                  >
                    I already have one
                  </Link>
                </div>
              </div>
            </article>
          </Reveal>
        ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

