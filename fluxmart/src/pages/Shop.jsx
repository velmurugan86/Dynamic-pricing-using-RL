import React from 'react'
import ProductGrid from '../components/ProductGrid'

export default function Shop() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-4xl mb-2">The shop</h1>
      <p className="text-brand-ink/70 font-medium mb-10 max-w-lg">
        Every price below comes straight from the products table and is
        recalculated by the DQN model every hour. Click a product to see its
        full pricing metrics.
      </p>
      <ProductGrid />
    </section>
  )
}
