import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createClient()

  // ── Look up the token ────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('magic_links')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 })
  }

  // ── Save the verified lead to the leads table ────────────────────────────
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
