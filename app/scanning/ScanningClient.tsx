'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const STEPS = [
  'Finding your business on Google...',
  'Checking your star rating and reviews...',
  'Auditing profile completeness...',
  'Comparing against local competitors...',
  'Analyzing customer feedback...',
  'Generating your report...',
]

export default function ScanningClient() {
  const params = useSearchParams()
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const businessName = params.get('name') || ''
  const zipCode = params.get('zipCode') || ''
  const trade = params.get('trade') || ''

  useEffect(() => {
    if (!businessName || !zipCode || !trade) {
      router.replace('/')
      return
    }

    // Cycle through step labels for UX while scan runs
    const stepTimer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
    }, 8000)

    async function runScan() {
      try {
        // Step 1: Main profile scan
        const scanRes = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName, zipCode, trade }),
        })

        if (!scanRes.ok) {
          const err = await scanRes.json()
          throw new Error(err.error || 'Scan failed')
        }

        const scanData = await scanRes.json()

        // Steps 2 & 3: Reviews and competitors run in parallel
        const [reviewsRes, competitorsRes] = await Promise.all([
          fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeId: scanData.placeId }),
          }),
          fetch('/api/competitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trade,
              zipCode,
              placeId: scanData.placeId,
            }),
          }),
        ])

        const reviewsData = reviewsRes.ok
          ? await reviewsRes.json()
          : { commFailCount: 0, matchingReviews: [], recentReviewCount: 0, totalFetchedReviews: 0 }

        const competitorsData = competitorsRes.ok
          ? await competitorsRes.json()
          : { competitors: [] }

        // Store combined results in sessionStorage
        // city and state come from the Places API response (scanData)
        const result = {
          formBusinessName: businessName,
          zipCode,
          city: scanData.city ?? '',
          state: scanData.state ?? '',
          trade,
          ...scanData,
          commFailCount: reviewsData.commFailCount,
          matchingReviews: reviewsData.matchingReviews,
          recentReviewCount: reviewsData.recentReviewCount,
          totalFetchedReviews: reviewsData.totalFetchedReviews,
          competitors: competitorsData.competitors,
        }

        sessionStorage.setItem('scanResult', JSON.stringify(result))
        router.push('/results')
      } catch (err: unknown) {
        clearInterval(stepTimer)
        const msg = err instanceof Error ? err.message : 'Something went wrong'
        setErrorMsg(msg)
      }
    }

    runScan()

    return () => clearInterval(stepTimer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (errorMsg === 'Business not found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="rounded-2xl shadow-lg p-8 max-w-lg w-full border" style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2a2010' }}>
              <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-center mb-2" style={{ color: '#ffffff' }}>
            We couldn't find your business on Google Maps
          </h2>
          <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: '#888' }}>
            Don't worry — this happens. Here are the two most common reasons:
          </p>

          {/* Reasons */}
          <div className="space-y-3 mb-7">
            <div className="flex gap-3 items-start rounded-xl px-4 py-3.5 border" style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a' }}>
              <span className="font-bold text-sm mt-0.5 shrink-0" style={{ color: '#49B29D' }}>1</span>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#e5e5e5' }}>Small spelling difference</p>
                <p className="text-sm leading-relaxed" style={{ color: '#888' }}>
                  Double-check that the name matches <span className="font-medium" style={{ color: '#c9c9c9' }}>exactly</span> how
                  it appears on Google Maps — including punctuation, "LLC", or abbreviations.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start rounded-xl px-4 py-3.5 border" style={{ backgroundColor: '#0f0f0f', borderColor: '#2a2a2a' }}>
              <span className="font-bold text-sm mt-0.5 shrink-0" style={{ color: '#49B29D' }}>2</span>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#e5e5e5' }}>Your business isn't listed yet</p>
                <p className="text-sm leading-relaxed" style={{ color: '#888' }}>
                  Being listed on Google is <span className="font-medium" style={{ color: '#c9c9c9' }}>free and takes 5 minutes</span>.
                  Go to{' '}
                  <a
                    href="https://business.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 font-medium"
                    style={{ color: '#49B29D' }}
                  >
                    google.com/business
                  </a>
                  {' '}and click <span className="font-medium" style={{ color: '#c9c9c9' }}>Manage Now</span> to get started.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full font-semibold py-3 rounded-xl transition-opacity hover:opacity-90 text-sm"
            style={{ backgroundColor: '#49B29D', color: '#0a0a0a' }}
          >
            Try Again
          </button>
          <p className="text-xs text-center mt-3" style={{ color: '#555' }}>
            Searched for: <span className="font-medium" style={{ color: '#888' }}>{businessName}</span> near {zipCode}
          </p>
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="rounded-2xl shadow-lg p-10 max-w-md w-full text-center border" style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#ffffff' }}>Something went wrong</h2>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            We hit an unexpected error during the scan. Please try again — it usually works on the second attempt.
          </p>
          <button
            onClick={() => router.push('/')}
            className="font-semibold px-6 py-2.5 rounded-lg transition-opacity hover:opacity-90 text-sm"
            style={{ backgroundColor: '#49B29D', color: '#0a0a0a' }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="rounded-2xl shadow-lg p-10 max-w-md w-full text-center border" style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}>
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <svg
            className="animate-spin-slow w-14 h-14"
            style={{ color: '#49B29D' }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold mb-1" style={{ color: '#ffffff' }}>
          Scanning your Google Business Profile...
        </h2>
        <p className="text-sm mb-8" style={{ color: '#888' }}>
          Scanning <span className="font-semibold" style={{ color: '#c9c9c9' }}>{businessName}</span> near{' '}
          {zipCode}
        </p>

        {/* Progress bar */}
        <div className="w-full rounded-full h-1.5 mb-6 overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
          <div className="animate-progress h-1.5 rounded-full" style={{ backgroundColor: '#49B29D' }} />
        </div>

        {/* Steps */}
        <div className="space-y-2 text-left">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2.5 text-sm transition-all duration-500"
              style={{
                color: i < stepIndex ? '#4ade80' : i === stepIndex ? '#49B29D' : '#444',
                fontWeight: i === stepIndex ? 500 : 400,
              }}
            >
              {i < stepIndex ? (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : i === stepIndex ? (
                <svg
                  className="w-4 h-4 flex-shrink-0 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <span className="w-4 h-4 flex-shrink-0 rounded-full border border-gray-700 inline-block" />
              )}
              {step}
            </div>
          ))}
        </div>

        <p className="text-xs mt-8" style={{ color: '#444' }}>This takes up to 60 seconds. Please don't close this page.</p>
      </div>
    </div>
  )
}
