import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import {
  CART_UPDATED_EVENT,
  getCachedCartCount,
  getCart,
  setCachedCartCount,
  type Cart,
} from '../lib/api/cart'

const baseMenuItems = [
  { label: 'Home', path: '/' },
  { label: 'Products', path: '/products' },
]
const authedMenuItems = [
  { label: 'Cart', path: '/cart' },
  { label: 'Orders', path: '/orders' },
]

export function MainMenu() {
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))
  const initialCount = isAuthed ? getCachedCartCount() : 0
  const [cartCount, setCartCount] = useState(initialCount)
  const [bump, setBump] = useState(0)
  const prevCount = useRef(initialCount)

  // Pull cart count whenever auth changes (and clear it on sign-out).
  useEffect(() => {
    if (!isAuthed) {
      setCachedCartCount(0)
      setCartCount(0)
      prevCount.current = 0
      return
    }
    const controller = new AbortController()
    getCart(controller.signal).catch(() => {
      // Silent — header badge isn't critical; broadcast handler also fires on success.
    })
    return () => controller.abort()
  }, [isAuthed])

  // Listen for cart mutations broadcast by the api wrappers.
  useEffect(() => {
    function onCart(event: Event) {
      const cart = (event as CustomEvent<Cart>).detail
      if (!cart) return
      setCartCount(cart.item_count)
    }
    window.addEventListener(CART_UPDATED_EVENT, onCart)
    return () => window.removeEventListener(CART_UPDATED_EVENT, onCart)
  }, [])

  // Trigger the bump animation when the count grows.
  useEffect(() => {
    if (cartCount > prevCount.current) setBump((n) => n + 1)
    prevCount.current = cartCount
  }, [cartCount])

  return (
    <nav className="flex flex-wrap items-center justify-center gap-3 md:gap-6" aria-label="Primary">
      {[...baseMenuItems, ...(isAuthed ? authedMenuItems : [])].map((item) => {
        const isCart = item.path === '/cart'
        const hasItems = isCart && cartCount > 0
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `relative rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-fleek-text shadow-sm shadow-amber-900/10 ring-1 ring-fleek-border/80'
                  : hasItems
                    ? 'text-fleek-primary hover:bg-amber-50'
                    : 'text-fleek-muted hover:bg-white/60 hover:text-fleek-text'
              }`
            }
          >
            <span className="inline-flex items-center gap-2">
              {item.label}
              {isCart && hasItems ? (
                <span
                  key={bump}
                  aria-label={`${cartCount} item${cartCount === 1 ? '' : 's'} in cart`}
                  className="inline-flex h-5 min-w-5 animate-cart-bump items-center justify-center rounded-full bg-fleek-primary px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm shadow-amber-900/20"
                >
                  {cartCount}
                </span>
              ) : null}
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
