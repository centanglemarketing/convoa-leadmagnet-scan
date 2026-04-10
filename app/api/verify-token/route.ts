import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

const TOKEN_TTL_HOURS = 24

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createClient()

  // ── 1. Look up the token ─────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('magic_links')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
  }

  if (data.used) {
    return NextResponse.json({ error: 'used' }, { status: 410 })
  }

  // ── 2. Check expiry (24 hours) ────────────────────────────────────────────
  const ageHours =
    (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60)

  if (ageHours > TOKEN_TTL_HOURS) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  // ── 3. Mark token as used ────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('magic_links')
    .update({ used: true })
    .eq('token', token)

  if (updateError) {
    console.error('magic_links update error:', updateError)
    // Non-fatal — still return the data
  }

  // ── 4. Save the verified lead to the leads table ─────────────────────────
  const sd = data.scan_data
  await supabase.from('leads').insert({
    email: data.email,
    business_name: sd?.name || sd?.formBusinessName,
    city: sd?.city,
    trade: sd?.trade,
    profile_score: sd?.profileScore,
    comm_fail_count: sd?.commFailCount,
    hours_flag: sd?.hoursFlag ?? false,
    competitor_data: sd?.competitors ?? null,
  })
  // Lead insert failure is non-fatal — we still unlock the report

  return NextResponse.json({
    success: true,
    email: data.email,
    scanData: data.scan_data,
  })
}
