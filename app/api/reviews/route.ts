import { NextRequest, NextResponse } from 'next/server'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

const COMM_KEYWORDS = [
  'no response',
  'no call back',
  'no callback',
  'never called',
  'voicemail',
  'no answer',
  'never responded',
  'left a message',
  "didn't call",
  "didn't respond",
  'did not call',
  'did not respond',
  'never returned',
]

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60

export async function POST(req: NextRequest) {
  const { placeId } = await req.json()

  if (!placeId) {
    return NextResponse.json({ error: 'Missing placeId' }, { status: 400 })
  }

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=reviews&key=${PLACES_API_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  if (!data.result) {
    return NextResponse.json({
      commFailCount: 0,
      matchingReviews: [],
      recentReviewCount: 0,
      totalFetchedReviews: 0,
    })
  }

  const reviews: Array<{ text: string; rating: number; time: number }> =
    data.result.reviews ?? []

  const top5 = reviews.slice(0, 5)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const cutoff = nowSeconds - NINETY_DAYS_SECONDS

  // ── Communication failure scan ────────────────────────────────────────────
  const matchingReviews: string[] = []
  for (const review of top5) {
    const text = (review.text ?? '').toLowerCase()
    if (COMM_KEYWORDS.some((kw) => text.includes(kw))) {
      matchingReviews.push(review.text)
    }
  }

  // ── Review velocity ───────────────────────────────────────────────────────
  // Count how many of the 5 most recent reviews fall within the last 90 days.
  // `review.time` is a Unix timestamp (seconds).
  const recentReviewCount = top5.filter((r) => (r.time ?? 0) > cutoff).length

  return NextResponse.json({
    commFailCount: matchingReviews.length,
    matchingReviews,
    recentReviewCount,
    totalFetchedReviews: top5.length,
  })
}
