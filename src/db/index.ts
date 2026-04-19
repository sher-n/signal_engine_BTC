import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import fs from 'fs'
import path from 'path'
import * as schema from './schema'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'btc-signal.db')

// Ensure data/ directory exists
const dir = path.dirname(DB_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const globalForDb = globalThis as unknown as { _sqlite?: Database.Database }

const sqlite = globalForDb._sqlite ?? new Database(DB_PATH)

if (process.env.NODE_ENV !== 'production') {
  globalForDb._sqlite = sqlite
}

// WAL mode: faster writes, allows concurrent reads
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export type DB = typeof db
