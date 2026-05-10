import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { ApiError } from '../lib/api/client'
import { getCart, type Cart } from '../lib/api/cart'
import { placeOrder, type ShippingAddress } from '../lib/api/orders'
import { formatGBP } from '../lib/money'
import { useAppSelector } from '../store/hooks'

interface AddressForm {
  full_name: string
  line1: string
  line2: string
  city: string
  postcode: string
  country: string
}

const emptyAddress: AddressForm = {
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  country: 'GB',
}

const requiredFields: { key: keyof AddressForm; label: string }[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'line1', label: 'Address line 1' },
  { key: 'city', label: 'City' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'country', label: 'Country' },
]

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'US', label: 'United States' },
]

export function CheckoutPage() {
  const navigate = useNavigate()
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))

  const [cart, setCart] = useState<Cart | null>(null)
  const [loadingCart, setLoadingCart] = useState(true)
  const [cartError, setCartError] = useState<string | null>(null)

  const [address, setAddress] = useState<AddressForm>(emptyAddress)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddressForm, string>>>({})

  const handleAuthError = useCallback(() => {
    navigate('/login', { state: { from: '/checkout' } })
  }, [navigate])

  useEffect(() => {
    if (!isAuthed) {
      handleAuthError()
      return
    }
    const controller = new AbortController()
    setLoadingCart(true)
    setCartError(null)
    getCart(controller.signal)
      .then((res) => setCart(res.cart))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          handleAuthError()
          return
        }
        setCartError(err instanceof ApiError ? err.message : 'Could not load your cart.')
      })
      .finally(() => setLoadingCart(false))
    return () => controller.abort()
  }, [isAuthed, handleAuthError])

  function updateField<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setAddress((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof AddressForm, string>> = {}
    for (const { key, label } of requiredFields) {
      if (!address[key].trim()) errs[key] = `${label} is required.`
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    if (!cart || cart.items.length === 0) {
      setSubmitError('Your cart is empty. Add a bundle before checking out.')
      return
    }
    if (!validate()) return

    const payload: ShippingAddress = {
      full_name: address.full_name.trim(),
      line1: address.line1.trim(),
      line2: address.line2.trim() ? address.line2.trim() : null,
      city: address.city.trim(),
      postcode: address.postcode.trim(),
      country: address.country.trim(),
    }

    setSubmitting(true)
    try {
      const res = await placeOrder(payload)
      navigate(`/orders/${res.order.id}`, { state: { justPlaced: true } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleAuthError()
        return
      }
      setSubmitError(err instanceof ApiError ? err.message : 'Could not place your order.')
    } finally {
      setSubmitting(false)
    }
  }

  const isEmpty = !loadingCart && !cartError && (cart?.items.length ?? 0) === 0

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
            Almost there
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-fleek-text md:text-4xl">Checkout</h1>
          <p className="mt-2 text-sm text-fleek-muted">
            Enter a shipping address and place your order. No real payment is taken — this is a
            demo flow.
          </p>
        </Reveal>

        {loadingCart ? (
          <CheckoutSkeleton />
        ) : cartError ? (
          <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5">
            <p className="text-base font-semibold text-fleek-text">{cartError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-fleek-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-fleek-primary-dark"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyCheckout />
        ) : cart ? (
          <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10" noValidate>
            <section className="space-y-6">
              <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                  Shipping address
                </h2>
                <p className="mt-1 text-xs text-fleek-muted">
                  Where should your bundles be delivered?
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Full name"
                    name="full_name"
                    autoComplete="name"
                    value={address.full_name}
                    error={fieldErrors.full_name}
                    onChange={(v) => updateField('full_name', v)}
                    className="md:col-span-2"
                  />
                  <Field
                    label="Address line 1"
                    name="line1"
                    autoComplete="address-line1"
                    value={address.line1}
                    error={fieldErrors.line1}
                    onChange={(v) => updateField('line1', v)}
                    className="md:col-span-2"
                  />
                  <Field
                    label="Address line 2"
                    name="line2"
                    autoComplete="address-line2"
                    value={address.line2}
                    optional
                    onChange={(v) => updateField('line2', v)}
                    className="md:col-span-2"
                  />
                  <Field
                    label="City"
                    name="city"
                    autoComplete="address-level2"
                    value={address.city}
                    error={fieldErrors.city}
                    onChange={(v) => updateField('city', v)}
                  />
                  <Field
                    label="Postcode"
                    name="postcode"
                    autoComplete="postal-code"
                    value={address.postcode}
                    error={fieldErrors.postcode}
                    onChange={(v) => updateField('postcode', v)}
                  />
                  <div className="md:col-span-2">
                    <label
                      id="country-label"
                      className="block text-xs font-semibold uppercase tracking-[0.1em] text-fleek-muted"
                    >
                      Country
                    </label>
                    <CountrySelect
                      value={address.country}
                      onChange={(code) => updateField('country', code)}
                      error={Boolean(fieldErrors.country)}
                    />
                    {fieldErrors.country ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.country}</p>
                    ) : null}
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5 md:p-8">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                  Payment
                </h2>
                <p className="mt-3 rounded-2xl border border-dashed border-fleek-border bg-fleek-bg p-4 text-sm text-fleek-muted">
                  This is a demo marketplace — placing the order creates an order record without
                  charging a card. Real payment integration is intentionally out of scope.
                </p>
              </article>

              {submitError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {submitError}
                </div>
              ) : null}
            </section>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-fleek-border bg-white p-6 shadow-sm shadow-amber-900/5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                  Order summary
                </h2>

                <ul className="mt-5 space-y-4">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl border border-fleek-border bg-fleek-bg">
                        {item.product.primary_photo ? (
                          <img
                            src={item.product.primary_photo}
                            alt={item.product.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fleek-text">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-fleek-muted">
                          {item.product.vendor.name} · {item.product.piece_count} pieces ×{' '}
                          {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-fleek-text">
                        {formatGBP(item.line_total, { precision: 0 })}
                      </p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-6 space-y-3 border-t border-fleek-border/70 pt-5 text-sm">
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
                    <dd className="text-fleek-muted">Free demo shipping</dd>
                  </div>
                </dl>

                <div className="mt-5 flex items-baseline justify-between border-t border-fleek-border/70 pt-4">
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-fleek-text">
                    Total
                  </span>
                  <span className="text-2xl font-semibold text-fleek-text">
                    {formatGBP(cart.subtotal, { precision: 0 })}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-fleek-primary px-5 py-3 text-sm font-semibold text-white shadow-md shadow-amber-900/15 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Placing order…
                    </>
                  ) : (
                    <>
                      Place order
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-xs text-fleek-muted">
                  By placing this order you agree to MiniFleek’s demo terms.
                </p>
              </div>
            </aside>
          </form>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  error?: string
  optional?: boolean
  className?: string
}

function Field({ label, name, value, onChange, autoComplete, error, optional, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="block text-xs font-semibold uppercase tracking-[0.1em] text-fleek-muted">
        {label}
        {optional ? <span className="ml-1 normal-case tracking-normal text-fleek-muted/80">(optional)</span> : null}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type="text"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={`mt-1.5 w-full rounded-2xl border bg-white px-3.5 py-2.5 text-sm text-fleek-text shadow-sm shadow-amber-900/5 transition focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
            : 'border-fleek-border focus:border-fleek-primary focus:ring-fleek-primary/30'
        }`}
      />
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

interface CountrySelectProps {
  value: string
  onChange: (code: string) => void
  error?: boolean
}

function CountrySelect({ value, onChange, error }: CountrySelectProps) {
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

  const current = COUNTRIES.find((c) => c.code === value) ?? COUNTRIES[0]

  return (
    <div className="relative mt-1.5" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="country-label"
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-white px-3.5 py-2.5 text-left text-sm text-fleek-text shadow-sm shadow-amber-900/5 transition focus:outline-none focus-visible:ring-2 ${
          error
            ? 'border-red-300 focus-visible:ring-red-200'
            : 'border-fleek-border hover:border-fleek-primary/50 focus-visible:ring-fleek-primary/30'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-fleek-muted">
            {current.code}
          </span>
          <span>{current.label}</span>
        </span>
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
        <div className="absolute left-0 right-0 z-20 mt-2 origin-top overflow-hidden rounded-2xl border border-fleek-border bg-white shadow-lg shadow-amber-900/10">
        <ul
          role="listbox"
          aria-label="Country"
          className="max-h-[200px] overflow-auto p-1"
        >
          {COUNTRIES.map((option) => {
            const isActive = option.code === value
            return (
              <li key={option.code} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.code)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-sm transition-colors duration-150 ${
                    isActive ? 'bg-amber-50 text-fleek-text' : 'text-fleek-text hover:bg-amber-50/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.12em] text-fleek-muted">
                      {option.code}
                    </span>
                    <span>{option.label}</span>
                  </span>
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
        </div>
      ) : null}
    </div>
  )
}

function EmptyCheckout() {
  return (
    <div className="rounded-3xl border border-fleek-border bg-white p-10 text-center shadow-sm shadow-amber-900/5 md:p-14">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-fleek-primary">
        ⇢
      </div>
      <h2 className="mt-5 text-xl font-semibold text-fleek-text md:text-2xl">
        Nothing to check out
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fleek-muted">
        Your cart is empty. Add a bundle from the marketplace before placing an order.
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

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-10">
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
        <div className="h-32 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
      </div>
      <div className="h-96 animate-pulse rounded-3xl border border-fleek-border bg-white/60" />
    </div>
  )
}
