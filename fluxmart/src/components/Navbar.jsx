import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const LINKS = [
  { label: 'Shop', to: '/shop' },
  { label: 'Model Inputs', to: '/model-inputs' },
  { label: 'Pricing Log', to: '/pricing-log' },
  { label: 'About', to: '/about' }
]

export default function Navbar() {
  const { user, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="sticky top-4 z-50 px-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-white border-2 border-brand-ink px-4 py-2 shadow-pop">
        <Link to="/" className="flex items-center">
          <span className="rounded-full bg-brand-yellow border-2 border-brand-ink px-4 py-1.5 font-display text-lg tracking-tight">
            FLUXMART
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm font-semibold tracking-wide">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:opacity-60 transition-opacity">
              {l.label.toUpperCase()}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/orders"
            className="rounded-full border-2 border-brand-ink px-4 py-2 text-sm font-semibold hover:bg-brand-ink hover:text-white transition-colors hidden sm:block"
          >
            Orders
          </Link>
          <Link
            to="/cart"
            className="relative flex items-center gap-1.5 rounded-full border-2 border-brand-ink bg-brand-yellow px-4 py-2 text-sm font-semibold hover:bg-brand-ink hover:text-white transition-colors"
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            Cart
            {count > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-ink text-white text-[10px] font-bold px-1">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <>
              <span className="hidden sm:inline text-sm font-medium px-2">
                {user.user_metadata?.full_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-full bg-brand-ink text-white text-sm font-semibold px-5 py-2 hover:bg-black/80 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold px-4 py-2 hover:opacity-60 transition-opacity"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="flex items-center gap-1 rounded-full bg-brand-ink text-white text-sm font-semibold px-5 py-2 hover:bg-black/80 transition-colors"
              >
                Sign up <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}
