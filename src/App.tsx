import { useEffect } from 'react'
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

function App() {
  const dispatch = useAppDispatch()
  const location = useLocation()

  useEffect(() => {
    dispatch(loadCatalog())
  }, [dispatch])

  const showAiSearch = !HIDE_AI_SEARCH_ON.has(location.pathname)

  return (
    <>
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
