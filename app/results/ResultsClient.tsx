'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Competitor {
  name: string
  rating: number
  reviewCount: number
}

interface ScanResult {
  formBusinessName: string
  city: string
  state: string
  trade: string
  placeId: string
  name: string
  rating: number
  reviewCount: number
  // Profile completeness
  hasPhone: boolean
  hasWebsite: boolean
  hasHours: boolean
  hasPhotos: boolean
  hasDescription: boolean
  hasCategories: boolean
  profileScore: number
  // Hours
  openingHours: string[]
  hoursFlag: boolean
  weekdayEveningMissing: boolean
  weekendMissing: boolean
  earliestWeekdayClose: string
  // Communication
  commFailCount: number
  matchingReviews: string[]
  // Review velocity
  recentReviewCount: number
  totalFetchedReviews: number
  // Services
  serviceTypesCount: number
  // Competitors
  competitors: Competitor[]
}

type Phase =
  | 'init'
  | 'teaser'
  | 'email-sent'
  | 'token-loading'
  | 'full-results'
  | 'token-error'

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sz} ${
            rating >= star ? 'text-yellow-400' : rating >= star - 0.5 ? 'text-yellow-300' : 'text-gray-200'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.05 2.927z" />
        </svg>
      ))}
    </div>
  )
}

function ProfileItem({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      {present ? (
        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Present
        </span>
      ) : (
        <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Missing
        </span>
      )}
    </div>
  )
}

function FlagCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
      <div className="flex gap-3 items-center mb-3">
        <span className="text-xl shrink-0">{icon}</span>
        <h3 className="font-bold text-amber-800 text-sm">{title}</h3>
      </div>
      <div className="text-sm text-amber-700 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function getScoreColor(score: number) {
  if (score >= 5) return 'text-green-600'
  if (score >= 3) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreLabel(score: number) {
  if (score >= 5) return 'Strong'
  if (score >= 3) return 'Needs Work'
  return 'Weak'
}

function getHeadlineFinding(result: ScanResult): string {
  if (result.commFailCount > 0) {
    return `${result.commFailCount} recent review${result.commFailCount > 1 ? 's' : ''} mention communication problems — customers can't reach you.`
  }
  if (result.rating > 0 && result.rating < 4.0) {
    return `Your ${result.rating}★ rating is below the 4.5 average — it's turning potential customers away.`
  }
  if (result.profileScore < 4) {
    return `Your profile is missing ${6 - result.profileScore} key elements that help customers choose you over competitors.`
  }
  return `We found ${6 - result.profileScore} opportunities to strengthen your profile and win more jobs.`
}

// ─── Full report (extracted so token flow reuses the same render) ─────────────

function FullReport({ result }: { result: ScanResult }) {
  const router = useRouter()

  const displayName = result.name || result.formBusinessName
  const competitors = result.competitors ?? []

  // ── Local rank calculation ──────────────────────────────────────────────
  // Sort [user + competitors] by rating desc, then review count desc.
  // Only include businesses with a rating so unrated entries don't distort position.
  const allBusinesses = [
    { name: displayName, rating: result.rating, reviewCount: result.reviewCount, isUser: true },
    ...competitors.map((c) => ({ ...c, isUser: false })),
  ].filter((b) => b.rating > 0)

  allBusinesses.sort((a, b) =>
    b.rating !== a.rating ? b.rating - a.rating : b.reviewCount - a.reviewCount
  )

  const userPosition = allBusinesses.findIndex((b) => b.isUser) + 1 // 1-indexed, 0 if not found
  const totalInSet = allBusinesses.length

  const userBeatenByAny = competitors.some((c) => c.rating > result.rating)

  // ── Flag conditions ─────────────────────────────────────────────────────
  const lowVelocity = (result.recentReviewCount ?? 0) < 2
  const lowServices = (result.serviceTypesCount ?? 0) < 3
  const rankFlagged = userPosition >= 3 && totalInSet >= 3

  // ── Total issue count ───────────────────────────────────────────────────
  const totalIssues =
    (6 - result.profileScore) +                           // missing profile fields
    (result.commFailCount > 0 ? 1 : 0) +                 // comm failures
    (result.hoursFlag ? 1 : 0) +                         // hours gap
    (lowVelocity ? 1 : 0) +                              // review velocity
    (lowServices ? 1 : 0) +                              // services listed
    1 +                                                   // Q&A (can't verify via Places API; always flagged)
    (rankFlagged ? 1 : 0)                                // local rank position

  return (
    <div className="space-y-5">

      {/* ── 1. Profile Completeness ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">Profile Completeness</h2>
          <div className={`text-2xl font-extrabold ${getScoreColor(result.profileScore)}`}>
            {result.profileScore}
            <span className="text-base font-normal text-gray-400">/6</span>
            <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
              result.profileScore >= 5 ? 'bg-green-100 text-green-700'
              : result.profileScore >= 3 ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
            }`}>
              {getScoreLabel(result.profileScore)}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${
              result.profileScore >= 5 ? 'bg-green-500' : result.profileScore >= 3 ? 'bg-yellow-400' : 'bg-red-500'
            }`}
            style={{ width: `${(result.profileScore / 6) * 100}%` }}
          />
        </div>
        <ProfileItem label="Phone number listed" present={result.hasPhone} />
        <ProfileItem label="Website linked" present={result.hasWebsite} />
        <ProfileItem label="Business hours set" present={result.hasHours} />
        <ProfileItem label="Photos added" present={result.hasPhotos} />
        <ProfileItem label="Business description" present={result.hasDescription} />
        <ProfileItem label="Categories selected" present={result.hasCategories} />
      </div>

      {/* ── 2. Review Velocity ──────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 border shadow-sm ${
        lowVelocity ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex gap-3 items-center mb-2">
          <span className="text-xl">📈</span>
          <h2 className={`text-sm font-bold ${lowVelocity ? 'text-amber-800' : 'text-green-800'}`}>
            Review Velocity
          </h2>
        </div>
        <p className={`text-sm font-semibold mb-1 ${lowVelocity ? 'text-amber-900' : 'text-green-900'}`}>
          {result.recentReviewCount ?? 0} of your last {result.totalFetchedReviews ?? 5} reviews are recent
          (last 90 days).
        </p>
        {lowVelocity ? (
          <p className="text-sm text-amber-700 leading-relaxed">
            Google weights recent reviews more heavily than older ones. A business with 10 reviews
            this month outranks one with 100 reviews from 2 years ago in local search.
          </p>
        ) : (
          <p className="text-sm text-green-700 leading-relaxed">
            You have a healthy flow of recent reviews. Keep encouraging customers to leave feedback
            after each job.
          </p>
        )}
      </div>

      {/* ── 3. Local Visibility Estimate ────────────────────────────────── */}
      {totalInSet >= 2 && result.rating > 0 && (
        <div className={`rounded-2xl p-5 border shadow-sm ${
          rankFlagged ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex gap-3 items-center mb-2">
            <span className="text-xl">📍</span>
            <h2 className={`text-sm font-bold ${rankFlagged ? 'text-red-800' : 'text-green-800'}`}>
              Local Visibility Estimate
            </h2>
          </div>
          <p className={`text-sm font-semibold mb-1 ${rankFlagged ? 'text-red-900' : 'text-green-900'}`}>
            Based on your rating and review volume, you are likely appearing in position{' '}
            <span className={`text-base font-extrabold ${rankFlagged ? 'text-red-600' : 'text-green-600'}`}>
              {userPosition}
            </span>{' '}
            of {totalInSet} in local map search results for{' '}
            {result.trade.toLowerCase()} in {result.city}.
          </p>
          {rankFlagged && (
            <p className="text-sm text-red-700 leading-relaxed">
              Businesses in positions 1 and 2 receive approximately{' '}
              <span className="font-semibold">70% of all clicks</span> on Google Maps.
            </p>
          )}
        </div>
      )}

      {/* ── 4. How You Compare Locally ──────────────────────────────────── */}
      {competitors.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h2 className="text-base font-bold text-gray-800 mb-4">How You Compare Locally</h2>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-semibold">Business</th>
                  <th className="text-center px-4 py-2.5 font-semibold">Rating</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Reviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-indigo-50">
                  <td className="px-4 py-3 font-semibold text-indigo-700">
                    {displayName}
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">You</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <StarRating rating={result.rating} size="sm" />
                      <span className="font-bold text-gray-800">
                        {result.rating > 0 ? result.rating.toFixed(1) : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{result.reviewCount.toLocaleString()}</td>
                </tr>
                {competitors.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[180px]">{c.name}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <StarRating rating={c.rating} size="sm" />
                        <span className={`font-semibold ${c.rating > result.rating ? 'text-red-600' : 'text-gray-700'}`}>
                          {c.rating > 0 ? c.rating.toFixed(1) : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.reviewCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm leading-relaxed ${
            userBeatenByAny
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {userBeatenByAny ? (
              <>
                <span className="font-semibold">One or more competitors in your area have a higher rating.</span>{' '}
                Communication failures are the #1 cause of lower ratings in trades businesses.
              </>
            ) : (
              <>
                <span className="font-semibold">Your rating is competitive locally.</span>{' '}
                The next risk is availability — contractors who answer every call keep it that way.
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 5. Services Listed ──────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 border shadow-sm ${
        lowServices ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex gap-3 items-center mb-2">
          <span className="text-xl">🔧</span>
          <h2 className={`text-sm font-bold ${lowServices ? 'text-amber-800' : 'text-green-800'}`}>
            Services Listed
          </h2>
        </div>
        <p className={`text-sm font-semibold mb-1 ${lowServices ? 'text-amber-900' : 'text-green-900'}`}>
          Google has attributed{' '}
          <span className={`font-extrabold text-base ${lowServices ? 'text-amber-700' : 'text-green-700'}`}>
            {result.serviceTypesCount ?? 0}
          </span>{' '}
          specific service {(result.serviceTypesCount ?? 0) === 1 ? 'category' : 'categories'} to your profile.
        </p>
        {lowServices ? (
          <p className="text-sm text-amber-700 leading-relaxed">
            Your profile lists few specific services. Each service you add (drain cleaning, water
            heater repair, emergency plumbing) is a separate ranking opportunity in local search.
          </p>
        ) : (
          <p className="text-sm text-green-700 leading-relaxed">
            Your profile has good service coverage. Make sure your Google Business Profile categories
            match these exactly to maintain your ranking.
          </p>
        )}
      </div>


      {/* ── 7. Q&A Section ──────────────────────────────────────────────── */}
      {/* Note: Google Places API does not expose Q&A data. This section is  */}
      {/* always flagged because most small trades businesses leave their     */}
      {/* Q&A unclaimed, making it a consistent and accurate finding.         */}
      <FlagCard icon="❓" title="Google Q&A Section">
        <p>
          Your Google Q&A section is likely empty. Anyone — including competitors — can post
          questions and answers on your profile. Claiming this section protects your reputation
          and lets you control the narrative before customers call.
        </p>
      </FlagCard>

      {/* ── 8. Hours Flag ───────────────────────────────────────────────── */}
      {result.hoursFlag && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex gap-4 items-center">
            <span className="text-2xl shrink-0">🌙</span>
            <h3 className="font-bold text-amber-800 text-sm">After-Hours Coverage Gap Detected</h3>
          </div>

          {result.weekdayEveningMissing && (
            <div className="flex gap-3 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
              <p className="text-sm text-amber-700 leading-relaxed">
                Your profile shows you stop taking calls at{' '}
                <span className="font-semibold text-amber-900">{result.earliestWeekdayClose}</span>.
                After {result.earliestWeekdayClose}, Google will surface competitors who are available
                above you in local search results. Every call that comes in after your listed hours
                goes to them, not you.
              </p>
            </div>
          )}

          {result.weekendMissing && (
            <div className="flex gap-3 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-2" />
              <p className="text-sm text-amber-700 leading-relaxed">
                Google prioritises businesses with weekend availability in Saturday and Sunday
                searches. Customers searching for emergency help on weekends will see your
                competitors first.
              </p>
            </div>
          )}

          {result.openingHours.length > 0 && (
            <div className="ml-4 pt-2 text-xs text-amber-600 space-y-0.5 border-t border-amber-200">
              {result.openingHours.map((h, i) => <div key={i}>{h}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ── 9. Communication Failures ────────────────────────────────────── */}
      <div className={`rounded-xl p-5 flex gap-4 items-start border ${
        result.commFailCount > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'
      }`}>
        <span className="text-2xl">{result.commFailCount > 0 ? '📵' : '💬'}</span>
        <div>
          <h3 className={`font-bold text-sm mb-1 ${result.commFailCount > 0 ? 'text-red-800' : 'text-green-800'}`}>
            Communication Failure Reviews
          </h3>
          {result.commFailCount > 0 ? (
            <>
              <p className="text-sm text-red-700 leading-relaxed">
                <span className="font-bold text-red-600 text-base">{result.commFailCount}</span>{' '}
                review{result.commFailCount > 1 ? 's' : ''} mention{result.commFailCount === 1 ? 's' : ''}{' '}
                unanswered calls, voicemails, or no response. Each one is a job you lost.
              </p>
              <div className="mt-3 space-y-2">
                {result.matchingReviews.map((review, i) => (
                  <blockquote key={i} className="text-xs text-red-600 italic bg-red-100 rounded-lg px-3 py-2 border-l-2 border-red-400">
                    "{review.length > 180 ? review.slice(0, 180) + '…' : review}"
                  </blockquote>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-green-700 leading-relaxed">
              No missed call mentions found — yet. Most trades businesses don't see this problem
              until it shows up publicly on Google. Convoa answers every call 24/7 so it never
              gets to that point.
            </p>
          )}
        </div>
      </div>

      {/* ── 10. CTA Banner ──────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-7 text-white">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found
          </span>
        </div>
        <h3 className="text-xl font-extrabold mb-2 leading-snug">
          {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found on your profile.
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-6">
          Convoa makes sure every call gets answered — even the ones you miss at 2am.
          A live agent answers in your business name, takes a message, and texts you
          instantly. Never lose a job to voicemail again.
        </p>
        <a
          href="https://convoa.com/trial"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-7 py-3.5 rounded-xl transition-colors text-sm"
        >
          Try Free for 14 Days →
        </a>
        <p className="text-gray-500 text-xs mt-3">No credit card required.</p>
      </div>

      <button
        onClick={() => router.push('/')}
        className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
      >
        ← Scan another business
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [phase, setPhase] = useState<Phase>('init')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      setPhase('token-loading')
      fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.scanData) {
            setResult(data.scanData as ScanResult)
            setPhase('full-results')
          } else {
            setPhase('token-error')
          }
        })
        .catch(() => setPhase('token-error'))
    } else {
      const raw = sessionStorage.getItem('scanResult')
      if (!raw) { router.replace('/'); return }
      try {
        setResult(JSON.parse(raw))
        setPhase('teaser')
      } catch {
        router.replace('/')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (!result) return
    setEmailSending(true)
    setEmailError('')
    try {
      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), scanData: result }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send email')
      }
      setPhase('email-sent')
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setEmailSending(false)
    }
  }

  // ── Loading states ────────────────────────────────────────────────────────
  if (phase === 'init' || phase === 'token-loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">
            {phase === 'token-loading' ? 'Verifying your link…' : 'Loading…'}
          </p>
        </div>
      </div>
    )
  }

  // ── Token error ───────────────────────────────────────────────────────────
  if (phase === 'token-error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-5.523 0-10-4.477-10-10S6.477 2 12 2c1.14 0 2.234.19 3.25.54M15 9l-6 6m0-6 6 6" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired or already used</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-7">
            This link has expired or already been used. Report links are single-use and valid for
            24 hours. Please scan your business again to get a fresh report.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Scan My Business Again
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const displayName = result.name || result.formBusinessName
  const headlineFinding = getHeadlineFinding(result)

  // ── Full results (magic-link flow) ────────────────────────────────────────
  if (phase === 'full-results') {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
          <span className="text-xl font-bold text-indigo-600 tracking-tight">Convoa</span>
        </nav>
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
              Google Business Profile Scan
            </p>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-3">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <StarRating rating={result.rating} />
                <span className="text-2xl font-bold text-gray-800">
                  {result.rating > 0 ? result.rating.toFixed(1) : '—'}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {result.reviewCount > 0 ? `${result.reviewCount.toLocaleString()} reviews` : 'No reviews yet'}
              </span>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-gray-500">{result.trade}</span>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-gray-500">{result.city}, {result.state}</span>
            </div>
          </div>
          <FullReport result={result} />
        </div>
      </main>
    )
  }

  // ── Teaser (session flow) ─────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-xl font-bold text-indigo-600 tracking-tight">Convoa</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Business header */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">
            Google Business Profile Scan
          </p>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <StarRating rating={result.rating} />
              <span className="text-2xl font-bold text-gray-800">
                {result.rating > 0 ? result.rating.toFixed(1) : '—'}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {result.reviewCount > 0 ? `${result.reviewCount.toLocaleString()} reviews` : 'No reviews yet'}
            </span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">{result.trade}</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">{result.city}, {result.state}</span>
          </div>
        </div>

        {/* Top finding */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
          <span className="text-xl mt-0.5">🔍</span>
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-0.5">Top Finding</p>
            <p className="text-sm text-amber-700">{headlineFinding}</p>
          </div>
        </div>

        {/* Email gate */}
        {phase === 'email-sent' ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-1">
              Your report link is on its way to{' '}
              <span className="font-semibold text-gray-700">{email}</span>.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              The link expires in 24 hours and is single-use — click it to unlock your full report.
            </p>
            <div className="bg-gray-50 rounded-xl px-5 py-4 text-left border border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-1">Didn't receive it?</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Double-check the email address you entered and check your spam folder. If it's still
                not there,{' '}
                <button
                  onClick={() => setPhase('teaser')}
                  className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 font-medium bg-transparent border-0 p-0 cursor-pointer"
                >
                  try again with a different address
                </button>.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="relative">
              <div className="p-6 blur-sm select-none pointer-events-none opacity-60 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full report locked</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 px-6 py-6">
              <p className="text-center text-sm font-semibold text-gray-700 mb-4">
                Enter your email to see your full report
              </p>
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                  placeholder="you@yourbusiness.com"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  disabled={emailSending}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  {emailSending ? 'Sending…' : 'Send My Report'}
                </button>
              </form>
              {emailError && <p className="text-red-500 text-xs mt-2">{emailError}</p>}
              <p className="text-xs text-gray-400 text-center mt-3">
                We'll email you a secure link — no password needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
