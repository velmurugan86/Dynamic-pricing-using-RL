import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getRepricingSuggestion, confirmPriceApplied } from '../api/pricingModel'

const ProductsContext = createContext(null)

const REPRICE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRepricedAt, setLastRepricedAt] = useState(null)
  const repricingRef = useRef(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) setError(error.message)
      else setProducts(data)
      setLoading(false)
    }
    load()
  }, [])

  async function repriceAll() {
    if (repricingRef.current) return
    repricingRef.current = true
    try {
      const { data: current, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error

      const results = await Promise.allSettled(
        current.map(async (product) => {
          const { new_price, raw } = await getRepricingSuggestion(product)

          // Audit log of the raw model exchange.
          await supabase.from('model_requests_log').insert({
            product_id: product.id,
            route: 'predict',
            request_payload: {
              current_price: product.current_price,
              remaining_inventory: product.inventory_count,
              historical_demand: product.historical_demand,
              current_demand: product.current_demand,
              seasonality: product.seasonality_factor,
              price_elasticity: product.price_elasticity,
              demand_velocity: product.demand_velocity
            },
            response_payload: raw
          })

          // Apply new price + price_history atomically via RPC.
          const { error: rpcError } = await supabase.rpc('apply_price_update', {
            p_product_id: product.id,
            p_new_price: new_price,
            p_source: 'dqn_model'
          })
          if (rpcError) throw rpcError

          await confirmPriceApplied({
            product,
            oldPrice: product.current_price,
            newPrice: new_price,
            applied: true,
            unitsSold: 0  // No sale — this is a scheduled reprice
          })

          return { ...product, current_price: new_price }
        })
      )

      setProducts((prev) =>
        prev.map((p) => {
          const r = results.find((res) => res.value?.id === p.id)
          return r && r.status === 'fulfilled' ? r.value : p
        })
      )
      setLastRepricedAt(new Date())
    } catch (err) {
      // Surface the error but never crash the cycle — next tick retries.
      console.warn('Hourly repricing cycle failed:', err.message)
    } finally {
      repricingRef.current = false
    }
  }

  // Run the cycle hourly.
  useEffect(() => {
    const interval = setInterval(repriceAll, REPRICE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const value = {
    products: loading ? [] : products,
    loading,
    error,
    lastRepricedAt,
    repriceAll,  // Exposed so Cart can trigger immediate repricing after feedback
    updateProductPrice: (id, price) =>
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, current_price: price } : p))),
    /** Re-fetch products from the DB (after checkout decrements stock). */
    refresh: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true })
      if (!error && data) {
        setProducts(data)
        return data
      }
      return null
    }
  }

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used inside a ProductsProvider')
  return ctx
}
