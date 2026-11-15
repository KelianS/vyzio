import { describe, expect, it } from 'vitest'
import type { Silence } from '../../domain/entities/silence.entity'
import { fakeNetwork, ok } from '../../testing/fake_network'
import { HttpSilenceRepository } from './silence.repository'

const SILENCE = '/api/notifications/silence'
const repository = new HttpSilenceRepository('')

const RUNNING: Silence = {
  active: true,
  until: { at: '2026-11-16T16:00:00+01:00', dayOfWeek: 1, time: '16:00' },
  scheduleNextChange: { at: '2026-11-16T22:00:00+01:00', dayOfWeek: 1, time: '22:00' },
}

const ENDED: Silence = { active: false, until: null, scheduleNextChange: null }

describe('HttpSilenceRepository', () => {
  it('getSilence_ShouldReadTheSilenceAndTheNextScheduleChange_WhenTheServerAnswers', async () => {
    // Arrange
    fakeNetwork({ [`GET ${SILENCE}`]: ok(RUNNING) })

    // Act
    const silence = await repository.getSilence()

    // Assert
    expect(silence).toEqual(RUNNING)
  })

  it('startSilence_ShouldSendTheDuration_WhenMinutesAreChosen', async () => {
    // Arrange
    const network = fakeNetwork({ [`PUT ${SILENCE}`]: ok(RUNNING) })

    // Act
    const silence = await repository.startSilence({ minutes: 30 })

    // Assert
    expect(network.sent).toEqual([{ route: `PUT ${SILENCE}`, query: '', body: { minutes: 30 } }])
    expect(silence.active).toBe(true)
  })

  it('startSilence_ShouldSendTheEnd_WhenTheScheduleChangeIsChosen', async () => {
    // Arrange
    const network = fakeNetwork({ [`PUT ${SILENCE}`]: ok(RUNNING) })

    // Act
    await repository.startSilence({ until: '2026-11-16T22:00:00+01:00' })

    // Assert
    expect(network.sent[0]?.body).toEqual({ until: '2026-11-16T22:00:00+01:00' })
  })

  it('stopSilence_ShouldAnswerTheEndedSilence_WhenTheUserEndsIt', async () => {
    // Arrange
    fakeNetwork({ [`DELETE ${SILENCE}`]: ok(ENDED) })

    // Act
    const silence = await repository.stopSilence()

    // Assert
    expect(silence).toEqual(ENDED)
  })
})
