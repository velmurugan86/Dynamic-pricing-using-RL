import React from 'react'
import { formatINR } from '../lib/formatINR'

/** Returns the % change from base to current, rounded to 1 decimal place. */
function priceChangePct(base, current) {
  if (!base || base === 0) return null
  return (((current - base) / base) * 100).toFixed(1)
}

export default function ProductCard({ product, onAddClick }) {
  const lowStock = product.inventory_count > 0 && product.inventory_count <= 5
  const outOfStock = product.inventory_count <= 0

  const pct = priceChangePct(product.base_price, product.current_price)
  const increased = pct !== null && Number(pct) > 0
  const decreased = pct !== null && Number(pct) < 0

  return (
    <div className="polaroid bg-white group">
      <div className="relative aspect-square w-full overflow-hidden border-2 border-brand-ink bg-brand-cream">
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover"
        />
        {outOfStock && (
          <span className="absolute top-2 left-2 rounded-full bg-brand-ink text-white text-xs font-bold px-3 py-1">
            SOLD OUT
          </span>
        )}
        {!outOfStock && lowStock && (
          <span className="absolute top-2 left-2 rounded-full bg-brand-yellow border-2 border-brand-ink text-xs font-bold px-3 py-1">
            LOW STOCK
          </span>
        )}
      </div>

      <div className="px-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base leading-tight">{product.name}</h3>
          <div className="text-right shrink-0">
            <p className="font-display text-lg">{formatINR(product.current_price)}</p>
            {/* Price change indicator */}
            {increased && (
              <span
                className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5 mt-0.5"
                title={`Up from ${formatINR(product.base_price)}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3 h-3"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 2a.75.75 0 0 1 .6.3l4.5 6a.75.75 0 0 1-.6 1.2H3.5a.75.75 0 0 1-.6-1.2l4.5-6A.75.75 0 0 1 8 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                +{pct}%
              </span>
            )}
            {decreased && (
              <span
                className="inline-flex items-center gap-0.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5 mt-0.5"
                title={`Down from ${formatINR(product.base_price)}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3 h-3"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 14a.75.75 0 0 1-.6-.3l-4.5-6a.75.75 0 0 1 .6-1.2h9a.75.75 0 0 1 .6 1.2l-4.5 6A.75.75 0 0 1 8 14Z"
                    clipRule="evenodd"
                  />
                </svg>
                {pct}%
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-brand-ink/70">{product.description}</p>

        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-brand-ink/60">
          <span>{product.inventory_count} in stock</span>
          <span>{product.category}</span>
        </div>

        <button
          onClick={() => onAddClick?.(product)}
          disabled={outOfStock}
          className="mt-3 w-full rounded-full bg-brand-ink text-white text-sm font-semibold py-2 hover:bg-black/80 disabled:opacity-50 transition-colors"
        >
          {outOfStock ? 'Out of stock' : 'Add to cart'}
        </button>
      </div>
    </div>
  )
}
