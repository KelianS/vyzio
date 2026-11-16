import { describe, expect, it } from 'vitest'
import { formatHouseTime, formatSilenceEnd, recentDetectionsLine } from './home_wording'

const NOW = new Date('2026-11-16T20:00:00+01:00')

describe('formatHouseTime', () => {
  it.each([
    { time: '22:00', said: '22 h' },
    { time: '07:30', said: '7 h 30' },
    { time: '00:05', said: '0 h 05' },
  ])(
    'formatHouseTime_ShouldReadTheHourTheFrenchWay_WhenGivenAClockTime ($time)',
    ({ time, said }) => {
      // Arrange & Act
      const text = formatHouseTime(time)

      // Assert
      expect(text).toBe(said)
    },
  )
})

describe('formatSilenceEnd', () => {
  it('formatSilenceEnd_ShouldSayTheHourAlone_WhenTheEndIsWithinADay', () => {
    // Arrange & Act
    const text = formatSilenceEnd(
      { at: '2026-11-17T07:00:00+01:00', dayOfWeek: 2, time: '07:00' },
      NOW,
    )

    // Assert
    expect(text).toBe('7 h')
  })

  it('formatSilenceEnd_ShouldSayTheDayFirst_WhenTheEndIsMoreThanADayAway', () => {
    // Arrange & Act
    const text = formatSilenceEnd(
      { at: '2026-11-20T22:00:00+01:00', dayOfWeek: 5, time: '22:00' },
      NOW,
    )

    // Assert
    expect(text).toBe('vendredi 22 h')
  })
})

describe('recentDetectionsLine', () => {
  it.each([
    { recent: null, said: null },
    { recent: { count: 0, more: false }, said: null },
    { recent: { count: 2, more: false }, said: '2 depuis 1 h' },
    { recent: { count: 100, more: true }, said: '100+ depuis 1 h' },
  ])(
    'recentDetectionsLine_ShouldCountOnlyWhatWasSeen_WhenTheLastHourIsRead ($said)',
    ({ recent, said }) => {
      // Arrange & Act
      const text = recentDetectionsLine(recent)

      // Assert
      expect(text).toBe(said)
    },
  )
})
