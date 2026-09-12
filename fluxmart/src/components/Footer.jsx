import React from 'react'

export default function Footer() {
  return (
    <footer className="border-t-2 border-brand-ink mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="rounded-full bg-brand-yellow border-2 border-brand-ink px-4 py-1.5 font-display text-sm">
          FLUXMART
        </span>
        <p className="text-sm font-medium text-brand-ink/60">
          Prices recalculated live by a DQN pricing model. Built as a demo storefront.
        </p>
      </div>
    </footer>
  )
}
