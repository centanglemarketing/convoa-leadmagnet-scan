import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const {
    email,
    businessName,
    city,
    trade,
    profileScore,
    commFailCount,
    hoursFlag,
    competitorData,
  } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const supabase = createClient()

  const { error } = await supabase.from('leads').insert({
    email,
    business_name: businessName,
    city,
    trade,
    profile_score: profileScore,
    comm_fail_count: commFailCount,          // integer
    hours_flag: hoursFlag ?? false,           // boolean
    competitor_data: competitorData ?? null,  // jsonb
  })

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
