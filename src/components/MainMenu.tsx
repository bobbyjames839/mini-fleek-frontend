import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'

type MenuKey = 'categories' | 'vendors'

const COUNTRY_FLAGS: Record<string, string> = {
  GB: '🇬🇧',
  US: '🇺🇸',
  PK: '🇵🇰',
  IN: '🇮🇳',
  LV: '🇱🇻',
  PL: '🇵🇱',
  DE: '🇩🇪',
  FR: '🇫🇷',
  IT: '🇮🇹',
  ES: '🇪🇸',
  NL: '🇳🇱',
  BE: '🇧🇪',
}

export function MainMenu() {
  const categories = useAppSelector((state) => state.catalog.categories)
  const vendors = useAppSelector((state) => state.catalog.vendors)
  const navigate = useNavigate()

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null)
  const closeTimer = useRef<number | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 120)
  }
  function cancelClose() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  function open(menu: MenuKey) {
    cancelClose()
    setOpenMenu(menu)
  }

  // Close on escape or outside click.
  useEffect(() => {
    if (!openMenu) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    function onPointer(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [openMenu])

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  function go(path: string) {
    setOpenMenu(null)
    navigate(path)
  }

  const triggerClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active
        ? 'bg-white text-fleek-text shadow-sm shadow-amber-900/10 ring-1 ring-fleek-border/80'
        : 'text-fleek-muted hover:bg-white/60 hover:text-fleek-text'
    }`

  return (
    <nav ref={navRef} className="relative flex items-center gap-1 md:gap-2" aria-label="Primary">
      {/* Categories */}
      <div
        className="relative"
        onMouseEnter={() => open('categories')}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'categories'}
          onClick={() => go('/products')}
          onFocus={() => open('categories')}
          className={triggerClass(openMenu === 'categories')}
        >
          Categories
          <span aria-hidden="true" className="text-[10px] text-fleek-muted">▾</span>
        </button>

        {openMenu === 'categories' ? (
          <div
            role="menu"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute left-1/2 top-full z-40 mt-2 w-72 -translate-x-1/2 overflow-hidden rounded-2xl border border-fleek-border bg-white p-1.5 shadow-xl shadow-amber-900/10"
          >
            {categories.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fleek-muted">Loading categories…</p>
            ) : (
              <>
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    role="menuitem"
                    to={`/products?category=${encodeURIComponent(c.slug)}`}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm text-fleek-text transition hover:bg-amber-50"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span aria-hidden="true" className="text-xs text-fleek-muted">→</span>
                  </Link>
                ))}
                <div className="mt-1 border-t border-fleek-border/70 pt-1">
                  <Link
                    to="/products"
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-fleek-primary transition hover:bg-amber-50"
                  >
                    Browse all bundles
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Vendors */}
      <div
        className="relative"
        onMouseEnter={() => open('vendors')}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'vendors'}
          onClick={() => go('/products?view=by_vendor')}
          onFocus={() => open('vendors')}
          className={triggerClass(openMenu === 'vendors')}
        >
          Vendors
          <span aria-hidden="true" className="text-[10px] text-fleek-muted">▾</span>
        </button>

        {openMenu === 'vendors' ? (
          <div
            role="menu"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute left-1/2 top-full z-40 mt-2 w-80 -translate-x-1/2 overflow-hidden rounded-2xl border border-fleek-border bg-white p-1.5 shadow-xl shadow-amber-900/10"
          >
            {vendors.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fleek-muted">Loading vendors…</p>
            ) : (
              <>
                <div className="max-h-80 overflow-y-auto">
                  {vendors.map((v) => (
                    <Link
                      key={v.slug}
                      role="menuitem"
                      to={`/products?vendor=${encodeURIComponent(v.slug)}`}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition hover:bg-amber-50"
                    >
                      <span aria-hidden="true" className="text-base leading-none">
                        {COUNTRY_FLAGS[v.country] || '🌐'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-fleek-text">{v.name}</span>
                        <span className="block truncate text-xs text-fleek-muted">
                          {v.country}
                          {typeof v.rating === 'number' ? ` · ★ ${v.rating.toFixed(1)}` : ''}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-xs text-fleek-muted">→</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-1 border-t border-fleek-border/70 pt-1">
                  <Link
                    to="/products?view=by_vendor"
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-fleek-primary transition hover:bg-amber-50"
                  >
                    Browse by vendor
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </nav>
  )
}
