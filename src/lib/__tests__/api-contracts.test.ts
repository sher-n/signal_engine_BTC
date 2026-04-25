import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { dashboardDataSchema, metricsTop10BaseSchema, signalsHistorySchema } from '../api-contracts'

function readJson(relativePath: string): unknown {
  const file = path.join(process.cwd(), relativePath)
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

describe('API response contracts', () => {
  it('validates dashboard mock payload shape', () => {
    const mock = readJson('data/mock-dashboard.json')
    expect(() => dashboardDataSchema.parse(mock)).not.toThrow()
  })

  it('validates signal history mock payload shape', () => {
    const mock = readJson('data/mock-signals.json')
    expect(() => signalsHistorySchema.parse(mock)).not.toThrow()
  })

  it('validates top10 metrics mock payload shape', () => {
    const mock = readJson('data/mock-metrics-top10.json')
    expect(() => metricsTop10BaseSchema.parse(mock)).not.toThrow()
  })

  it('rejects invalid signal history payload types', () => {
    const invalid = [{ id: 'bad', side: 'LONG', fillCount: '3' }]
    expect(() => signalsHistorySchema.parse(invalid)).toThrow()
  })
})
