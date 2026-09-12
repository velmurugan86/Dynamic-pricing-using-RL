import React, { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext'
import { formatINR } from '../lib/formatINR'

export default function AddToCartModal({ product, onClose }) {
  const { addItem } = useCart()
  const [qty, setQty] = useState(1)
  const stock = product.inventory_count ?? 0

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!product || stock <= 0) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-ink/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Choose quantity for ${product.name}`}
    >
      <div
        className="relative w-full max-w-xs bg-white border-2 border-brand-ink rounded-2xl shadow-pop p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg leading-tight pr-6">{product.name}</h2>
        <p className="text-xs font-semibold text-brand-ink/50 mt-0.5">
          {stock} in stock · {formatINR(product.current_price)} each
        </p>

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full border-2 border-brand-ink font-bold hover:bg-brand-yellow transition-colors"
        >
          ✕
        </button>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-full border-2 border-brand-ink font-bold hover:bg-brand-yellow transition-colors"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={stock}
            value={qty}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isNaN(v)) return setQty(1)
              setQty(Math.min(Math.max(v, 1), stock))
            }}
            className="w-16 text-center font-display text-lg border-2 border-brand-ink rounded-lg py-1"
            aria-label="Quantity"
          />
          <button
            onClick={() => setQty((q) => Math.min(stock, q + 1))}
            className="h-9 w-9 rounded-full border-2 border-brand-ink font-bold hover:bg-brand-yellow transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-semibold">
          Total: {formatINR(product.current_price * qty)}
        </p>

        <button
          onClick={() => {
            addItem(product, qty)
            onClose()
          }}
          className="mt-4 w-full rounded-full bg-brand-ink text-white text-sm font-semibold py-2.5 hover:bg-black/80 transition-colors"
        >
          Add to cart
        </button>
      </div>
    </div>
  )
}
