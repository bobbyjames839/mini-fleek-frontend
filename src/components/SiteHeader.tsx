import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MainMenu } from './MainMenu'
import { CartButton } from './CartButton'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { clearCredentials } from '../store/authSlice'
import { API_BASE_URL } from '../lib/api/client'
import { clearCartCache } from '../lib/api/cart'

function getDisplayName(email?: string | null) {
  if (!email) return 'MiniFleek Buyer'
  const base = email.split('@')[0] || 'buyer'
  return base
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getInitials(email?: string | null) {
  const name = getDisplayName(email)
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

interface AccountMenuItem {
  label: string
  description: string
  icon: string
  to: string
}

const accountMenuItems: AccountMenuItem[] = [
  { label: 'My orders', description: 'Your order history', icon: '⌖', to: '/orders' },
  { label: 'My cart', description: 'Items you have reserved', icon: '◫', to: '/cart' },
  { label: 'Checkout', description: 'Place your current order', icon: '⇢', to: '/checkout' },
]

export function SiteHeader() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const email = useAppSelector((state) => state.auth.email)
  const isAuthed = Boolean(accessToken)

  const [menuOpen, setMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleSignOut() {
    if (accessToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      } catch {
        // Always clear credentials even if the server logout call fails.
      }
    }
    clearCartCache()
    dispatch(clearCredentials())
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-fleek-border/70 bg-white/75 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5 md:gap-6 md:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 md:gap-8">
          <Link
            to="/"
            className="flex-none text-[15px] font-semibold tracking-[0.14em] text-fleek-text transition hover:text-fleek-primary sm:text-lg sm:tracking-[0.16em] md:text-xl"
            title="MiniFleek"
          >
            MINI//FLEEK
          </Link>
          <MainMenu />
        </div>

        <div className="flex flex-none items-center gap-1.5 sm:gap-2">
          <CartButton />
          {isAuthed ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((previous) => !previous)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-fleek-border bg-white text-xs font-semibold text-fleek-text shadow-sm shadow-amber-900/5 transition hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:shadow-md sm:h-11 sm:w-11 sm:text-sm"
                aria-label="Open account menu"
                title="Account"
              >
                {getInitials(email)}
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-30 mt-3 w-[min(20rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-fleek-border bg-white shadow-xl shadow-amber-900/10"
                >
                  <div className="flex items-start gap-3 bg-gradient-to-br from-amber-50 to-white p-4">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-fleek-primary text-sm font-semibold text-white shadow-md shadow-amber-900/15">
                      {getInitials(email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fleek-text">
                        {getDisplayName(email)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-fleek-muted">
                        {email || 'No email on file'}
                      </p>
                    </div>
                  </div>

                  <nav className="border-t border-fleek-border/70 p-1.5" role="none">
                    {accountMenuItems.map((item) => (
                      <Link
                        key={item.label}
                        to={item.to}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-amber-50"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-amber-50 text-base font-semibold text-fleek-primary"
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-fleek-text">
                            {item.label}
                          </span>
                          <span className="block truncate text-xs text-fleek-muted">
                            {item.description}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </nav>

                  <div className="border-t border-fleek-border/70 p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-red-50"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-50 text-base font-semibold text-red-600"
                      >
                        ↩
                      </span>
                      <span className="text-sm font-semibold text-red-600">Sign out</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full border border-fleek-border bg-white px-3 py-1.5 text-xs font-semibold text-fleek-text shadow-sm shadow-amber-900/5 transition hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:text-fleek-primary sm:inline-flex sm:px-4 sm:py-2 sm:text-sm"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1 rounded-full bg-fleek-primary px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-amber-900/10 transition hover:-translate-y-0.5 hover:bg-fleek-primary-dark hover:shadow-lg sm:px-4 sm:py-2 sm:text-sm"
              >
                Sign up
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
