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
  zipCode: string
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

interface HealthBreakdown {
  completeness: number   // 0–25
  reviews: number        // 0–25
  visibility: number     // 0–25
  services: number       // 0–25
  total: number          // 0–100
}

type Phase =
  | 'init'
  | 'teaser'
  | 'email-sent'
  | 'token-loading'
  | 'full-results'
  | 'token-error'

// ─── Health score ─────────────────────────────────────────────────────────────

function computeHealth(data: ScanResult): HealthBreakdown {
  // Completeness: profileScore / 6 × 25
  const completeness = Math.round((data.profileScore / 6) * 25)

  // Reviews: recentReviewCount
  const reviews = data.recentReviewCount >= 2 ? 25 : data.recentReviewCount === 1 ? 12 : 0

  // Visibility: how many competitors the user beats (by rating)
  const ratedCompetitors = data.competitors.filter((c) => c.rating > 0)
  const beaten = ratedCompetitors.filter((c) => data.rating >= c.rating).length
  let visibility: number
  if (ratedCompetitors.length === 0) {
    visibility = 25
  } else if (beaten >= 3) {
    visibility = 25
  } else if (beaten >= 2) {
    visibility = 18
  } else if (beaten >= 1) {
    visibility = 10
  } else {
    visibility = 5
  }

  // Services: serviceTypesCount
  const stc = data.serviceTypesCount
  let services: number
  if (stc >= 8) {
    services = 25
  } else if (stc >= 5) {
    services = 18
  } else if (stc >= 3) {
    services = 12
  } else {
    services = Math.round((stc / 3) * 12)
  }

  return { completeness, reviews, visibility, services, total: completeness + reviews + visibility + services }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${
            rating >= star ? 'text-yellow-400' : rating >= star - 0.5 ? 'text-yellow-300' : 'text-gray-600'
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

function SectionCard({ children, flag = false }: { children: React.ReactNode; flag?: boolean }) {
  return (
    <div
      className="print-card rounded-xl p-5 border"
      style={{
        backgroundColor: '#242424',
        borderColor: flag ? '#ef4444' : '#333333',
        borderLeftWidth: flag ? '3px' : '1px',
      }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ children, flagged = false }: { children: React.ReactNode; flagged?: boolean }) {
  return (
    <h3
      className={`text-sm font-bold uppercase tracking-wider mb-3 ${flagged ? 'print-flag-title' : 'print-section-title'}`}
      style={{ color: flagged ? '#ef4444' : '#49B29D' }}
    >
      {children}
    </h3>
  )
}

function CheckRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#333' }}>
      <span className="text-sm" style={{ color: '#c9c9c9' }}>{label}</span>
      {present ? (
        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#1a3a2e', color: '#4ade80' }}>Present</span>
      ) : (
        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#3a1a1a', color: '#ef4444' }}>Missing</span>
      )}
    </div>
  )
}

function HealthBar({ label, points, maxPoints }: { label: string; points: number; maxPoints: number }) {
  const pct = Math.round((points / maxPoints) * 100)
  const color = pct >= 60 ? '#49B29D' : pct >= 40 ? '#eab308' : '#ef4444'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: '#c9c9c9' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full rounded-full h-2.5" style={{ backgroundColor: '#333' }}>
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? '4px' : '0' }}
        />
      </div>
    </div>
  )
}

// Logarithmic scale so small values are still visible
function logScale(value: number, max: number): number {
  if (max === 0) return 0
  if (value === 0) return 0
  const scaled = Math.log(value + 1) / Math.log(max + 1)
  // Clamp between 3% (minimum visible) and 100%
  return Math.max(3, Math.round(scaled * 100))
}

// ─── Nav Logo ─────────────────────────────────────────────────────────────────

function NavBar() {
  return (
    <nav className="px-6 py-4 border-b" style={{ borderColor: '#2a2a2a' }}>
      <a href="https://convoa.com/">
        <img src="/convoa-logo.png" alt="Convoa" style={{ maxHeight: '40px', cursor: 'pointer' }} />
      </a>
    </nav>
  )
}

// ─── Summary Cards (shared between FullReport and TeaserView) ─────────────────

function SummaryCards({
  data,
  health,
  blurred = false,
}: {
  data: ScanResult
  health: HealthBreakdown
  blurred?: boolean
}) {
  const cards = [
    {
      label: 'Rating',
      value: data.rating > 0 ? data.rating.toFixed(1) : '—',
      sub: <Stars rating={data.rating} />,
      flag: data.rating > 0 && data.rating < 4.0,
    },
    {
      label: 'Reviews',
      value: data.reviewCount.toLocaleString(),
      sub: <span className="text-xs" style={{ color: '#888' }}>total on Google</span>,
      flag: data.reviewCount < 10,
    },
    {
      label: 'Profile',
      value: `${data.profileScore}/6`,
      sub: <span className="text-xs" style={{ color: '#888' }}>completeness</span>,
      flag: data.profileScore < 5,
    },
    {
      label: 'Health',
      value: `${health.total}/100`,
      sub: <span className="text-xs" style={{ color: '#888' }}>profile score</span>,
      flag: health.total < 70,
      valueColor: health.total >= 70 ? '#49B29D' : '#ef4444',
    },
    {
      label: 'Recent',
      value: `${data.recentReviewCount}/${data.totalFetchedReviews}`,
      sub: <span className="text-xs" style={{ color: '#888' }}>reviews in 90d</span>,
      flag: data.recentReviewCount === 0 && data.totalFetchedReviews > 0,
    },
  ]

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      style={blurred ? { filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' } : {}}
    >
      {cards.map(({ label, value, sub, flag, valueColor }) => (
        <div
          key={label}
          className="print-card rounded-xl p-4 text-center border"
          style={{
            backgroundColor: '#242424',
            borderColor: flag ? '#ef4444' : '#333',
            borderLeftWidth: flag ? '3px' : '1px',
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#888' }}>
            {label}
          </p>
          <p className="text-2xl font-black" style={{ color: valueColor ?? '#ffffff' }}>{value}</p>
          <div className="mt-1 flex justify-center">{sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Full Report ──────────────────────────────────────────────────────────────

function FullReport({ data }: { data: ScanResult }) {
  const router = useRouter()
  const health = computeHealth(data)
  const location = data.city && data.state ? `${data.city}, ${data.state}` : data.zipCode

  const maxReviews = Math.max(
    data.reviewCount,
    ...data.competitors.map((c) => c.reviewCount),
    1
  )

  const actionItems: string[] = []
  if (!data.hasPhone) actionItems.push('Add a phone number to your profile')
  if (!data.hasWebsite) actionItems.push('Link your website to your Google listing')
  if (!data.hasPhotos) actionItems.push('Upload at least 5 photos of your work')
  if (!data.hasDescription) actionItems.push('Write a business description')
  if (!data.hasCategories) actionItems.push('Add specific service categories')
  if (data.hoursFlag) actionItems.push('Expand your hours to cover evenings and weekends')
  if (data.commFailCount > 0) actionItems.push('Respond to all reviews mentioning missed calls')
  if (data.recentReviewCount === 0 && data.totalFetchedReviews > 0)
    actionItems.push('Ask your last 3 customers to leave a Google review')
  if (data.serviceTypesCount < 5) actionItems.push('Add more specific service categories to your profile')

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a', color: '#e5e5e5' }}>
      <NavBar />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* ── Hero Card ─────────────────────────────────────────────── */}
        <div
          className="print-card rounded-xl p-6 border-l-4"
          style={{ backgroundColor: '#242424', borderColor: health.total < 70 ? '#ef4444' : '#49B29D' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#888' }}>
                Google Business Profile Audit
              </p>
              <h1 className="text-2xl font-extrabold text-white mb-0.5">{data.name}</h1>
              <p className="text-sm" style={{ color: '#888' }}>{location} · {data.trade}</p>
            </div>
            <div className="flex flex-col items-center sm:items-end shrink-0">
              <span
                className="text-5xl font-black leading-none"
                style={{ color: health.total >= 70 ? '#49B29D' : '#ef4444' }}
              >
                {health.total}
              </span>
              <span className="text-xs font-semibold mt-0.5" style={{ color: '#888' }}>
                / 100
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium" style={{ color: '#c9c9c9' }}>
            A score below 70 means competitors with stronger profiles are appearing above you when customers search.
          </p>
        </div>

        {/* ── 5 Summary Cards ───────────────────────────────────────── */}
        <SummaryCards data={data} health={health} />

        {/* ── Profile Health Breakdown ──────────────────────────────── */}
        <SectionCard>
          <SectionTitle>Profile Health Breakdown</SectionTitle>
          <div className="space-y-4">
            <HealthBar label="Completeness" points={health.completeness} maxPoints={25} />
            <HealthBar label="Services" points={health.services} maxPoints={25} />
            <HealthBar label="Visibility" points={health.visibility} maxPoints={25} />
            <HealthBar label="Reviews" points={health.reviews} maxPoints={25} />
          </div>
        </SectionCard>

        {/* ── Section 1: Profile Completeness ───────────────────────── */}
        <SectionCard flag={data.profileScore < 5}>
          <SectionTitle flagged={data.profileScore < 5}>Profile Completeness</SectionTitle>
          <div>
            <CheckRow label="Phone number" present={data.hasPhone} />
            <CheckRow label="Website link" present={data.hasWebsite} />
            <CheckRow label="Business hours" present={data.hasHours} />
            <CheckRow label="Photos uploaded" present={data.hasPhotos} />
            <CheckRow label="Business description" present={data.hasDescription} />
            <CheckRow label="Service categories" present={data.hasCategories} />
          </div>
          {data.profileScore < 6 && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: '#888' }}>
              Incomplete profiles rank lower in local search. Google prioritises businesses that have filled in every field.
            </p>
          )}
        </SectionCard>

        {/* ── Section 2: Rating & Reviews vs Top Competitors ────────── */}
        <SectionCard flag={data.reviewCount < 20}>
          <SectionTitle flagged={data.reviewCount < 20}>Rating &amp; Reviews vs Top Competitors</SectionTitle>

          {/* Rating comparison */}
          <div className="space-y-2 mb-4">
            {[
              { name: data.name + ' (you)', rating: data.rating, reviewCount: data.reviewCount, isUser: true },
              ...data.competitors,
            ].map((biz, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ backgroundColor: (biz as { isUser?: boolean }).isUser ? '#1e2f2b' : '#1e1e1e' }}
              >
                <span className="text-sm flex-1 truncate" style={{ color: (biz as { isUser?: boolean }).isUser ? '#49B29D' : '#c9c9c9' }}>
                  {biz.name}
                </span>
                <span className="text-xs font-medium shrink-0" style={{ color: '#888' }}>
                  {biz.rating > 0 ? biz.rating.toFixed(1) : '—'} ★ · {biz.reviewCount.toLocaleString()} reviews
                </span>
              </div>
            ))}
          </div>

          {/* Review count bars (logarithmic scale) */}
          <div className="space-y-3 mt-4">
            {[
              { name: data.name + ' (you)', reviewCount: data.reviewCount, isUser: true },
              ...data.competitors,
            ].map((biz, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs truncate max-w-[65%]" style={{ color: (biz as { isUser?: boolean }).isUser ? '#49B29D' : '#c9c9c9' }}>
                    {biz.name}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#888' }}>
                    {biz.reviewCount.toLocaleString()} reviews
                  </span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ backgroundColor: '#333' }}>
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${logScale(biz.reviewCount, maxReviews)}%`,
                      backgroundColor: (biz as { isUser?: boolean }).isUser ? '#49B29D' : '#6b7280',
                      minHeight: '2px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {data.reviewCount < 20 && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: '#888' }}>
              Businesses with more reviews win trust before the customer even clicks. Ask every satisfied customer to leave a review.
            </p>
          )}
        </SectionCard>

        {/* ── Section 3: Review Velocity ────────────────────────────── */}
        <SectionCard flag={data.recentReviewCount === 0 && data.totalFetchedReviews > 0}>
          <SectionTitle flagged={data.recentReviewCount === 0 && data.totalFetchedReviews > 0}>
            Review Velocity
          </SectionTitle>
          {data.totalFetchedReviews === 0 ? (
            <p className="text-sm" style={{ color: '#888' }}>No reviews found on your profile.</p>
          ) : (
            <>
              <p className="text-sm mb-2" style={{ color: '#c9c9c9' }}>
                <span
                  className="text-2xl font-black"
                  style={{ color: data.recentReviewCount > 0 ? '#49B29D' : '#ef4444' }}
                >
                  {data.recentReviewCount}
                </span>
                {' '}of your {data.totalFetchedReviews} most recent reviews were posted in the last{' '}
                <span className="font-semibold text-white">90 days.</span>
              </p>
              {data.recentReviewCount === 0 ? (
                <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                  Google treats fresh reviews as a ranking signal. No new reviews in 90 days signals to Google (and customers) that your business may be inactive.
                </p>
              ) : data.recentReviewCount < 3 ? (
                <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                  You have some recent activity, but competitors with a steady stream of new reviews will outrank you over time.
                </p>
              ) : (
                <p className="text-xs leading-relaxed" style={{ color: '#4ade80' }}>
                  Good — you have an active review stream. Keep it up by asking every customer.
                </p>
              )}
            </>
          )}
        </SectionCard>

        {/* ── Section 4: Services Listed ────────────────────────────── */}
        <SectionCard flag={data.serviceTypesCount < 3}>
          <SectionTitle flagged={data.serviceTypesCount < 3}>Services Listed</SectionTitle>
          <p className="text-sm mb-2" style={{ color: '#c9c9c9' }}>
            Your profile has{' '}
            <span
              className="text-2xl font-black"
              style={{ color: data.serviceTypesCount >= 3 ? '#49B29D' : '#ef4444' }}
            >
              {data.serviceTypesCount}
            </span>{' '}
            specific service {data.serviceTypesCount === 1 ? 'category' : 'categories'} listed.
          </p>
          {data.serviceTypesCount < 5 ? (
            <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
              Adding more categories helps Google show you for more search terms. Go to your Google Business Profile and add every service you offer.
            </p>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: '#4ade80' }}>
              You have a good range of categories listed — this helps customers find you for specific jobs.
            </p>
          )}
        </SectionCard>

        {/* ── Section 5: After-Hours (conditional — only shown when flagged) */}
        {data.hoursFlag && (
          <SectionCard flag={true}>
            <SectionTitle flagged={true}>After-Hours Coverage</SectionTitle>
            <div className="space-y-3">
              {data.weekdayEveningMissing && (
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm leading-relaxed" style={{ color: '#c9c9c9' }}>
                    Your profile shows you stop taking calls at{' '}
                    <span className="font-semibold text-white">{data.earliestWeekdayClose}</span>.
                    When a customer searches for a {data.trade.toLowerCase()} after {data.earliestWeekdayClose}, Google will display competitors who have evening hours listed above you — even if you would answer the phone.
                  </p>
                </div>
              )}
              {data.weekendMissing && (
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#ef4444' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm leading-relaxed" style={{ color: '#c9c9c9' }}>
                    Your profile shows no weekend availability. Customers searching on Saturday or Sunday will see competitors with weekend hours ranked above you in local search results.
                  </p>
                </div>
              )}
            </div>
            {data.openingHours.length > 0 && (
              <div className="mt-4 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-xs font-semibold mb-1.5" style={{ color: '#888' }}>Your current hours</p>
                {data.openingHours.map((line) => (
                  <p key={line} className="text-xs" style={{ color: '#c9c9c9' }}>{line}</p>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Section 6: Communication Failures ────────────────────── */}
        <SectionCard flag={data.commFailCount > 0}>
          <SectionTitle flagged={data.commFailCount > 0}>Communication Issues</SectionTitle>
          {data.commFailCount === 0 ? (
            <p className="text-sm" style={{ color: '#4ade80' }}>
              No reviews mention missed calls or no-response complaints. Keep it up.
            </p>
          ) : (
            <>
              <p className="text-sm mb-3" style={{ color: '#c9c9c9' }}>
                <span className="text-2xl font-black" style={{ color: '#ef4444' }}>{data.commFailCount}</span>{' '}
                {data.commFailCount === 1 ? 'review mentions' : 'reviews mention'} missed calls or no response.
                Customers read these and choose competitors instead.
              </p>
              <div className="space-y-2">
                {data.matchingReviews.map((text, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5 border-l-2"
                    style={{ backgroundColor: '#1a1a1a', borderColor: '#ef4444' }}
                  >
                    <p className="text-xs italic leading-relaxed" style={{ color: '#c9c9c9' }}>
                      &ldquo;{text.length > 200 ? text.slice(0, 200) + '…' : text}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* ── Section 7: Q&A ────────────────────────────────────────── */}
        <SectionCard flag={true}>
          <SectionTitle flagged={true}>Q&amp;A Section</SectionTitle>
          <p className="text-sm" style={{ color: '#c9c9c9' }}>
            Most trades businesses have <span className="font-semibold text-white">no Q&amp;A entries</span> on their Google profile. This is a missed opportunity — customers frequently ask about pricing, availability, and service areas before calling.
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: '#888' }}>
            Add 5–10 questions and answers to your profile. Google shows these prominently and they act as mini-FAQs that pre-qualify leads before they call.
          </p>
        </SectionCard>

        {/* ── Action Plan ───────────────────────────────────────────── */}
        {actionItems.length > 0 && (
          <div className="print-card rounded-xl p-5 border" style={{ backgroundColor: '#1e2f2b', borderColor: '#49B29D' }}>
            <h3 className="print-section-title text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#49B29D' }}>
              Your Action Plan
            </h3>
            <ol className="space-y-2">
              {actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm" style={{ color: '#c9c9c9' }}>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: '#49B29D', color: '#111' }}
                  >
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <div
          className="print-card rounded-xl p-6 text-center border"
          style={{ backgroundColor: '#242424', borderColor: '#333' }}
          data-print-hide
        >
          <h3 className="text-lg font-extrabold text-white mb-2">
            Want us to fix this for you?
          </h3>
          <p className="text-sm mb-5" style={{ color: '#888' }}>
            Convoa helps trades businesses dominate local search — we handle your Google profile, reviews, and online presence so you can focus on the job.
          </p>
          <a
            href="https://convoa.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#49B29D', color: '#111' }}
          >
            Book a Free Strategy Call
          </a>
        </div>

        {/* ── Footer Actions ────────────────────────────────────────── */}
        <div
          className="flex flex-wrap justify-center gap-3 pt-2 pb-8"
          data-print-hide
        >
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: '#444', color: '#c9c9c9', backgroundColor: 'transparent' }}
          >
            Scan Another Business
          </button>
          <button
            onClick={handleShare}
            className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: '#444', color: '#c9c9c9', backgroundColor: 'transparent' }}
          >
            Share Report
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#49B29D', color: '#111' }}
          >
            Download PDF
          </button>
        </div>

        {/* ── Print-only footer ─────────────────────────────────────── */}
        <div className="print-footer">
          Generated by Convoa — convoa.com
        </div>

      </div>
    </div>
  )
}

// ─── Teaser (pre-email gate) ──────────────────────────────────────────────────

function TeaserView({
  data,
  onSubmitEmail,
  emailSending,
  emailError,
}: {
  data: ScanResult
  onSubmitEmail: (email: string) => void
  emailSending: boolean
  emailError: string
}) {
  const [email, setEmail] = useState('')
  const health = computeHealth(data)
  const location = data.city && data.state ? `${data.city}, ${data.state}` : data.zipCode

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    onSubmitEmail(email.trim())
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a1a1a', color: '#e5e5e5' }}>
      <NavBar />

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">

        {/* Hero */}
        <div
          className="rounded-xl p-6 border-l-4"
          style={{ backgroundColor: '#242424', borderColor: health.total < 70 ? '#ef4444' : '#49B29D' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#888' }}>
            Scan Complete
          </p>
          <h1 className="text-2xl font-extrabold text-white mb-1">{data.name}</h1>
          <p className="text-sm mb-4" style={{ color: '#888' }}>{location} · {data.trade}</p>
          <div className="flex items-baseline gap-3">
            <span
              className="text-5xl font-black"
              style={{ color: health.total >= 70 ? '#49B29D' : '#ef4444' }}
            >
              {health.total}
            </span>
            <span className="text-base font-semibold" style={{ color: '#c9c9c9' }}>
              / 100 profile health score
            </span>
          </div>
          <p className="mt-3 text-sm" style={{ color: '#888' }}>
            A score below 70 means competitors with stronger profiles are appearing above you when customers search.
          </p>
        </div>

        {/* Email gate */}
        <div
          className="rounded-xl p-6 border"
          style={{ backgroundColor: '#242424', borderColor: '#49B29D' }}
        >
          <h2 className="text-lg font-extrabold text-white mb-1">
            See your full report — free
          </h2>
          <p className="text-sm mb-5" style={{ color: '#888' }}>
            Enter your email and we'll send you a link to your complete profile audit, health breakdown, and step-by-step action plan.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ backgroundColor: '#1a1a1a', color: '#e5e5e5', border: '1px solid #444' }}
              required
            />
            <button
              type="submit"
              disabled={emailSending}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#49B29D', color: '#111' }}
            >
              {emailSending ? 'Sending…' : 'Send My Report'}
            </button>
          </form>
          {emailError && (
            <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{emailError}</p>
          )}
          <p className="mt-3 text-xs" style={{ color: '#555' }}>
            No spam. One email with your report link. That's it.
          </p>
        </div>

        {/* Blurred preview of summary cards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>
            Your full report includes:
          </p>
          <SummaryCards data={data} health={health} blurred={true} />
        </div>

      </div>
    </div>
  )
}

// ─── Email Sent Confirmation ──────────────────────────────────────────────────

function EmailSentView({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="max-w-md w-full rounded-2xl p-8 border text-center" style={{ backgroundColor: '#242424', borderColor: '#333' }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#1e2f2b' }}
        >
          <svg className="w-8 h-8" style={{ color: '#49B29D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-white mb-2">Check your inbox</h2>
        <p className="text-sm mb-1" style={{ color: '#888' }}>
          We sent your report link to
        </p>
        <p className="text-sm font-semibold mb-4" style={{ color: '#49B29D' }}>{email}</p>
        <p className="text-xs" style={{ color: '#555' }}>
          Click the link in the email to open your full report.
        </p>
      </div>
    </div>
  )
}

// ─── Token Error ──────────────────────────────────────────────────────────────

function TokenErrorView({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="max-w-md w-full rounded-2xl p-8 border text-center" style={{ backgroundColor: '#242424', borderColor: '#333' }}>
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Link already used or not found</h2>
        <p className="text-sm mb-6" style={{ color: '#888' }}>
          Report links are single-use. Run a new scan to get a fresh link.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#49B29D', color: '#111' }}
        >
          Scan Again
        </button>
      </div>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="flex flex-col items-center gap-4">
        <svg className="w-10 h-10 animate-spin" style={{ color: '#49B29D' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm" style={{ color: '#888' }}>Loading your report…</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [phase, setPhase] = useState<Phase>('init')
  const [scanData, setScanData] = useState<ScanResult | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [sentEmail, setSentEmail] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      setPhase('token-loading')
      fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.success) {
            setPhase('token-error')
            return
          }
          setScanData(data.scanData as ScanResult)
          setPhase('full-results')
        })
        .catch(() => setPhase('token-error'))
      return
    }

    const raw = sessionStorage.getItem('scanResult')
    if (!raw) {
      router.replace('/')
      return
    }
    try {
      const parsed = JSON.parse(raw) as ScanResult
      setScanData(parsed)
      setPhase('teaser')
    } catch {
      router.replace('/')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEmailSubmit(email: string) {
    if (!scanData) return
    setEmailSending(true)
    setEmailError('')

    try {
      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, scanData }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailError(data.error || 'Failed to send email. Please try again.')
        return
      }
      setSentEmail(email)
      setPhase('email-sent')
    } catch {
      setEmailError('Something went wrong. Please try again.')
    } finally {
      setEmailSending(false)
    }
  }

  if (phase === 'init' || (phase === 'token-loading' && !scanData)) return <LoadingView />
  if (phase === 'token-error') return <TokenErrorView router={router} />
  if (phase === 'email-sent') return <EmailSentView email={sentEmail} />
  if (phase === 'full-results' && scanData) return <FullReport data={scanData} />
  if (phase === 'teaser' && scanData) {
    return (
      <TeaserView
        data={scanData}
        onSubmitEmail={handleEmailSubmit}
        emailSending={emailSending}
        emailError={emailError}
      />
    )
  }
  return <LoadingView />
}
