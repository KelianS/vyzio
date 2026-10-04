import { describe, expect, it } from 'vitest'
import { makeCameraProtocol } from '../../testing/camera_protocol_fixture'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { DetectionOutcome, detectionResultOf } from './detection_outcome'

const workingStream = makeCapabilityBinding({ capability: 'stream', protocol: 'rtsp' })
const streamToChoose = makeCapabilityBinding({
  capability: 'stream',
  protocol: 'rtsp',
  verified: false,
  isConfigured: false,
})
const answering = makeCameraProtocol()
const refused = makeCameraProtocol({ status: 'refused', lastError: 'RTSP 401' })
const unreachable = makeCameraProtocol({ status: 'unreachable', lastError: 'timeout' })

describe('detectionResultOf', () => {
  it.each([
    { bindings: [workingStream], protocols: [answering], outcome: DetectionOutcome.StreamWorks },
    {
      bindings: [streamToChoose],
      protocols: [answering],
      outcome: DetectionOutcome.StreamNotWorking,
    },
    {
      bindings: [streamToChoose],
      protocols: [refused, unreachable],
      outcome: DetectionOutcome.AccountRefused,
    },
    {
      bindings: [streamToChoose],
      protocols: [unreachable],
      outcome: DetectionOutcome.NothingAnswers,
    },
    { bindings: [], protocols: [], outcome: DetectionOutcome.NothingAnswers },
  ])(
    'detectionResultOf_ShouldSayWhatDetectionFound_WhenTheCameraAnsweredThus ($outcome)',
    ({ bindings, protocols, outcome }) => {
      // Arrange & Act
      const result = detectionResultOf(bindings, protocols)

      // Assert
      expect(result.outcome).toBe(outcome)
    },
  )

  it('detectionResultOf_ShouldGiveWhatEachProtocolAnswered_WhenNothingAnswers', () => {
    // Arrange & Act
    const result = detectionResultOf([streamToChoose], [unreachable])

    // Assert
    expect(result.diagnostic).toBe('RTSP : timeout')
  })
})
