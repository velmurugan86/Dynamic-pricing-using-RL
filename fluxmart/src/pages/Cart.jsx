import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductsContext'
import { supabase } from '../lib/supabaseClient'
import { formatINR } from '../lib/formatINR'

export default function Cart() {
  const { items, setQty, removeItem, clear, total } = useCart()
  const { refresh } = useProducts()
  const { user } = useAuth()
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [error, setError] = useState(null)

  async function handleCheckout() {
    setPlacing(true)
    setError(null)
    try {
      // Demo checkout: create the order + items in one RPC call.
      // No payment processing — this is a demonstration storefront.
      const { data: orderId, error: rpcError } = await supabase.rpc('place_order', {
        p_items: items.map((i) => ({ product_id: i.id, quantity: i.qty, unit_price: i.current_price }))
      })
      if (rpcError) throw rpcError

      setPlaced({ orderId, count: items.length, total })
      // Pull fresh stock counts into the UI immediately — the order
      // already decremented inventory in the database.
      refresh()
      clear()
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  if (placed) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl mb-4">Order placed! 🎉</h1>
        <p className="text-brand-ink/70 font-medium mb-2">
          {placed.count} item{placed.count === 1 ? '' : 's'} ordered — total{' '}
          {formatINR(placed.total ?? 0)}. This is a demo, so no payment was taken.
        </p>
        <p className="text-xs text-brand-ink/50 mb-8">Order ref: {placed.orderId}</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/orders"
            className="inline-block rounded-full bg-brand-ink text-white font-semibold px-6 py-3 hover:bg-black/80 transition-colors"
          >
            View your orders →
          </Link>
          <Link
            to="/shop"
            className="inline-block rounded-full border-2 border-brand-ink font-semibold px-6 py-3 hover:bg-brand-yellow transition-colors"
          >
            Keep shopping
          </Link>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl mb-4">Your cart is empty</h1>
        <p className="text-brand-ink/70 font-medium mb-8">
          Head to the shop and add something — prices update every hour.
        </p>
        <Link
          to="/shop"
          className="inline-block rounded-full bg-brand-ink text-white font-semibold px-6 py-3 hover:bg-black/80 transition-colors"
        >
          Browse the shop →
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl mb-8">Your cart</h1>

      <div className="border-2 border-brand-ink rounded-2xl overflow-hidden shadow-pop bg-white">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 border-b-2 border-brand-ink/10 p-4 last:border-b-0"
          >
            <img
              src={item.image_url}
              alt={item.name}
              className="h-16 w-16 rounded-lg object-cover border-2 border-brand-ink"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm leading-tight truncate">{item.name}</p>
              <p className="text-sm text-brand-ink/60">{formatINR(item.current_price)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(item.id, item.qty - 1)}
                className="h-8 w-8 rounded-full border-2 border-brand-ink font-bold hover:bg-brand-yellow transition-colors"
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{item.qty}</span>
              <button
                onClick={() => setQty(item.id, item.qty + 1)}
                className="h-8 w-8 rounded-full border-2 border-brand-ink font-bold hover:bg-brand-yellow transition-colors"
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </button>
            </div>
            <p className="w-24 text-right font-display">{formatINR(item.current_price * item.qty)}</p>
            <button
              onClick={() => removeItem(item.id)}
              className="text-brand-ink/40 hover:text-red-600 font-bold px-1"
              aria-label={`Remove ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}

        <div className="flex items-center justify-between bg-brand-cream p-4 border-t-2 border-brand-ink">
          <span className="font-display text-lg">Total</span>
          <span className="font-display text-2xl">{formatINR(total)}</span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 sm:justify-end">
        {!user && (
          <p className="text-xs text-brand-ink/50 sm:mr-auto">
            You'll need to log in first — the demo order is saved to your account.
          </p>
        )}
        <button
          onClick={handleCheckout}
          disabled={placing || !user}
          className="w-full sm:w-auto rounded-full bg-brand-ink text-white font-semibold px-8 py-3 hover:bg-black/80 disabled:opacity-50 transition-colors"
        >
          {placing ? 'Placing order…' : user ? 'Place order (demo)' : 'Log in to check out'}
        </button>
      </div>
    </section>
  )
}
