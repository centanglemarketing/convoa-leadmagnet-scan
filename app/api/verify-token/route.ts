import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  try {
    // ── Look up the token ────────────────────────────────────────────────────
    const result = await pool.query(
      'SELECT token, email, scan_data FROM magic_links WHERE token = $1 LIMIT 1',
      [token]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'invalid' }, { status: 404 })
    }

    const data = result.rows[0]

    // ── Save the verified lead to the leads table ────────────────────────────
    const sd = data.scan_data
    try {
      await pool.query(
        `INSERT INTO leads (email, business_name, city, trade, profile_score, comm_fail_count, hours_flag, competitor_data) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.email,
          sd?.name || sd?.formBusinessName,
          sd?.city,
          sd?.trade,
          sd?.profileScore,
          sd?.commFailCount,
          sd?.hoursFlag ?? false,
          sd?.competitors ? JSON.stringify(sd.competitors) : null
        ]
      )
    } catch (leadError) {
      console.error('Lead insert failure (non-fatal):', leadError)
    }

    return NextResponse.json({
      success: true,
      email: data.email,
      scanData: data.scan_data,
    })
  } catch (err) {
    console.error('Error verifying token:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
