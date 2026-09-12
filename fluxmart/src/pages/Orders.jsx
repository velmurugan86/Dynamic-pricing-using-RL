import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatINR } from '../lib/formatINR'

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('orders')
      .select(
        `id, status, total_amount, created_at,
         order_items ( id, quantity, unit_price, products ( name, image_url ) )`
      )
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setOrders(data)
        setLoading(false)
      })
  }, [user])

  if (!user) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl mb-4">Your orders</h1>
        <p className="text-brand-ink/70 font-medium mb-8">
          Log in to see the orders you've placed.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-full bg-brand-ink text-white font-semibold px-6 py-3 hover:bg-black/80 transition-colors"
        >
          Log in →
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">Your orders</h1>
      <p className="text-brand-ink/70 font-medium mb-10">
        Every order you've placed in this demo store.
      </p>

      {loading && <p className="font-medium">Loading orders…</p>}
      {error && <p className="font-medium text-red-600">{error}</p>}

      {!loading && !error && orders.length === 0 && (
        <p className="font-medium text-brand-ink/60">
          No orders yet — <Link to="/shop" className="underline">pick something from the shop</Link>.
        </p>
      )}

      <div className="space-y-6">
        {orders.map((order) => (
          <div
            key={order.id}
            className="border-2 border-brand-ink rounded-2xl overflow-hidden shadow-pop bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-cream border-b-2 border-brand-ink px-4 py-3 text-sm">
              <div>
                <p className="font-display">
                  Order #{order.id.slice(0, 8)}
                </p>
                <p className="text-brand-ink/60">
                  {new Date(order.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold border-2 border-brand-ink ${
                    order.status === 'paid'
                      ? 'bg-brand-green'
                      : order.status === 'pending'
                        ? 'bg-brand-yellow'
                        : 'bg-brand-ink/10'
                  }`}
                >
                  {order.status.toUpperCase()}
                </span>
                <span className="font-display text-lg">{formatINR(order.total_amount)}</span>
              </div>
            </div>

            <div>
              {order.order_items?.length === 0 && (
                <p className="px-4 py-3 text-sm text-brand-ink/60">No items recorded.</p>
              )}
              {(order.order_items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-brand-ink/10 last:border-b-0"
                >
                  <img
                    src={item.products?.image_url}
                    alt={item.products?.name ?? 'Product'}
                    className="h-12 w-12 rounded-lg object-cover border-2 border-brand-ink"
                  />
                  <p className="flex-1 font-medium truncate">
                    {item.products?.name ?? 'Deleted product'}
                  </p>
                  <p className="text-sm text-brand-ink/60">× {item.quantity}</p>
                  <p className="w-28 text-right font-display text-sm">
                    {formatINR(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
