import { describe, it, expect } from 'vitest'
import { formatIDR, formatRelativeTime, formatDateTime } from './format'

describe('formatIDR', () => {
  it('formats positive integers to Indonesian Rupiah properly', () => {
    const formatted = formatIDR(1250000)
    // Accept non-breaking space or standard space
    expect(formatted.replace(/\s/g, ' ')).toMatch(/Rp\s*1\.250\.000/)
  })

  it('formats zero correctly', () => {
    const formatted = formatIDR(0)
    expect(formatted.replace(/\s/g, ' ')).toMatch(/Rp\s*0/)
  })

  it('handles NaN or invalid amounts safely', () => {
    expect(formatIDR(NaN)).toBe('Rp 0')
  })
})

describe('formatRelativeTime', () => {
  it('returns "Never" for null or undefined input', () => {
    expect(formatRelativeTime(null)).toBe('Never')
    expect(formatRelativeTime(undefined)).toBe('Never')
  })

  it('returns relative minutes or hours for recent timestamps', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(formatRelativeTime(tenMinutesAgo)).toBe('10m ago')

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })
})

describe('formatDateTime', () => {
  it('returns "-" for empty dates', () => {
    expect(formatDateTime(null)).toBe('-')
  })

  it('formats valid ISO date string without throwing', () => {
    const dateStr = '2026-03-15T10:30:00Z'
    const result = formatDateTime(dateStr)
    expect(result).not.toBe('-')
    expect(typeof result).toBe('string')
  })
})
