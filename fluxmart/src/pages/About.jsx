import React from 'react'

export default function About() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-4xl mb-6">About Fluxmart</h1>
      <p className="font-medium text-brand-ink/80 leading-relaxed mb-4">
        Fluxmart is a small storefront where prices aren't fixed by a
        spreadsheet — they're set by a reinforcement-learning model. Each
        product carries live signals: how much stock is left, how the season
        is trending, how demand has moved recently, and how sensitive buyers
        are to price. The model takes those in and returns what it thinks the
        price should be right now.
      </p>
      <p className="font-medium text-brand-ink/80 leading-relaxed">
        Every change is logged, so you can watch the reasoning play out over
        time on the pricing log page.
      </p>
    </section>
  )
}
