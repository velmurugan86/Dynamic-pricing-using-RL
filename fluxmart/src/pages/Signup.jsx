import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signUp({ email, password, fullName })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-4">Check your email</h1>
        <p className="text-brand-ink/70 font-medium mb-8">
          We sent a confirmation link to {email}. Confirm it, then log in.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-white font-semibold px-6 py-3"
        >
          Go to login →
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl mb-8 text-center">Create a profile</h1>
      <form onSubmit={handleSubmit} className="border-2 border-brand-ink rounded-2xl p-6 shadow-pop space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Full name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border-2 border-brand-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>
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
            minLength={6}
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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm mt-6">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold underline">
          Log in
        </Link>
      </p>
    </section>
  )
}
