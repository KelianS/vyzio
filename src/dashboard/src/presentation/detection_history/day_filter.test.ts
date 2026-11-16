import { describe, expect, it } from 'vitest'
import { dayLabel, dayRange, type DayFilter } from './day_filter'

// A Sunday afternoon, in the hours of the device running the tests.
const NOW = new Date(2026, 10, 15, 16, 30)

describe('dayRange', () => {
  it.each<[string, DayFilter, { from?: string; to?: string }]>([
    ['every day', { kind: 'any' }, {}],
    ['today', { kind: 'today' }, { from: new Date(2026, 10, 15).toISOString() }],
    [
      'yesterday',
      { kind: 'yesterday' },
      { from: new Date(2026, 10, 14).toISOString(), to: new Date(2026, 10, 15).toISOString() },
    ],
    ['the last seven days', { kind: 'week' }, { from: new Date(2026, 10, 9).toISOString() }],
    [
      'a chosen day',
      { kind: 'day', day: '2026-11-02' },
      { from: new Date(2026, 10, 2).toISOString(), to: new Date(2026, 10, 3).toISOString() },
    ],
  ])('dayRange_ShouldReadFromMidnightToMidnight_WhenTheDayIs (%s)', (_name, filter, expected) => {
    // Arrange & Act
    const range = dayRange(filter, NOW)

    // Assert
    expect(range).toEqual(expected)
  })
})

describe('dayLabel', () => {
  it.each<[DayFilter, string | null]>([
    [{ kind: 'any' }, null],
    [{ kind: 'yesterday' }, 'Hier'],
    [{ kind: 'week' }, '7 derniers jours'],
    [{ kind: 'day', day: '2026-11-02' }, '2 novembre'],
  ])('dayLabel_ShouldNameTheDayInTheFilterLine_WhenTheDayIs (%j)', (filter, expected) => {
    // Arrange & Act
    const label = dayLabel(filter)

    // Assert
    expect(label).toBe(expected)
  })
})
