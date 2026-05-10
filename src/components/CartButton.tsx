import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import {
  CART_UPDATED_EVENT,
  getCachedCartCount,
  getCart,
  type Cart,
} from '../lib/api/cart'

export function CartButton() {
  const isAuthed = useAppSelector((state) => Boolean(state.auth.accessToken))
  const initialCount = getCachedCartCount()
  const [cartCount, setCartCount] = useState(initialCount)
  const [bump, setBump] = useState(0)
  const prevCount = useRef(initialCount)

  useEffect(() => {
    const controller = new AbortController()
    getCart(controller.signal).catch(() => {})
    return () => controller.abort()
  }, [isAuthed])

  useEffect(() => {
    function onCart(event: Event) {
      const cart = (event as CustomEvent<Cart>).detail
      if (!cart) return
      setCartCount(cart.item_count)
    }
    window.addEventListener(CART_UPDATED_EVENT, onCart)
    return () => window.removeEventListener(CART_UPDATED_EVENT, onCart)
  }, [])

  useEffect(() => {
    if (cartCount > prevCount.current) setBump((n) => n + 1)
    prevCount.current = cartCount
  }, [cartCount])

  const hasItems = cartCount > 0

  return (
    <NavLink
      to="/cart"
      aria-label={hasItems ? `Cart (${cartCount} item${cartCount === 1 ? '' : 's'})` : 'Cart'}
      title="Cart"
      className={({ isActive }) =>
        `relative inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white text-fleek-text shadow-sm shadow-amber-900/5 transition hover:-translate-y-0.5 hover:border-fleek-primary/40 hover:text-fleek-primary ${
          isActive ? 'border-fleek-primary/50 text-fleek-primary' : 'border-fleek-border'
        }`
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="10" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
      </svg>
      {hasItems ? (
        <span
          key={bump}
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 animate-cart-bump items-center justify-center rounded-full bg-fleek-primary px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm shadow-amber-900/20"
        >
          {cartCount}
        </span>
      ) : null}
    </NavLink>
  )
}
