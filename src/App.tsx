import { useEffect, useLayoutEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { ProductListPage } from './pages/ProductListPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { AiSearchBar } from './components/AiSearchBar'
import { useAppDispatch } from './store/hooks'
import { loadCatalog } from './store/catalogSlice'

const HIDE_AI_SEARCH_ON = new Set(['/login', '/signup', '/checkout'])

// Reset scroll to the top whenever the route changes. Without this, navigating
// from a long list page to a detail page lands the user mid-page (browsers
// preserve the previous scroll on SPA pushState navigation). Skipped when the
// browser is restoring a back/forward navigation, so back-button scroll
// position still feels right. useLayoutEffect avoids a paint flash.
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function App() {
  const dispatch = useAppDispatch()
  const location = useLocation()

  useEffect(() => {
    dispatch(loadCatalog())
  }, [dispatch])

  const showAiSearch = !HIDE_AI_SEARCH_ON.has(location.pathname)

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAiSearch ? <AiSearchBar /> : null}
    </>
  )
}

export default App
