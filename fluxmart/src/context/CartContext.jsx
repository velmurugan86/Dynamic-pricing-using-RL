import React, { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'fluxmart_cart_v1'

function clamp(qty, stock) {
  return Math.max(1, Math.min(qty, stock))
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  /**
   * Add a product with a specific quantity, clamped to available stock.
   * qty defaults to 1; stock comes from the product row at add time.
   */
  function addItem(product, qty = 1) {
    const stock = product.inventory_count ?? 0
    if (stock <= 0) return
    const wanted = clamp(Math.round(qty) || 1, stock)

    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      const currentQty = existing ? existing.qty : 0
      const newQty = clamp(currentQty + wanted, stock)

      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: newQty } : i))
      }
      return [...prev, { ...product, qty: newQty }]
    })
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  /** Manual qty change from the cart page, clamped to the product's stock. */
  function setQty(id, qty) {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.id !== id)
      return prev.map((i) => (i.id === id ? { ...i, qty: clamp(qty, i.inventory_count ?? 99) } : i))
    })
  }

  function clear() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.current_price * i.qty, 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  const value = { items, addItem, removeItem, setQty, clear, total, count }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside a CartProvider')
  return ctx
}
