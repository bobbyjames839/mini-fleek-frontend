import { apiFetch } from './client'
import { clearCartCache } from './cart'

export interface ShippingAddress {
  full_name: string
  line1: string
  line2: string | null
  city: string
  postcode: string
  country: string
}

export interface OrderLineItem {
  id: string
  product_id: string
  product_name: string
  product_slug: string
  primary_photo: string | null
  vendor_name: string
  piece_count: number
  quantity: number
  unit_price: number
  line_total: number
}

export interface Order {
  id: string
  status: 'placed' | 'shipped' | 'cancelled'
  created_at: string
  shipping_address: ShippingAddress
  items: OrderLineItem[]
  subtotal: number
  total: number
}

export async function placeOrder(shipping_address: ShippingAddress) {
  const res = await apiFetch<{ order: Order }>('/checkout', {
    method: 'POST',
    auth: true,
    json: { shipping_address },
  })
  // Server clears the cart on success; mirror that on the client.
  clearCartCache()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fleek:cart-updated', {
        detail: { items: [], subtotal: 0, item_count: 0 },
      }),
    )
  }
  return res
}

export function getOrder(id: string, signal?: AbortSignal) {
  return apiFetch<{ order: Order }>(`/orders/${id}`, { auth: true, signal })
}

export interface OrderSummary {
  id: string
  status: Order['status']
  subtotal: number
  total: number
  item_count: number
  created_at: string
}

export function listOrders(signal?: AbortSignal) {
  return apiFetch<{ orders: OrderSummary[] }>('/orders', { auth: true, signal })
}
