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
  const city = params.get('city') || ''
  const state = params.get('state') || ''
  const trade = params.get('trade') || ''

  useEffect(() => {
    if (!businessName || !city || !state || !trade) {
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
          body: JSON.stringify({ businessName, city, state, trade }),
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
              city,
              state,
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
        const result = {
          formBusinessName: businessName,
          city,
          state,
          trade,
          ...scanData,                                      // includes serviceTypesCount, hoursFlag, etc.
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-extrabold text-gray-900 text-center mb-2">
            We couldn't find your business on Google Maps
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6 leading-relaxed">
            Don't worry — this happens. Here are the two most common reasons:
          </p>

          {/* Reasons */}
          <div className="space-y-3 mb-7">
            <div className="flex gap-3 items-start bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
              <span className="text-indigo-500 font-bold text-sm mt-0.5 shrink-0">1</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Small spelling difference</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Double-check that the name matches <span className="font-medium text-gray-700">exactly</span> how
                  it appears on Google Maps — including punctuation, "LLC", or abbreviations.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start bg-gray-50 rounded-xl px-4 py-3.5 border border-gray-100">
              <span className="text-indigo-500 font-bold text-sm mt-0.5 shrink-0">2</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-0.5">Your business isn't listed yet</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Being listed on Google is <span className="font-medium text-gray-700">free and takes 5 minutes</span>.
                  Go to{' '}
                  <a
                    href="https://business.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 font-medium"
                  >
                    google.com/business
                  </a>
                  {' '}and click <span className="font-medium text-gray-700">Manage Now</span> to get started.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Try Again
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Searched for: <span className="font-medium text-gray-500">{businessName}</span> in {city}, {state}
          </p>
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-6">
            We hit an unexpected error during the scan. Please try again — it usually works on the second attempt.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <svg
            className="animate-spin-slow w-14 h-14 text-indigo-600"
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

        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Scanning your Google Business Profile...
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          Scanning <span className="font-semibold text-gray-700">{businessName}</span> in{' '}
          {city}, {state}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
          <div className="animate-progress bg-indigo-500 h-1.5 rounded-full" />
        </div>

        {/* Steps */}
        <div className="space-y-2 text-left">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${
                i < stepIndex
                  ? 'text-green-600'
                  : i === stepIndex
                  ? 'text-indigo-600 font-medium'
                  : 'text-gray-300'
              }`}
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
                <span className="w-4 h-4 flex-shrink-0 rounded-full border border-gray-200 inline-block" />
              )}
              {step}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-8">This takes up to 60 seconds. Please don't close this page.</p>
      </div>
    </div>
  )
}
