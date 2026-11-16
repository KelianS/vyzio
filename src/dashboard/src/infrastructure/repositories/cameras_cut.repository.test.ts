import { describe, expect, it } from 'vitest'
import { fakeNetwork, ok } from '../../testing/fake_network'
import { HttpCamerasCutRepository } from './cameras_cut.repository'

const CUT = '/api/cameras/privacy/cut'
const repository = new HttpCamerasCutRepository('')

describe('HttpCamerasCutRepository', () => {
  it('getCamerasCut_ShouldReadTheNextScheduleChange_WhenTheServerAnswers', async () => {
    // Arrange
    const nextChange = { at: '2026-11-16T22:00:00+01:00', dayOfWeek: 1, time: '22:00' }
    fakeNetwork({ [`GET ${CUT}`]: ok({ scheduleNextChange: nextChange }) })

    // Act
    const cut = await repository.getCamerasCut()

    // Assert
    expect(cut).toEqual({ scheduleNextChange: nextChange })
  })

  it('cutCameras_ShouldSendNoEnd_WhenTheCutHoldsUntilResumed', async () => {
    // Arrange
    const network = fakeNetwork({ [`PUT ${CUT}`]: ok([]) })

    // Act
    await repository.cutCameras({})

    // Assert
    expect(network.sent).toEqual([{ route: `PUT ${CUT}`, query: '', body: {} }])
  })
})
