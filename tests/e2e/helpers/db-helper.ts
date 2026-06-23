import { Pool } from 'pg'
import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest'

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'convoa_user'}:${process.env.POSTGRES_PASSWORD || 'convoa_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'convoa_db'}`

export const pool = new Pool({
  connectionString,
})

beforeAll(async () => {
  // Ensure database connection can be established
  try {
    const client = await pool.connect()
    client.release()
  } catch (error) {
    console.error('Failed to connect to the database in beforeAll:', error)
    throw error;
  }
})

beforeEach(async () => {
  // Truncate tables before each test
  const client = await pool.connect()
  try {
    await client.query('TRUNCATE TABLE leads, magic_links RESTART IDENTITY CASCADE')
  } catch (error) {
    console.error('Failed to truncate tables before test:', error)
  } finally {
    client.release()
  }
})

afterEach(async () => {
  // Truncate tables after each test
  const client = await pool.connect()
  try {
    await client.query('TRUNCATE TABLE leads, magic_links RESTART IDENTITY CASCADE')
  } catch (error) {
    console.error('Failed to truncate tables after test:', error)
  } finally {
    client.release()
  }
})

afterAll(async () => {
  // End the pool connection
  await pool.end()
})
