import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn({ email, password })
      navigate('/shop')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl mb-8 text-center">Log in</h1>
      <form onSubmit={handleSubmit} className="border-2 border-brand-ink rounded-2xl p-6 shadow-pop space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand-ink text-white font-semibold py-2.5 hover:bg-black/80 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="text-center text-sm mt-6">
        No account yet?{' '}
        <Link to="/signup" className="font-semibold underline">
          Sign up
        </Link>
      </p>
    </section>
  )
}
