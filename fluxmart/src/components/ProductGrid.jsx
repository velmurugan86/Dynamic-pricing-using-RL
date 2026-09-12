import React, { useState } from 'react'
import { useProducts } from '../context/ProductsContext'
import ProductCard from './ProductCard'
import AddToCartModal from './AddToCartModal'

export default function ProductGrid({ limit }) {
  const { products, loading, error } = useProducts()
  const [qtyProduct, setQtyProduct] = useState(null)

  const visible = limit ? products.slice(0, limit) : products

  if (loading) return <p className="text-center py-12 font-medium">Loading products…</p>
  if (error) return <p className="text-center py-12 font-medium text-red-600">{error}</p>
  if (products.length === 0)
    return (
      <p className="text-center py-12 font-medium">
        No products yet — run the seed script in <code>supabase/seed.sql</code>.
      </p>
    )

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-10">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} onAddClick={setQtyProduct} />
        ))}
      </div>

      {qtyProduct && <AddToCartModal product={qtyProduct} onClose={() => setQtyProduct(null)} />}
    </>
  )
}
