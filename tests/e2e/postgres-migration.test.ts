import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { pool } from './helpers/db-helper'
import { apiPost } from './helpers/api-helper'
import nock from 'nock'

describe('PostgreSQL Database Migration E2E Tests', () => {
  beforeAll(() => {
    // Intercept Resend API calls so we don't need a real key during E2E tests
    nock('https://api.resend.com')
      .persist()
      .post('/emails')
      .reply(200, { id: 'mock-email-id' })
  })

  afterAll(() => {
    nock.cleanAll()
  })

  it('should successfully save a lead to the leads table via /api/save-lead', async () => {
    const payload = {
      email: 'lead@example.com',
      businessName: 'Super Trades plumber',
      city: 'Phoenix',
      trade: 'plumber',
      profileScore: 5,
      commFailCount: 1,
      hoursFlag: true,
      competitorData: { competitorName: 'Competitor Plumber' }
    }

    const response = await apiPost('/api/save-lead', payload)
    expect(response.status).toBe(200)

    const responseBody = await response.json()
    expect(responseBody.success).toBe(true)

    // Direct database validation
    const dbResult = await pool.query('SELECT * FROM leads WHERE email = $1', [payload.email])
    expect(dbResult.rows.length).toBe(1)
    const lead = dbResult.rows[0]
    expect(lead.business_name).toBe(payload.businessName)
    expect(lead.city).toBe(payload.city)
    expect(lead.trade).toBe(payload.trade)
    expect(lead.profile_score).toBe(payload.profileScore)
    expect(lead.comm_fail_count).toBe(payload.commFailCount)
    expect(lead.hours_flag).toBe(true)
    expect(lead.competitor_data).toEqual(payload.competitorData)
  })

  it('should successfully create a magic link, save to database, and verify it', async () => {
    const scanData = {
      name: 'Scan Business',
      city: 'Phoenix',
      state: 'AZ',
      profileScore: 4,
      commFailCount: 0,
      hoursFlag: false,
      competitors: []
    }

    const sendResponse = await apiPost('/api/send-magic-link', {
      email: 'magic@example.com',
      scanData
    })
    expect(sendResponse.status).toBe(200)

    const sendBody = await sendResponse.json()
    expect(sendBody.success).toBe(true)

    // Check database directly to fetch the generated token
    const dbResult = await pool.query('SELECT * FROM magic_links WHERE email = $1', ['magic@example.com'])
    expect(dbResult.rows.length).toBe(1)
    const magicLinkRow = dbResult.rows[0]
    expect(magicLinkRow.token).toBeDefined()
    expect(magicLinkRow.used).toBe(false)
    expect(magicLinkRow.scan_data).toEqual(scanData)

    // Verify token
    const verifyResponse = await apiPost('/api/verify-token', {
      token: magicLinkRow.token
    })
    expect(verifyResponse.status).toBe(200)

    const verifyBody = await verifyResponse.json()
    expect(verifyBody.success).toBe(true)
    expect(verifyBody.email).toBe('magic@example.com')
    expect(verifyBody.scanData).toEqual(scanData)

    // Verify a lead was also generated inside verify-token
    const leadDbResult = await pool.query('SELECT * FROM leads WHERE email = $1', ['magic@example.com'])
    expect(leadDbResult.rows.length).toBe(1)
    const verifiedLead = leadDbResult.rows[0]
    expect(verifiedLead.business_name).toBe(scanData.name)
    expect(verifiedLead.profile_score).toBe(scanData.profileScore)
  })
})
