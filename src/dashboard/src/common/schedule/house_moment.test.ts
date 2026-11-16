import { describe, expect, it } from 'vitest'
import { formatHouseEnd, formatHouseTime } from './house_moment'

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

describe('formatHouseEnd', () => {
  it('formatHouseEnd_ShouldSayTheHourAlone_WhenTheEndIsWithinADay', () => {
    // Arrange & Act
    const text = formatHouseEnd(
      { at: '2026-11-17T07:00:00+01:00', dayOfWeek: 2, time: '07:00' },
      NOW,
    )

    // Assert
    expect(text).toBe('7 h')
  })

  it('formatHouseEnd_ShouldSayTheDayFirst_WhenTheEndIsMoreThanADayAway', () => {
    // Arrange & Act
    const text = formatHouseEnd(
      { at: '2026-11-20T22:00:00+01:00', dayOfWeek: 5, time: '22:00' },
      NOW,
    )

    // Assert
    expect(text).toBe('vendredi 22 h')
  })
})
