import { NextRequest, NextResponse } from 'next/server'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

export interface Competitor {
  name: string
  rating: number
  reviewCount: number
}

export async function POST(req: NextRequest) {
  const { trade, zipCode, placeId: userPlaceId } = await req.json()

  if (!trade || !zipCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Map trade labels to search-friendly terms
  const tradeSearchMap: Record<string, string> = {
    'Plumber': 'plumber',
    'HVAC Contractor': 'HVAC contractor',
    'Electrician': 'electrician',
    'Roofer': 'roofer',
  }
  const searchTerm = tradeSearchMap[trade] ?? trade.toLowerCase()
  const query = encodeURIComponent(`${searchTerm} in ${zipCode}`)

  const searchUrl =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${query}&key=${PLACES_API_KEY}`

  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()

  if (!searchData.results || searchData.results.length === 0) {
    return NextResponse.json({ competitors: [] })
  }

  // Filter out the user's own business and take top 3
  const competitors: Competitor[] = searchData.results
    .filter((r: { place_id: string }) => r.place_id !== userPlaceId)
    .slice(0, 3)
    .map((r: { name: string; rating?: number; user_ratings_total?: number }) => ({
      name: r.name,
      rating: r.rating ?? 0,
      reviewCount: r.user_ratings_total ?? 0,
    }))

  return NextResponse.json({ competitors })
}
