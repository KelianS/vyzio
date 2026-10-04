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
    'detectionResultOf_ShouldSayWhatDetectionFound_WhenTheStreamAndProtocolsAreLeftSo ($outcome)',
    ({ bindings, protocols, outcome }) => {
      // Arrange & Act
      const result = detectionResultOf('192.168.1.10', bindings, protocols)

      // Assert
      expect(result.outcome).toBe(outcome)
    },
  )

  it.each([
    { protocols: [unreachable], diagnostic: 'RTSP : timeout' },
    { protocols: [], diagnostic: '192.168.1.10 : aucun protocole n’a répondu' },
  ])(
    'detectionResultOf_ShouldSayWhatWasAskedForSupport_WhenNothingAnswers ($diagnostic)',
    ({ protocols, diagnostic }) => {
      // Arrange & Act
      const result = detectionResultOf('192.168.1.10', [streamToChoose], protocols)

      // Assert
      expect(result.diagnostic).toBe(diagnostic)
    },
  )

  it('detectionResultOf_ShouldKeepWhatTheProtocolsSaid_WhenTheAccountIsRefused', () => {
    // Arrange & Act
    const result = detectionResultOf('192.168.1.10', [streamToChoose], [refused])

    // Assert
    expect(result.diagnostic).toBe('RTSP : RTSP 401')
  })

  it('detectionResultOf_ShouldGiveNoDiagnostic_WhenTheStreamWorks', () => {
    // Arrange & Act
    const result = detectionResultOf('192.168.1.10', [workingStream], [unreachable])

    // Assert
    expect(result.diagnostic).toBeNull()
  })

  it('detectionResultOf_ShouldNotClaimNothingAnswered_WhenTheCameraAnswersWithoutAWorkingStream', () => {
    // Arrange & Act
    const result = detectionResultOf('192.168.1.10', [streamToChoose], [answering])

    // Assert
    expect(result.diagnostic).toBeNull()
  })
})
