'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const TRADES = ['Plumber', 'HVAC Contractor', 'Electrician', 'Roofer']

export default function LandingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    businessName: '',
    zipCode: '',
    trade: '',
  })
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'zipCode') {
      const digits = value.replace(/\D/g, '').slice(0, 5)
      setForm((prev) => ({ ...prev, zipCode: digits }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
    setError('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.businessName.trim() || !form.trade) {
      setError('Please fill in all fields.')
      return
    }
    if (form.zipCode.length !== 5) {
      setError('Please enter a valid 5-digit zip code.')
      return
    }
    const params = new URLSearchParams({
      name: form.businessName.trim(),
      zipCode: form.zipCode,
      trade: form.trade,
    })
    router.push(`/scanning?${params.toString()}`)
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Nav */}
      <nav className="px-6 py-4 border-b" style={{ borderColor: '#1a1a1a' }}>
        <img src="/convoa-logo.png" alt="Convoa" style={{ maxHeight: '40px' }} />
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center mb-10">
          <span
            className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-wide"
            style={{ backgroundColor: '#1a2e2a', color: '#49B29D' }}
          >
            Free Instant Scan
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4" style={{ color: '#ffffff' }}>
            Is Your Google Business Profile{' '}
            <span style={{ color: '#49B29D' }}>Costing You Jobs?</span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: '#888888' }}>
            We'll scan your profile in 60 seconds and show you exactly what's missing —
            so you can stop losing customers to competitors who look better online.
          </p>
        </div>

        {/* Form Card */}
        <div
          className="max-w-lg w-full rounded-2xl shadow-xl p-8 border"
          style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: '#ffffff' }}>Scan My Google Profile</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium mb-1" style={{ color: '#c9c9c9' }}>
                Business Name
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={form.businessName}
                onChange={handleChange}
                placeholder="e.g. Smith Plumbing Co."
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: '#0f0f0f',
                  color: '#e5e5e5',
                  border: '1px solid #333',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#49B29D')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
            </div>

            <div>
              <label htmlFor="zipCode" className="block text-sm font-medium mb-1" style={{ color: '#c9c9c9' }}>
                Zip Code
              </label>
              <input
                id="zipCode"
                name="zipCode"
                type="text"
                inputMode="numeric"
                value={form.zipCode}
                onChange={handleChange}
                placeholder="e.g. 78701"
                maxLength={5}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: '#0f0f0f',
                  color: '#e5e5e5',
                  border: '1px solid #333',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#49B29D')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              />
            </div>

            <div>
              <label htmlFor="trade" className="block text-sm font-medium mb-1" style={{ color: '#c9c9c9' }}>
                Trade
              </label>
              <select
                id="trade"
                name="trade"
                value={form.trade}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
                style={{
                  backgroundColor: '#0f0f0f',
                  color: form.trade ? '#e5e5e5' : '#666',
                  border: '1px solid #333',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#49B29D')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
              >
                <option value="" style={{ color: '#666' }}>Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t} value={t} style={{ color: '#e5e5e5', backgroundColor: '#1a1a1a' }}>{t}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
            )}

            <button
              type="submit"
              className="w-full font-semibold py-3 rounded-lg text-sm tracking-wide mt-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#49B29D', color: '#0a0a0a' }}
            >
              Scan My Profile
            </button>
          </form>

          <p className="text-xs text-center mt-4" style={{ color: '#555' }}>
            Free. No credit card required. Takes about 60 seconds.
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm" style={{ color: '#555' }}>
          <span>✓ Google-verified data</span>
          <span>✓ Instant results</span>
          <span>✓ Built for trades businesses</span>
        </div>
      </section>

      <footer className="text-center py-6 text-xs border-t" style={{ color: '#444', borderColor: '#1a1a1a' }}>
        © {new Date().getFullYear()} Convoa. All rights reserved.
      </footer>
    </main>
  )
}
