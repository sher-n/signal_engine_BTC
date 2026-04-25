import { afterEach, describe, expect, it } from 'vitest'

describe('playground API routes', () => {
  const originalPlayground = process.env.PLAYGROUND

  afterEach(() => {
    if (originalPlayground === undefined) {
      delete process.env.PLAYGROUND
    } else {
      process.env.PLAYGROUND = originalPlayground
    }
  })

  it('serves dashboard mock payload when PLAYGROUND=true', async () => {
    process.env.PLAYGROUND = 'true'
    const { GET } = await import('../dashboard/route')
    const res = await GET()
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(payload).toHaveProperty('stats')
    expect(payload).toHaveProperty('equityCurve')
    expect(payload).toHaveProperty('openPositions')
  })

  it('serves signal history mock payload when PLAYGROUND=true', async () => {
    process.env.PLAYGROUND = 'true'
    const { GET } = await import('../signals/history/route')
    const res = await GET()
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(Array.isArray(payload)).toBe(true)
    expect(payload.length).toBeGreaterThan(0)
  })

  it('serves top10 metrics payload when PLAYGROUND=true', async () => {
    process.env.PLAYGROUND = 'true'
    const { GET } = await import('../metrics/top10/route')
    const res = await GET()
    expect(res.status).toBe(200)

    const payload = await res.json()
    expect(Array.isArray(payload)).toBe(true)
    expect(payload.length).toBe(10)
    expect(payload[0]).toHaveProperty('score')
    expect(payload[0]).toHaveProperty('bias')
  })
})
