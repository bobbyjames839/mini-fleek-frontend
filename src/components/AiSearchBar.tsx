import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiSearch, type ParsedSearchFilter } from '../lib/api/aiSearch'
import { useAppSelector } from '../store/hooks'
import type { ProductSummary } from '../lib/api/products'
import { formatGBP } from '../lib/money'

const EXAMPLES = [
  'Y2K denim under £8/piece from European vendors, grade A',
  'Vintage Nike hoodies, biggest bundles first',
  'Designer handbags under £500 total from UK sellers',
  'Mixed grade B streetwear, at least 100 pieces',
]

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

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] || code
}

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  price_asc: 'Cheapest total first',
  price_desc: 'Priciest total first',
  price_per_piece_asc: 'Cheapest per piece first',
  price_per_piece_desc: 'Priciest per piece first',
}

interface ParsedChip {
  key: string
  icon: string
  label: string
}

function buildParsedChips(
  parsed: ParsedSearchFilter,
  categoryName: (slug: string) => string,
  vendorName: (slug: string) => string,
): ParsedChip[] {
  const chips: ParsedChip[] = []
  if (parsed.category_slug) {
    chips.push({ key: 'cat', icon: '◫', label: categoryName(parsed.category_slug) })
  }
  if (parsed.vendor_slug) {
    chips.push({ key: 'vendor', icon: '✦', label: vendorName(parsed.vendor_slug) })
  }
  if (parsed.vendor_countries.length) {
    chips.push({
      key: 'countries',
      icon: '⌖',
      label: `Vendors in ${parsed.vendor_countries.map(countryLabel).join(', ')}`,
    })
  }
  if (parsed.brand_contains) {
    chips.push({ key: 'brand', icon: '★', label: `Brand · ${parsed.brand_contains}` })
  }
  if (parsed.grade) {
    chips.push({ key: 'grade', icon: '◉', label: parsed.grade })
  }
  if (parsed.max_price_per_piece !== null) {
    chips.push({
      key: 'max-pp',
      icon: '£',
      label: `≤ ${formatGBP(parsed.max_price_per_piece)}/piece`,
    })
  }
  if (parsed.min_price_per_piece !== null) {
    chips.push({
      key: 'min-pp',
      icon: '£',
      label: `≥ ${formatGBP(parsed.min_price_per_piece)}/piece`,
    })
  }
  if (parsed.max_total_price !== null) {
    chips.push({
      key: 'max-total',
      icon: '£',
      label: `≤ ${formatGBP(parsed.max_total_price, { precision: 0 })} total`,
    })
  }
  if (parsed.min_total_price !== null) {
    chips.push({
      key: 'min-total',
      icon: '£',
      label: `≥ ${formatGBP(parsed.min_total_price, { precision: 0 })} total`,
    })
  }
  if (parsed.min_piece_count !== null) {
    chips.push({ key: 'min-pc', icon: '#', label: `≥ ${parsed.min_piece_count} pieces` })
  }
  if (parsed.max_piece_count !== null) {
    chips.push({ key: 'max-pc', icon: '#', label: `≤ ${parsed.max_piece_count} pieces` })
  }
  if (parsed.free_text) {
    chips.push({ key: 'text', icon: '“', label: `Mentions “${parsed.free_text}”` })
  }
  if (parsed.sort && parsed.sort !== 'newest') {
    const label = SORT_LABELS[parsed.sort]
    if (label) chips.push({ key: 'sort', icon: '↕', label })
  }
  return chips
}

const LOADING_STEPS = [
  'Reading your request',
  'Parsing filters',
  'Searching the catalogue',
  'Ranking results',
]

type Phase = 'idle' | 'loading' | 'results' | 'error'

interface AiState {
  query: string
  phase: Phase
  parsed: ParsedSearchFilter | null
  products: ProductSummary[]
  total: number
  error: string | null
}

const INITIAL_STATE: AiState = {
  query: '',
  phase: 'idle',
  parsed: null,
  products: [],
  total: 0,
  error: null,
}

export function AiSearchBar() {
  const categories = useAppSelector((state) => state.catalog.categories)
  const vendors = useAppSelector((state) => state.catalog.vendors)

  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<AiState>(INITIAL_STATE)
  const [loadingStep, setLoadingStep] = useState(0)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const categoryName = useMemo(() => {
    return (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug
  }, [categories])
  const vendorName = useMemo(() => {
    return (slug: string) => vendors.find((v) => v.slug === slug)?.name ?? slug
  }, [vendors])

  // Click-outside to dismiss the panel (without clearing the bar entirely).
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Cycle the loading-step copy while the request is in flight. Purely
  // cosmetic — gives the user something to watch instead of a silent spinner.
  useEffect(() => {
    if (state.phase !== 'loading') return
    setLoadingStep(0)
    const id = window.setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, 900)
    return () => window.clearInterval(id)
  }, [state.phase])

  function runSearch(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setOpen(true)
    setState({
      query: trimmed,
      phase: 'loading',
      parsed: null,
      products: [],
      total: 0,
      error: null,
    })
    aiSearch(trimmed, 30, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setState({
          query: trimmed,
          phase: 'results',
          parsed: res.parsed,
          products: res.products,
          total: res.total,
          error: null,
        })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message =
          err instanceof Error ? err.message : 'Could not understand that search.'
        setState({
          query: trimmed,
          phase: 'error',
          parsed: null,
          products: [],
          total: 0,
          error: message,
        })
      })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    runSearch(input)
  }

  function handleExample(query: string) {
    setInput(query)
    runSearch(query)
  }

  function reset() {
    abortRef.current?.abort()
    setInput('')
    setState(INITIAL_STATE)
    setOpen(true)
    inputRef.current?.focus()
  }

  const showPanel = open && (state.phase !== 'idle' || input.length === 0)
  const parsedChips =
    state.parsed != null ? buildParsedChips(state.parsed, categoryName, vendorName) : []

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-5 md:pb-7"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
    >
      <div className="pointer-events-auto w-full max-w-[34rem] fleek-ai-bar-in md:max-w-3xl lg:max-w-4xl">
        {/* Floating panel above the bar */}
        {showPanel ? (
          <div
            role="dialog"
            aria-label="AI search"
            className="fleek-ai-panel-in mb-2 flex max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-3xl border border-fleek-border bg-white/95 shadow-2xl shadow-amber-900/15 backdrop-blur-md sm:mb-3 sm:max-h-[min(78vh,42rem)]"
          >
            {state.phase === 'idle' ? (
              <div className="overflow-y-auto p-3 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fleek-primary">
                  Ask the marketplace
                </p>
                <p className="mt-1 text-xs text-fleek-text sm:text-sm">
                  Describe what you’re sourcing — categories, brands, grades, prices, vendor regions.
                </p>
                <div className="mt-3 grid gap-1.5">
                  {EXAMPLES.map((example, i) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => handleExample(example)}
                      className="fleek-ai-pop group flex items-center gap-2.5 rounded-2xl border border-transparent px-2.5 py-2 text-left text-xs text-fleek-text transition hover:border-fleek-border hover:bg-amber-50/60 sm:gap-3 sm:px-3 sm:text-sm"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-amber-50 text-fleek-primary"
                      >
                        ✦
                      </span>
                      <span className="min-w-0 flex-1 truncate">{example}</span>
                      <span
                        aria-hidden="true"
                        className="flex-none text-fleek-muted transition group-hover:translate-x-0.5 group-hover:text-fleek-primary"
                      >
                        ↵
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {state.phase === 'loading' ? (
              <div className="relative flex flex-col overflow-hidden">
                {/* Top progress sweep — gives a clear "working" signal pinned
                    to the panel even while the rest of the layout is still. */}
                <div className="relative h-0.5 flex-none overflow-hidden bg-amber-50">
                  <div className="fleek-progress-bar absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-fleek-primary to-transparent" />
                </div>

                <div className="overflow-y-auto p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Sparkle with an orbiting particle and a glowing pulse ring. */}
                    <div className="relative flex-none">
                      <span
                        aria-hidden="true"
                        className="fleek-glow-ring relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-fleek-primary text-base text-white sm:h-11 sm:w-11"
                      >
                        <span className="fleek-ai-pulse">✦</span>
                      </span>
                      {/* Three orbiting dots — staggered phase via negative
                          delay so they're already in motion at mount. */}
                      <span
                        aria-hidden="true"
                        className="fleek-orbit pointer-events-none absolute inset-0"
                        style={{ animationDelay: '0ms' }}
                      >
                        <span className="absolute -right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_6px_rgb(234_179_8_/_0.7)]" />
                      </span>
                      <span
                        aria-hidden="true"
                        className="fleek-orbit pointer-events-none absolute inset-0"
                        style={{ animationDelay: '-0.8s', animationDuration: '2.8s' }}
                      >
                        <span className="absolute left-1/2 -top-0.5 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_6px_rgb(252_211_77_/_0.7)]" />
                      </span>
                      <span
                        aria-hidden="true"
                        className="fleek-orbit pointer-events-none absolute inset-0"
                        style={{ animationDelay: '-1.6s', animationDuration: '3.2s' }}
                      >
                        <span className="absolute -left-0.5 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-fleek-primary shadow-[0_0_6px_rgb(234_179_8_/_0.7)]" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-sm font-semibold text-fleek-text">
                        “{state.query}”
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-fleek-muted">
                        <span className="truncate">{LOADING_STEPS[loadingStep]}</span>
                        <span aria-hidden="true" className="inline-flex items-baseline gap-0.5">
                          <span
                            className="fleek-thinking-dot inline-block h-1 w-1 rounded-full bg-fleek-primary"
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className="fleek-thinking-dot inline-block h-1 w-1 rounded-full bg-fleek-primary"
                            style={{ animationDelay: '160ms' }}
                          />
                          <span
                            className="fleek-thinking-dot inline-block h-1 w-1 rounded-full bg-fleek-primary"
                            style={{ animationDelay: '320ms' }}
                          />
                        </span>
                      </div>

                      {/* Step ladder — each step lights up as the loader
                          progresses, so the user sees forward motion even
                          on a slow request. */}
                      <ol className="mt-3 grid gap-1 text-[11px] sm:grid-cols-2">
                        {LOADING_STEPS.map((step, i) => {
                          const done = i < loadingStep
                          const active = i === loadingStep
                          return (
                            <li
                              key={step}
                              className={`flex items-center gap-1.5 transition-colors duration-300 ${
                                done
                                  ? 'text-emerald-600'
                                  : active
                                    ? 'text-fleek-text'
                                    : 'text-fleek-muted/60'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full text-[9px] font-bold transition-all duration-300 ${
                                  done
                                    ? 'bg-emerald-500 text-white'
                                    : active
                                      ? 'fleek-glow-ring bg-fleek-primary text-white'
                                      : 'border border-fleek-border bg-white text-transparent'
                                }`}
                              >
                                {done ? '✓' : active ? '·' : ''}
                              </span>
                              <span className="truncate">{step}</span>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  </div>

                  {/* Shimmer chips — preview of the upcoming "Understood as"
                      strip. Sized to look like real parsed chips. */}
                  <div className="mt-5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fleek-muted/80">
                      Understanding
                    </span>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span
                        key={i}
                        className="fleek-ai-shimmer h-6 rounded-full border border-fleek-border/60"
                        style={{
                          width: `${72 + ((i * 37) % 80)}px`,
                          animationDelay: `${i * 120}ms`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Result card placeholders. Aspect ratio matches the real
                      grid so layout doesn't jump on reveal. */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-2xl border border-fleek-border/60"
                      >
                        <div
                          className="fleek-ai-shimmer aspect-[4/3] w-full"
                          style={{ animationDelay: `${200 + i * 110}ms` }}
                        />
                        <div className="space-y-1.5 p-2 sm:p-2.5">
                          <div
                            className="fleek-ai-shimmer h-2.5 w-3/4 rounded-full"
                            style={{ animationDelay: `${260 + i * 110}ms` }}
                          />
                          <div
                            className="fleek-ai-shimmer h-2 w-1/2 rounded-full"
                            style={{ animationDelay: `${320 + i * 110}ms` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {state.phase === 'error' ? (
              <div className="overflow-y-auto p-4 sm:p-5">
                <p className="text-sm font-semibold text-red-600">Search failed</p>
                <p className="mt-1 text-xs text-fleek-muted">{state.error}</p>
                <button
                  type="button"
                  onClick={() => runSearch(state.query)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-fleek-primary-dark"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {state.phase === 'results' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-none items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-fleek-primary text-base text-white"
                  >
                    ✦
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fleek-text">
                      “{state.query}”
                    </p>
                    <p className="text-xs text-fleek-muted">
                      {state.total === 0
                        ? 'No bundles matched — try loosening one constraint.'
                        : `${state.total} ${state.total === 1 ? 'bundle' : 'bundles'} matched`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-none rounded-full border border-fleek-border bg-white px-2.5 py-1 text-[11px] font-semibold text-fleek-muted transition hover:border-fleek-primary/40 hover:text-fleek-text"
                  >
                    Clear
                  </button>
                </div>

                {parsedChips.length > 0 ? (
                  <div className="mt-3 flex flex-none flex-wrap items-center gap-1.5 px-4 sm:px-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fleek-muted">
                      Understood as
                    </span>
                    {parsedChips.map((chip, i) => (
                      <span
                        key={chip.key}
                        className="fleek-ai-pop inline-flex items-center gap-1.5 rounded-full border border-fleek-border bg-white px-2.5 py-1 text-xs font-medium text-fleek-text"
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <span aria-hidden="true" className="text-fleek-primary">
                          {chip.icon}
                        </span>
                        {chip.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {state.products.length > 0 ? (
                  <div
                    className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5 sm:pb-5"
                    role="region"
                    aria-label="AI search results"
                  >
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {state.products.map((p, i) => (
                        <Link
                          key={p.id}
                          to={`/product/${p.id}`}
                          onClick={() => setOpen(false)}
                          className="fleek-ai-pop group overflow-hidden rounded-2xl border border-fleek-border bg-white transition hover:-translate-y-0.5 hover:border-fleek-primary/50 hover:shadow-md hover:shadow-amber-900/10"
                          style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                        >
                          {p.primary_photo ? (
                            <img
                              src={p.primary_photo}
                              alt={p.name}
                              loading="lazy"
                              className="aspect-[4/3] w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-[4/3] w-full items-center justify-center bg-fleek-bg text-[10px] uppercase tracking-[0.14em] text-fleek-muted">
                              No photo
                            </div>
                          )}
                          <div className="space-y-0.5 p-2 sm:p-2.5">
                            <p className="truncate text-xs font-semibold text-fleek-text">
                              {p.name}
                            </p>
                            <p className="truncate text-[11px] text-fleek-muted">
                              {p.vendor.name}
                            </p>
                            <p className="text-[11px] font-semibold text-fleek-primary">
                              {formatGBP(p.price_per_piece)}
                              <span className="text-fleek-muted"> /piece</span>
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {state.total > state.products.length ? (
                      <p className="mt-3 text-center text-[11px] text-fleek-muted">
                        Showing {state.products.length} of {state.total} matches
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5" />
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* The bar itself */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-1 rounded-full border border-fleek-border bg-white/95 px-1.5 py-1.5 shadow-2xl shadow-amber-900/15 backdrop-blur-md sm:gap-1.5 sm:px-2 sm:py-2"
        >
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-fleek-primary text-sm text-white sm:h-9 sm:w-9 sm:text-base ${
              state.phase === 'loading' ? 'fleek-ai-pulse' : ''
            }`}
          >
            ✦
          </span>
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Ask in plain English…"
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sm text-fleek-text placeholder:text-slate-400 focus:outline-none sm:px-3"
          />
          {input ? (
            <button
              type="button"
              onClick={reset}
              aria-label="Clear"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-fleek-muted transition hover:bg-amber-50 hover:text-fleek-text sm:h-8 sm:w-8"
            >
              ×
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!input.trim() || state.phase === 'loading'}
            aria-label="Ask AI"
            className="flex-none rounded-full bg-fleek-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-fleek-primary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2"
          >
            <span className="hidden sm:inline">
              {state.phase === 'loading' ? 'Asking…' : 'Ask AI'}
            </span>
            <span aria-hidden="true" className="sm:hidden">
              {state.phase === 'loading' ? '…' : '→'}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
