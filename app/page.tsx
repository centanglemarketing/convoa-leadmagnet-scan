'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const TRADES = ['Plumber', 'HVAC Contractor', 'Electrician', 'Roofer']

export default function LandingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    businessName: '',
    city: '',
    state: '',
    trade: '',
  })
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.businessName.trim() || !form.city.trim() || !form.state || !form.trade) {
      setError('Please fill in all fields.')
      return
    }
    const params = new URLSearchParams({
      name: form.businessName.trim(),
      city: form.city.trim(),
      state: form.state,
      trade: form.trade,
    })
    router.push(`/scanning?${params.toString()}`)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-xl font-bold text-indigo-600 tracking-tight">Convoa</span>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full text-center mb-10">
          <span className="inline-block bg-indigo-50 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-wide">
            Free Instant Scan
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Is Your Google Business Profile{' '}
            <span className="text-indigo-600">Costing You Jobs?</span>
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            We'll scan your profile in 60 seconds and show you exactly what's missing —
            so you can stop losing customers to competitors who look better online.
          </p>
        </div>

        {/* Form Card */}
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Scan My Google Profile</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={form.businessName}
                onChange={handleChange}
                placeholder="e.g. Smith Plumbing Co."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Austin"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="trade" className="block text-sm font-medium text-gray-700 mb-1">
                Trade
              </label>
              <select
                id="trade"
                name="trade"
                value={form.trade}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors text-sm tracking-wide mt-2"
            >
              Scan My Profile
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            Free. No credit card required. Takes about 60 seconds.
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap justify-center gap-8 text-sm text-gray-400">
          <span>✓ Google-verified data</span>
          <span>✓ Instant results</span>
          <span>✓ Built for trades businesses</span>
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-200">
        © {new Date().getFullYear()} Convoa. All rights reserved.
      </footer>
    </main>
  )
}
