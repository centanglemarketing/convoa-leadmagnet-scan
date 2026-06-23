import { defineConfig } from 'vitest/config'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env or .env.local
const envPath = path.resolve(__dirname, '../.env')
const envLocalPath = path.resolve(__dirname, '../.env.local')

dotenv.config({ path: envPath })
dotenv.config({ path: envLocalPath, override: true })

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts', 'e2e/**/*.test.ts'],
    // Run tests sequentially to avoid database transaction collisions
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    sequence: {
      concurrent: false,
    },
    setupFiles: [path.resolve(__dirname, './e2e/helpers/db-helper.ts')],
    testTimeout: 10000,
  },
})
