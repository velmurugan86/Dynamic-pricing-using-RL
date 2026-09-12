import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatINR } from '../lib/formatINR'

export default function PricingLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('price_history')
      .select('id, old_price, new_price, source, changed_at, products ( name )')
      .order('changed_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows(data)
        setLoading(false)
      })
  }, [])

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">Pricing log</h1>
      <p className="text-brand-ink/70 font-medium mb-10">
        Every price change the DQN model has made, most recent first.
      </p>

      {loading && <p className="font-medium">Loading…</p>}
      {error && <p className="font-medium text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="border-2 border-brand-ink rounded-2xl overflow-hidden shadow-pop">
          <table className="w-full text-sm">
            <thead className="bg-brand-ink text-white">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Old price</th>
                <th className="text-left font-semibold px-4 py-3">New price</th>
                <th className="text-left font-semibold px-4 py-3">Source</th>
                <th className="text-left font-semibold px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-brand-ink/60">
                    No price changes yet — recalculate a product from the shop.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const delta = r.new_price - r.old_price
                return (
                  <tr key={r.id} className="border-t border-brand-ink/20">
                    <td className="px-4 py-3 font-medium">{r.products?.name ?? '—'}</td>
                    <td className="px-4 py-3">{formatINR(r.old_price)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatINR(r.new_price)}{' '}
                      <span className={delta >= 0 ? 'text-red-600' : 'text-green-700'}>
                        ({delta >= 0 ? '+' : '−'}
                        {formatINR(Math.abs(delta))})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink/60">{r.source}</td>
                    <td className="px-4 py-3 text-brand-ink/60">
                      {new Date(r.changed_at).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
