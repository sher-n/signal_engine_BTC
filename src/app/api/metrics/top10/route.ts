import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { metricsTop10BaseSchema, metricsTop10Schema } from '../../../../lib/api-contracts'
import { toScoredMetricRow } from '../../../../lib/metrics-scoring'

const MOCK_FILE = path.join(process.cwd(), 'data', 'mock-metrics-top10.json')

export async function GET() {
  if (process.env.PLAYGROUND === 'true') {
    try {
      if (!fs.existsSync(MOCK_FILE)) {
        console.error(
          `[api/metrics/top10] Missing mock file at ${MOCK_FILE}. Returning empty fallback.`,
        )
        return NextResponse.json([], { status: 200 })
      }
      const mock = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8'))
      const baseRows = metricsTop10BaseSchema.parse(mock)
      const scoredRows = baseRows.map(toScoredMetricRow)
      return NextResponse.json(metricsTop10Schema.parse(scoredRows))
    } catch (error) {
      console.error('[api/metrics/top10] Invalid mock payload. Returning empty fallback.', error)
      return NextResponse.json([], { status: 200 })
    }
  }

  return NextResponse.json([], { status: 200 })
}
