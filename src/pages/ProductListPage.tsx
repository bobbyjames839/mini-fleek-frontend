import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { ProductCard } from '../components/ProductCard'
import { type ProductSort, type ProductSummary } from '../lib/api/products'
import { useAppSelector } from '../store/hooks'
import { Reveal } from '../components/Reveal'

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price · low to high' },
  { value: 'price_desc', label: 'Price · high to low' },
]

function isProductSort(value: string | null): value is ProductSort {
  return value === 'newest' || value === 'price_asc' || value === 'price_desc'
}

interface FacetOption {
  value: string
  label: string
  meta?: string
}

interface FacetGroupProps {
  title: string
  options: FacetOption[]
  selected: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
  emptyHint?: string
  defaultOpen?: boolean
}

function toggleValue(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

function FacetGroup({
  title,
  options,
  selected,
  onChange,
  searchable,
  emptyHint,
  defaultOpen = true,
}: FacetGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [needle, setNeedle] = useState('')

  const filtered = useMemo(() => {
    if (!searchable || !needle.trim()) return options
    const q = needle.trim().toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, needle, searchable])

  const selectedLabel =
    selected.length === 0
      ? null
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? null
        : `${selected.length} selected`

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-amber-50/40"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-semibold text-fleek-text">{title}</span>
          {selectedLabel ? (
            <span className="truncate text-xs text-fleek-muted">· {selectedLabel}</span>
          ) : null}
        </span>
        <span className="flex flex-none items-center gap-2">
          {selected.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation()
                onChange([])
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange([])
                }
              }}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-fleek-primary transition-colors duration-150 hover:bg-amber-50"
            >
              Reset
            </span>
          ) : null}
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 text-fleek-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="border-t border-fleek-border/70 px-4 pb-4 pt-3">
          {searchable && options.length > 6 ? (
            <div className="mb-3">
              <input
                type="search"
                value={needle}
                onChange={(event) => setNeedle(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}`}
                className="w-full border-0 border-b border-fleek-border bg-transparent px-0 py-1.5 text-sm text-fleek-text placeholder:text-fleek-muted/70 focus:border-fleek-primary focus:outline-none focus:ring-0"
              />
            </div>
          ) : null}

          {options.length === 0 ? (
            <p className="text-xs text-fleek-muted">{emptyHint || 'Loading…'}</p>
          ) : (
            <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="px-1 py-1 text-xs text-fleek-muted">No matches.</p>
              ) : (
                filtered.map((option) => {
                  const isActive = selected.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onChange(toggleValue(selected, option.value))}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors duration-150 ${
                        isActive ? 'text-fleek-text' : 'text-fleek-muted hover:text-fleek-text'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded-[5px] border transition-colors duration-150 ${
                          isActive
                            ? 'border-fleek-primary bg-fleek-primary text-white'
                            : 'border-fleek-border bg-white group-hover:border-fleek-primary/60'
                        }`}
                      >
                        {isActive ? (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.meta ? (
                        <span className="flex-none text-[11px] text-fleek-muted/80">
                          {option.meta}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

interface FilterChipProps {
  label: ReactNode
  onRemove: () => void
}

interface SortDropdownProps {
  value: ProductSort
  onChange: (value: ProductSort) => void
}

function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
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

  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0]

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-fleek-border bg-white px-3.5 py-1.5 text-sm font-medium text-fleek-text transition-colors duration-150 hover:border-fleek-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-fleek-primary/30"
      >
        <span className="text-fleek-muted">Sort:</span>
        <span>{current.label}</span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-fleek-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Sort"
          className="absolute right-0 z-20 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-fleek-border bg-white p-1 shadow-lg shadow-amber-900/10"
        >
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    isActive ? 'bg-amber-50 text-fleek-text' : 'text-fleek-text hover:bg-amber-50/60'
                  }`}
                >
                  <span>{option.label}</span>
                  {isActive ? (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 text-fleek-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                    </svg>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

interface ViewToggleProps {
  value: 'grid' | 'by_vendor' | 'by_category'
  onChange: (next: 'grid' | 'by_vendor' | 'by_category') => void
}

function ViewToggle({ value, onChange }: ViewToggleProps) {
  const options: { value: ViewToggleProps['value']; label: string; icon: ReactNode }[] = [
    {
      value: 'grid',
      label: 'Grid',
      icon: (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      ),
    },
    {
      value: 'by_vendor',
      label: 'By vendor',
      icon: (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="3" width="3" height="3" rx="0.5" />
          <rect x="2" y="9" width="3" height="3" rx="0.5" />
          <path d="M7 4.5h7M7 7h7M7 10.5h7M7 13h4" />
        </svg>
      ),
    },
    {
      value: 'by_category',
      label: 'By category',
      icon: (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 4h12M2 8h12M2 12h12" />
          <circle cx="2.5" cy="4" r="0.5" fill="currentColor" />
          <circle cx="2.5" cy="8" r="0.5" fill="currentColor" />
          <circle cx="2.5" cy="12" r="0.5" fill="currentColor" />
        </svg>
      ),
    },
  ]
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex items-center gap-1 rounded-full border border-fleek-border bg-white p-1"
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            title={option.label}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-fleek-primary text-white'
                : 'text-fleek-muted hover:text-fleek-text'
            }`}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-fleek-border bg-white px-3 py-1 text-xs font-semibold text-fleek-text shadow-sm shadow-amber-900/5">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-fleek-bg text-[11px] text-fleek-muted transition hover:bg-fleek-primary hover:text-white"
      >
        ×
      </button>
    </span>
  )
}

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

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '–'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function ProductScroller({ items }: { items: ProductSummary[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setCanLeft(el.scrollLeft > 4)
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items.length])

  function nudge(direction: 1 | -1) {
    const el = ref.current
    if (!el) return
    // Scroll roughly one card width + gap.
    el.scrollBy({ left: direction * (el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="scrollbar-hide flex gap-4 overflow-x-auto pb-1 scroll-smooth"
      >
        {items.map((p) => (
          <div key={p.id} className="w-60 flex-none">
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {canLeft ? (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 -translate-x-2 items-center justify-center rounded-full border border-fleek-border bg-white text-fleek-text shadow-md shadow-amber-900/10 transition-colors duration-150 hover:border-fleek-primary/60"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
      ) : null}
      {canRight ? (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-fleek-border bg-white text-fleek-text shadow-md shadow-amber-900/10 transition-colors duration-150 hover:border-fleek-primary/60"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

type ViewMode = 'grid' | 'by_vendor' | 'by_category'

function isViewMode(value: string | null): value is ViewMode {
  return value === 'grid' || value === 'by_vendor' || value === 'by_category'
}

function parseList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const category = parseList(searchParams.get('category'))
  const vendor = parseList(searchParams.get('vendor'))
  const sortParam = searchParams.get('sort')
  const sort: ProductSort = isProductSort(sortParam) ? sortParam : 'newest'
  const q = searchParams.get('q') || ''
  const viewParam = searchParams.get('view')
  const view: ViewMode = isViewMode(viewParam) ? viewParam : 'grid'

  // Memoised so deps stay stable across renders.
  const categoryKey = category.join(',')
  const vendorKey = vendor.join(',')

  const [searchInput, setSearchInput] = useState(q)
  const categories = useAppSelector((state) => state.catalog.categories)
  const vendors = useAppSelector((state) => state.catalog.vendors)
  const allProducts = useAppSelector((state) => state.catalog.products)
  const status = useAppSelector((state) => state.catalog.status)
  const error = useAppSelector((state) => state.catalog.error)
  const loading = status === 'idle' || status === 'loading'
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  // Lock body scroll while the mobile filter drawer is open.
  useEffect(() => {
    if (!mobileFiltersOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileFiltersOpen])

  // Client-side filter + search + sort over the full fetched catalogue.
  const products: ProductSummary[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = allProducts.filter((p) => {
      if (category.length && !category.includes(p.category.slug)) return false
      if (vendor.length && !vendor.includes(p.vendor.slug)) return false
      if (needle) {
        const haystack = `${p.name} ${p.brand ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
    if (sort === 'price_asc') return [...filtered].sort((a, b) => a.total_price - b.total_price)
    if (sort === 'price_desc') return [...filtered].sort((a, b) => b.total_price - a.total_price)
    return filtered
  }, [allProducts, categoryKey, vendorKey, q, sort])

  const total = products.length

  const activeCategories = useMemo(
    () => category.map((slug) => categories.find((c) => c.slug === slug)).filter(Boolean) as Category[],
    [categories, categoryKey],
  )
  const activeVendors = useMemo(
    () => vendor.map((slug) => vendors.find((v) => v.slug === slug)).filter(Boolean) as Vendor[],
    [vendors, vendorKey],
  )

  const categoryOptions: FacetOption[] = categories.map((c) => ({
    value: c.slug,
    label: c.name,
  }))
  const vendorOptions: FacetOption[] = vendors.map((v) => ({
    value: v.slug,
    label: v.name,
    meta: countryLabel(v.country),
  }))

  function updateParams(updater: (current: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    updater(next)
    setSearchParams(next, { replace: false })
  }

  function setCategoryList(slugs: string[]) {
    updateParams((next) => {
      if (slugs.length) next.set('category', slugs.join(','))
      else next.delete('category')
    })
  }

  function setVendorList(slugs: string[]) {
    updateParams((next) => {
      if (slugs.length) next.set('vendor', slugs.join(','))
      else next.delete('vendor')
    })
  }

  function setSort(value: string) {
    updateParams((next) => {
      if (value && value !== 'newest') next.set('sort', value)
      else next.delete('sort')
    })
  }

  function setQuery(value: string) {
    updateParams((next) => {
      if (value) next.set('q', value)
      else next.delete('q')
    })
  }

  function setView(next: ViewMode) {
    updateParams((params) => {
      if (next === 'grid') params.delete('view')
      else params.set('view', next)
    })
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    setQuery(searchInput.trim())
  }

  function clearAll() {
    setSearchParams({}, { replace: false })
  }

  const activeFilterCount =
    category.length + vendor.length + (q ? 1 : 0) + (sortParam && sortParam !== 'newest' ? 1 : 0)
  const filtersActive = activeFilterCount > 0

  const heroTitle =
    category.length === 1 && activeCategories[0]
      ? `${activeCategories[0].name} bundles`
      : vendor.length === 1 && activeVendors[0]
        ? activeVendors[0].name
        : 'All bundles'

  const heroSubtitle =
    vendor.length === 1 && activeVendors[0]
      ? `${countryLabel(activeVendors[0].country)}${activeVendors[0].rating !== null ? ` · ★ ${activeVendors[0].rating.toFixed(1)}` : ''}`
      : 'Verified wholesalers across the UK, Europe, US, and beyond.'

  // Group helpers for non-grid views.
  const productsByVendor = useMemo(() => {
    const map = new Map<string, { vendor: ProductSummary['vendor']; items: ProductSummary[] }>()
    for (const p of products) {
      const key = p.vendor.slug
      if (!map.has(key)) map.set(key, { vendor: p.vendor, items: [] })
      map.get(key)!.items.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.vendor.name.localeCompare(b.vendor.name))
  }, [products])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, { category: ProductSummary['category']; items: ProductSummary[] }>()
    for (const p of products) {
      const key = p.category.slug
      if (!map.has(key)) map.set(key, { category: p.category, items: [] })
      map.get(key)!.items.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.category.name.localeCompare(b.category.name))
  }, [products])

  const filterSidebar = (
    <div className="overflow-hidden rounded-2xl border border-fleek-border bg-white shadow-sm shadow-amber-900/5 divide-y divide-fleek-border/70">
      <FacetGroup
        title="Category"
        options={categoryOptions}
        selected={category}
        onChange={setCategoryList}
        emptyHint="No categories yet."
      />
      <FacetGroup
        title="Vendor"
        options={vendorOptions}
        selected={vendor}
        onChange={setVendorList}
        searchable
        emptyHint="No vendors yet."
      />
    </div>
  )

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[36rem] -right-40 h-[28rem] w-[28rem] rounded-full bg-amber-300/25 blur-3xl"
      />

      <SiteHeader />

      <main className="relative z-10 w-full pb-16 md:pb-20">
        {/* Page header */}
        <section className="px-4 pt-10 md:px-8 lg:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between fleek-fade-up">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fleek-primary">
                Marketplace
              </p>
              <h1 className="text-3xl font-semibold leading-tight text-fleek-text md:text-4xl">
                {heroTitle}
              </h1>
              <p className="text-sm text-fleek-muted">
                {loading
                  ? 'Loading bundles…'
                  : `${total.toLocaleString()} ${total === 1 ? 'bundle' : 'bundles'} · ${heroSubtitle}`}
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="w-full md:w-96">
                <label className="sr-only" htmlFor="product-search">
                  Search bundles
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-fleek-muted"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="M20 20l-3.5-3.5" />
                    </svg>
                  </span>
                  <input
                    id="product-search"
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by name or brand"
                    className="w-full rounded-full border border-fleek-border bg-white pl-11 pr-24 py-2.5 text-sm text-fleek-text placeholder:text-slate-400 shadow-sm shadow-amber-900/5 focus:border-fleek-primary focus:outline-none focus:ring-2 focus:ring-fleek-primary/30"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center justify-center rounded-full bg-fleek-primary px-4 text-xs font-semibold text-white transition-colors duration-150 hover:bg-fleek-primary-dark"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
        </section>

        {/* Body */}
        <div
          className={`mt-8 grid gap-6 px-4 md:px-8 lg:gap-8 lg:px-10 ${
            view === 'grid' ? 'lg:grid-cols-[18rem_1fr]' : 'lg:grid-cols-1'
          }`}
        >
          {/* Sidebar (desktop) — only relevant in grid view; the grouped views
              already surface vendors/categories via their layout. */}
          {view === 'grid' ? (
            <aside className="hidden lg:block lg:pt-[60px]">{filterSidebar}</aside>
          ) : null}

          {/* Grid column */}
          <section className="min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-fleek-border/70 pb-3">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className={`inline-flex items-center gap-2 rounded-full border border-fleek-border bg-white px-3.5 py-1.5 text-sm font-medium text-fleek-text transition-colors duration-150 hover:border-fleek-primary/50 lg:hidden ${
                  view === 'grid' ? '' : 'hidden'
                }`}
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 4h12M4 8h8M6 12h4" />
                </svg>
                Filters
                {activeFilterCount ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fleek-primary px-1.5 text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              <div className="hidden items-baseline gap-2 text-sm text-fleek-muted lg:flex">
                <span className="font-semibold text-fleek-text">{total.toLocaleString()}</span>
                <span>{total === 1 ? 'bundle' : 'bundles'}</span>
                {filtersActive ? <span aria-hidden="true">·</span> : null}
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-semibold text-fleek-primary transition hover:underline"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <ViewToggle value={view} onChange={setView} />
                <SortDropdown
                  value={sort}
                  onChange={(next) => setSort(next === 'newest' ? '' : next)}
                />
              </div>
            </div>

            {/* Active filter chips */}
            {filtersActive ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fleek-muted">
                  Active
                </span>
                {category.map((slug) => {
                  const cat = categories.find((c) => c.slug === slug)
                  return (
                    <FilterChip
                      key={`cat-${slug}`}
                      label={
                        <>
                          <span className="text-fleek-muted">Category ·</span>{' '}
                          {cat?.name || slug}
                        </>
                      }
                      onRemove={() => setCategoryList(category.filter((s) => s !== slug))}
                    />
                  )
                })}
                {vendor.map((slug) => {
                  const v = vendors.find((vv) => vv.slug === slug)
                  return (
                    <FilterChip
                      key={`v-${slug}`}
                      label={
                        <>
                          <span className="text-fleek-muted">Vendor ·</span>{' '}
                          {v?.name || slug}
                        </>
                      }
                      onRemove={() => setVendorList(vendor.filter((s) => s !== slug))}
                    />
                  )
                })}
                {q ? (
                  <FilterChip
                    label={
                      <>
                        <span className="text-fleek-muted">Search ·</span> “{q}”
                      </>
                    }
                    onRemove={() => setQuery('')}
                  />
                ) : null}
                {sortParam && sortParam !== 'newest' ? (
                  <FilterChip
                    label={
                      <>
                        <span className="text-fleek-muted">Sort ·</span>{' '}
                        {SORT_OPTIONS.find((s) => s.value === sort)?.label}
                      </>
                    }
                    onRemove={() => setSort('')}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-1 text-xs font-semibold text-fleek-primary transition hover:underline"
                >
                  Clear all
                </button>
              </div>
            ) : null}

            {/* Grid */}
            <div className="mt-6">
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[20rem] animate-pulse rounded-3xl border border-fleek-border/70 bg-white/40"
                    />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-fleek-border p-10 text-center">
                  <p className="text-base font-semibold text-fleek-text">
                    No bundles match these filters.
                  </p>
                  <p className="mt-1 text-sm text-fleek-muted">
                    Try a different category or vendor, change the search term, or clear all filters.
                  </p>
                  {filtersActive ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-fleek-primary-dark"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : view === 'grid' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {products.map((product, index) => (
                      <div
                        key={product.id}
                        className="fleek-fade-up"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                      >
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </>
              ) : view === 'by_vendor' ? (
                <div className="space-y-4">
                  {productsByVendor.map(({ vendor: v, items }, idx) => {
                    const fullVendor = vendors.find((vv) => vv.slug === v.slug)
                    const onSale = items.some((p) => p.discount_pct !== null && p.discount_pct > 0)
                    return (
                      <Reveal
                        key={v.slug}
                        as="article"
                        delayMs={Math.min(idx, 6) * 60}
                        className="overflow-hidden rounded-2xl border border-fleek-border bg-white shadow-sm shadow-amber-900/5"
                      >
                        <div className="grid gap-5 p-5 md:grid-cols-[16rem_1fr] md:gap-6 md:p-6">
                          <div className="flex items-start gap-4 md:flex-col md:items-stretch md:gap-3">
                            {fullVendor?.image_url ? (
                              <img
                                src={fullVendor.image_url}
                                alt={v.name}
                                className="h-16 w-16 flex-none rounded-full object-cover md:h-20 md:w-20"
                              />
                            ) : (
                              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-amber-50 text-base font-semibold text-fleek-primary md:h-20 md:w-20 md:text-lg">
                                {initials(v.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-fleek-text md:text-lg">
                                  {v.name}
                                </h3>
                                {onSale ? (
                                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                                    On sale
                                  </span>
                                ) : null}
                              </div>
                              {fullVendor ? (
                                <p className="flex items-center gap-1.5 text-xs text-fleek-muted">
                                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                                    <path d="M8 14s5-4.5 5-8a5 5 0 10-10 0c0 3.5 5 8 5 8z" />
                                    <circle cx="8" cy="6" r="1.6" />
                                  </svg>
                                  {countryLabel(fullVendor.country)}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                                {fullVendor?.rating !== null && fullVendor?.rating !== undefined ? (
                                  <span className="inline-flex items-baseline gap-1">
                                    <span className="text-amber-500">★</span>
                                    <span className="font-semibold text-fleek-text">
                                      {fullVendor.rating.toFixed(1)} / 5
                                    </span>
                                    <span className="text-fleek-muted">Quality</span>
                                  </span>
                                ) : null}
                                <span className="inline-flex items-baseline gap-1">
                                  <span className="font-semibold text-fleek-text">{items.length}</span>
                                  <span className="text-fleek-muted">
                                    {items.length === 1 ? 'bundle' : 'bundles'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <ProductScroller items={items} />
                          </div>
                        </div>
                      </Reveal>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {productsByCategory.map(({ category: c, items }, idx) => {
                    const fullCategory = categories.find((cc) => cc.slug === c.slug)
                    const onSale = items.some((p) => p.discount_pct !== null && p.discount_pct > 0)
                    return (
                      <Reveal
                        key={c.slug}
                        as="article"
                        delayMs={Math.min(idx, 6) * 60}
                        className="overflow-hidden rounded-2xl border border-fleek-border bg-white shadow-sm shadow-amber-900/5"
                      >
                        <div className="grid gap-5 p-5 md:grid-cols-[16rem_1fr] md:gap-6 md:p-6">
                          <div className="flex items-start gap-4 md:flex-col md:items-stretch md:gap-3">
                            {fullCategory?.image_url ? (
                              <img
                                src={fullCategory.image_url}
                                alt={c.name}
                                className="h-16 w-16 flex-none rounded-full object-cover md:h-20 md:w-20"
                              />
                            ) : (
                              <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-amber-50 text-base font-semibold text-fleek-primary md:h-20 md:w-20 md:text-lg">
                                {initials(c.name)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-fleek-text md:text-lg">
                                  {c.name}
                                </h3>
                                {onSale ? (
                                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                                    On sale
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs uppercase tracking-[0.14em] text-fleek-muted">
                                Category
                              </p>
                              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
                                <span className="inline-flex items-baseline gap-1">
                                  <span className="font-semibold text-fleek-text">{items.length}</span>
                                  <span className="text-fleek-muted">
                                    {items.length === 1 ? 'bundle' : 'bundles'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <ProductScroller items={items} />
                          </div>
                        </div>
                      </Reveal>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-fleek-bg shadow-xl shadow-amber-900/20">
            <div className="flex items-center justify-between border-b border-fleek-border bg-white/85 px-5 py-4 backdrop-blur">
              <h2 className="text-base font-semibold text-fleek-text">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-fleek-border bg-white text-fleek-muted transition hover:text-fleek-text"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{filterSidebar}</div>
            <div className="flex items-center gap-3 border-t border-fleek-border bg-white/85 px-5 py-4 backdrop-blur">
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full border border-fleek-border bg-white px-4 py-2 text-sm font-semibold text-fleek-text transition hover:border-fleek-primary/40 hover:text-fleek-primary"
                >
                  Clear all
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:bg-fleek-primary-dark"
              >
                Show {total.toLocaleString()} {total === 1 ? 'bundle' : 'bundles'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  )
}
