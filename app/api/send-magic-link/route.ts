import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

function buildEmailHtml(params: {
  businessName: string
  city: string
  state: string
  totalIssues: number
  magicLink: string
}): string {
  const { businessName, city, state, totalIssues, magicLink } = params
  const issueLabel = `${totalIssues} issue${totalIssues !== 1 ? 's' : ''}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Google Business Profile Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Card -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#4f46e5;padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Convoa</p>
        <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Google Business Profile Scanner</p>
      </div>

      <!-- Body -->
      <div style="padding:32px;">
        <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
          Your profile report is ready
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
          We scanned <strong style="color:#111827;">${businessName}</strong> in ${city}, ${state} and found
          <strong style="color:#ef4444;">${issueLabel}</strong> that could be costing you customers.
          Click below to see your full report.
        </p>

        <!-- CTA Button -->
        <a href="${magicLink}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.1px;">
          View My Full Report &rarr;
        </a>

        <!-- Divider -->
        <hr style="margin:28px 0;border:none;border-top:1px solid #f3f4f6;" />

        <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
          This link expires in <strong>24 hours</strong> and can only be used once.
        </p>
        <p style="margin:0;font-size:13px;color:#9ca3af;">
          If the button doesn't work, paste this URL into your browser:<br />
          <a href="${magicLink}" style="color:#4f46e5;word-break:break-all;">${magicLink}</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:16px 32px;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Sent by Convoa &middot; Built for trades businesses &middot;
          You're receiving this because you requested a profile scan.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const { email, scanData } = await req.json()

  if (!email || !scanData) {
    return NextResponse.json({ error: 'Missing email or scan data' }, { status: 400 })
  }

  const token = randomUUID()
  const magicLink = `${BASE_URL}/results?token=${token}`

  // ── 1. Persist token + scan data to Supabase ─────────────────────────────
  const supabase = createClient()

  const { error: dbError } = await supabase.from('magic_links').insert({
    token,
    email,
    scan_data: scanData,
    used: false,
  })

  if (dbError) {
    console.error('magic_links insert error:', dbError)
    return NextResponse.json({ error: 'Failed to create magic link' }, { status: 500 })
  }

  // ── 2. Send email via Resend ─────────────────────────────────────────────
  const totalIssues =
    (6 - (scanData.profileScore ?? 0)) +
    ((scanData.commFailCount ?? 0) > 0 ? 1 : 0) +
    (scanData.hoursFlag ? 1 : 0)

  const { error: emailError } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Your Google Business Profile Report',
    html: buildEmailHtml({
      businessName: scanData.name || scanData.formBusinessName || 'Your Business',
      city: scanData.city ?? '',
      state: scanData.state ?? '',
      totalIssues,
      magicLink,
    }),
  })

  if (emailError) {
    console.error('Resend error:', emailError)
    // Token is already in DB — clean it up so the user can retry
    await supabase.from('magic_links').delete().eq('token', token)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
