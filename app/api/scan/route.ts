import { NextRequest, NextResponse } from 'next/server'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

// Generic Google types that don't count as a meaningful service category
const GENERIC_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'business',
  'local_business',
])

export async function POST(req: NextRequest) {
  // ── Parse body outside try/catch so a malformed JSON body surfaces clearly ─
  let body: { businessName?: string; zipCode?: string; trade?: string }
  try {
    body = await req.json()
  } catch (parseErr) {
    console.error('[/api/scan] Failed to parse request body:', parseErr)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { businessName, zipCode, trade } = body

  if (!businessName || !zipCode || !trade) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // ── Step 1: Text Search ─────────────────────────────────────────────────
    const query = encodeURIComponent(`${businessName} ${trade} ${zipCode}`)
    const searchUrl =
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${query}&key=${PLACES_API_KEY}`

    console.log(`[/api/scan] Text Search → ${searchUrl.replace(PLACES_API_KEY, '***')}`)

    const searchRes = await fetch(searchUrl)
    const searchData = await searchRes.json()

    console.log('[/api/scan] Text Search status:', searchData.status)

    if (searchData.status !== 'OK' || !searchData.results?.length) {
      console.warn('[/api/scan] No results. API status:', searchData.status, '| error_message:', searchData.error_message ?? '(none)')
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const placeId: string = searchData.results[0].place_id
    console.log(`[/api/scan] Found place_id: ${placeId} — "${searchData.results[0].name}"`)

    // ── Step 2: Place Details ───────────────────────────────────────────────
    const fields = [
      'name',
      'rating',
      'user_ratings_total',
      'photos',
      'opening_hours',
      'formatted_phone_number',
      'website',
      'editorial_summary',
      'types',
      'address_components',
    ].join(',')

    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}&fields=${fields}&key=${PLACES_API_KEY}`

    console.log(`[/api/scan] Place Details → place_id=${placeId} fields=${fields}`)

    const detailsRes = await fetch(detailsUrl)
    const detailsData = await detailsRes.json()

    console.log('[/api/scan] Place Details status:', detailsData.status)

    if (detailsData.status !== 'OK' || !detailsData.result) {
      console.error(
        '[/api/scan] Place Details failed.',
        '| status:', detailsData.status,
        '| error_message:', detailsData.error_message ?? '(none)',
        '| raw:', JSON.stringify(detailsData)
      )
      return NextResponse.json({ error: 'Could not fetch place details' }, { status: 500 })
    }

    const d = detailsData.result

    // ── Extract city and state from address_components ──────────────────────
    type AddressComponent = { types: string[]; long_name: string; short_name: string }
    const addressComponents: AddressComponent[] = d.address_components ?? []
    const cityComp = addressComponents.find((c) => c.types.includes('locality'))
    const stateComp = addressComponents.find((c) => c.types.includes('administrative_area_level_1'))
    const city = cityComp?.long_name ?? ''
    const state = stateComp?.short_name ?? ''

    // ── Profile completeness ────────────────────────────────────────────────
    const hasPhone = !!d.formatted_phone_number
    const hasWebsite = !!d.website
    const hasHours = !!d.opening_hours
    const hasPhotos = Array.isArray(d.photos) && d.photos.length > 0
    const hasDescription = !!d.editorial_summary?.overview
    const hasCategories =
      Array.isArray(d.types) && d.types.some((t: string) => !GENERIC_TYPES.has(t))

    const profileScore = [hasPhone, hasWebsite, hasHours, hasPhotos, hasDescription, hasCategories]
      .filter(Boolean).length

    // ── Services / type diversity ─────────────────────────────────────────
    const serviceTypesCount = Array.isArray(d.types)
      ? d.types.filter((t: string) => !GENERIC_TYPES.has(t)).length
      : 0

    // ── Hours flag ─────────────────────────────────────────────────────────
    let hoursFlag = false
    let weekdayEveningMissing = false
    let weekendMissing = false
    let earliestWeekdayClose = ''

    if (hasHours && Array.isArray(d.opening_hours.periods)) {
      const periods: Array<{
        open: { day: number; time: string }
        close?: { day: number; time: string }
      }> = d.opening_hours.periods

      const is247 = periods.length === 1 && !periods[0].close

      if (!is247) {
        const weekdayCloseTimes: number[] = periods
          .filter((p) => p.open.day >= 1 && p.open.day <= 5 && p.close)
          .map((p) => parseInt(p.close!.time, 10))

        const earlyCloses = weekdayCloseTimes.filter((t) => t < 1800)
        if (earlyCloses.length > 0) {
          weekdayEveningMissing = true
          const earliest = Math.min(...earlyCloses)
          const hh = Math.floor(earliest / 100)
          const mm = String(earliest % 100).padStart(2, '0')
          const period = hh >= 12 ? 'PM' : 'AM'
          const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh
          earliestWeekdayClose = `${h12}:${mm} ${period}`
        }

        const openDays = new Set(periods.map((p) => p.open.day))
        weekendMissing = !openDays.has(6) && !openDays.has(0)
        hoursFlag = weekdayEveningMissing || weekendMissing
      }
    }

    console.log(`[/api/scan] Done. profileScore=${profileScore} hoursFlag=${hoursFlag} serviceTypesCount=${serviceTypesCount} city=${city} state=${state}`)

    return NextResponse.json({
      placeId,
      name: d.name,
      city,
      state,
      rating: d.rating ?? 0,
      reviewCount: d.user_ratings_total ?? 0,
      hasPhone,
      hasWebsite,
      hasHours,
      hasPhotos,
      hasDescription,
      hasCategories,
      profileScore,
      serviceTypesCount,
      openingHours: d.opening_hours?.weekday_text ?? [],
      hoursFlag,
      weekdayEveningMissing,
      weekendMissing,
      earliestWeekdayClose,
    })

  } catch (err: unknown) {
    // Print the full error so nothing is hidden in the terminal
    console.error('[/api/scan] Unhandled exception:')
    console.error(err)
    if (err instanceof Error) {
      console.error('  message :', err.message)
      console.error('  stack   :', err.stack)
    }
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
