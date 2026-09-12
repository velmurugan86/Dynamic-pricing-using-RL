import React from 'react'
import { Link } from 'react-router-dom'
import {
  TeeIcon,
  SneakerIcon,
  BackpackIcon,
  HeadphonesIcon,
  GamepadIcon,
  EarbudsIcon,
  KeyboardIcon,
  WatchIcon
} from './HeroDoodles'

// Simple product icons floating around the hero — minimal, clean, spread
// evenly down both sides of the page.
const TILES = [
  { Icon: TeeIcon, cls: 'top-[10%] left-[3%] w-36 rotate-[-7deg]' },
  { Icon: BackpackIcon, cls: 'top-[42%] left-[1.5%] w-32 rotate-[5deg]' },
  { Icon: SneakerIcon, cls: 'bottom-[10%] left-[4%] w-40 rotate-[4deg]' },
  { Icon: GamepadIcon, cls: 'top-[8%] right-[3%] w-40 rotate-[6deg]' },
  { Icon: EarbudsIcon, cls: 'top-[42%] right-[1.5%] w-36 rotate-[-5deg]' },
  { Icon: HeadphonesIcon, cls: 'bottom-[8%] right-[4%] w-32 rotate-[-4deg]' },
  { Icon: KeyboardIcon, cls: 'top-[24%] left-[9%] w-28 rotate-[4deg]' },
  { Icon: WatchIcon, cls: 'top-[26%] right-[9%] w-28 rotate-[-4deg]' }
]

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-green bg-grid bg-grid">
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        {TILES.map(({ Icon, cls }, i) => (
          <div key={i} aria-hidden="true" className={`hidden lg:block absolute ${cls}`}>
            <Icon />
          </div>
        ))}

        <div className="relative mx-auto max-w-2xl text-center">
          <p className="mb-4 text-sm font-bold tracking-wide">
            A SMALL STORE WHERE PRICES
          </p>
          <h1 className="font-display leading-[0.95] text-5xl md:text-7xl">
            <span className="block">Rise</span>
            <span className="block">Fall</span>
            <span className="mt-2 inline-block bg-brand-ink px-4 py-1 text-brand-cream">
              In Real Time
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-md text-base md:text-lg font-medium">
            One DQN pricing model. Every price you see is recalculated from
            demand, inventory, and season — not set by us.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-white font-semibold px-6 py-3 shadow-pop hover:translate-y-0.5 hover:shadow-popsm transition-all"
            >
              Browse the shop <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-brand-ink bg-brand-cream py-4 overflow-hidden">
        <div className="flex whitespace-nowrap animate-[marquee_22s_linear_infinite] font-display text-2xl md:text-4xl gap-10">
          {Array(4)
            .fill(['LIVE PRICING', 'DQN MODEL', 'REAL INVENTORY', 'SMART PRICES'])
            .flat()
            .map((t, i) => (
              <span key={i} className="flex items-center gap-10">
                {t} <span className="text-brand-green">●</span>
              </span>
            ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
