import { defineConfig } from 'drizzle-kit'
import path from 'path'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'btc-signal.db')

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: DB_PATH },
  verbose: true,
  strict: true,
})
