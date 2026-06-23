import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

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

  try {
    await pool.query(
      `INSERT INTO leads (email, business_name, city, trade, profile_score, comm_fail_count, hours_flag, competitor_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        email,
        businessName,
        city,
        trade,
        profileScore,
        commFailCount,
        hoursFlag ?? false,
        competitorData ? JSON.stringify(competitorData) : null
      ]
    )
  } catch (error) {
    console.error('PostgreSQL insert error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
