import { describe, expect, it } from 'vitest'
import { CapabilityStatus } from '../../domain/entities/camera_capability_binding.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import {
  CapabilityState,
  capabilityFailureLine,
  capabilityMark,
  capabilityState,
  otherTestsSuspended,
  protocolMark,
  shownState,
  streamCheckState,
} from './capability_state'

describe('capabilityState', () => {
  it.each([
    {
      name: 'capabilityState_ShouldSayUnconfigured_WhenTheCapabilityIsNotSetUp',
      binding: makeCapabilityBinding({ isConfigured: false, verified: false }),
      switchedOn: true,
      expected: CapabilityState.Unconfigured,
    },
    {
      name: 'capabilityState_ShouldSaySwitchedOff_WhenTheUserTurnedOrientationOff',
      binding: makeCapabilityBinding({ capability: 'ptz', verified: true }),
      switchedOn: false,
      expected: CapabilityState.SwitchedOff,
    },
    {
      name: 'capabilityState_ShouldIgnoreTheSwitch_WhenTheCapabilityIsNeverSwitchedOff',
      binding: makeCapabilityBinding({ capability: 'image_settings', verified: true }),
      switchedOn: false,
      expected: CapabilityState.Working,
    },
    {
      name: 'capabilityState_ShouldSayFailed_WhenTheLastTestFailed',
      binding: makeCapabilityBinding({ capability: 'ptz', verified: false }),
      switchedOn: true,
      expected: CapabilityState.Failed,
    },
    {
      name: 'capabilityState_ShouldSayToConfirm_WhenNoReadCanProveTheCapability',
      binding: makeCapabilityBinding({
        capability: 'hardware_privacy',
        verified: false,
        status: CapabilityStatus.ToConfirm,
      }),
      switchedOn: true,
      expected: CapabilityState.ToConfirm,
    },
    {
      name: 'capabilityState_ShouldSayToConfirmRatherThanSwitchedOff_WhenOrientationWasNeverConfirmed',
      binding: makeCapabilityBinding({
        capability: 'ptz',
        verified: false,
        status: CapabilityStatus.ToConfirm,
      }),
      switchedOn: false,
      expected: CapabilityState.ToConfirm,
    },
    {
      name: 'capabilityState_ShouldSayFailed_WhenTheCameraAnswersWithoutTheCapability',
      binding: makeCapabilityBinding({
        capability: 'ptz',
        verified: false,
        status: CapabilityStatus.Missing,
      }),
      switchedOn: true,
      expected: CapabilityState.Failed,
    },
    {
      name: 'capabilityState_ShouldSayRejectedRatherThanSwitchedOff_WhenTheUserAnsweredNo',
      binding: makeCapabilityBinding({
        capability: 'ptz',
        verified: false,
        status: CapabilityStatus.RejectedByUser,
      }),
      switchedOn: false,
      expected: CapabilityState.Rejected,
    },
    {
      name: 'capabilityState_ShouldSayWorking_WhenTheLastTestPassed',
      binding: makeCapabilityBinding({ capability: 'hardware_privacy', verified: true }),
      switchedOn: true,
      expected: CapabilityState.Working,
    },
  ])('$name', ({ binding, switchedOn, expected }) => {
    // Arrange & Act
    const state = capabilityState(binding, switchedOn)

    // Assert
    expect(state).toBe(expected)
  })
})

describe('capabilityMark', () => {
  it('capabilityMark_ShouldNotSayFailure_WhenTheUserAnsweredNo', () => {
    // Arrange & Act
    const mark = capabilityMark(CapabilityState.Rejected)

    // Assert
    expect(mark).toEqual({ kind: 'off', label: 'Non confirmée' })
  })
})

describe('shownState', () => {
  it.each([
    {
      name: 'shownState_ShouldSayToConfirm_WhenTheQuestionIsAskedAgainAfterANo',
      state: CapabilityState.Rejected,
      asking: true,
      expected: CapabilityState.ToConfirm,
    },
    {
      name: 'shownState_ShouldKeepTheUsersNo_WhenNoQuestionIsAsked',
      state: CapabilityState.Rejected,
      asking: false,
      expected: CapabilityState.Rejected,
    },
  ])('$name', ({ state, asking, expected }) => {
    // Arrange & Act
    const shown = shownState(state, asking)

    // Assert
    expect(shown).toBe(expected)
  })
})

describe('streamCheckState', () => {
  const checkedAt = '2026-09-12T08:30:00Z'

  it.each([
    {
      name: 'streamCheckState_ShouldSayUnconfigured_WhenNoProtocolIsChosen',
      binding: makeCapabilityBinding({ capability: 'stream', isConfigured: false }),
      camera: makeCamera({ lastReachabilityCheckAt: checkedAt }),
      expected: CapabilityState.Unconfigured,
    },
    {
      name: 'streamCheckState_ShouldSayUnchecked_WhenTheConnectionChangedSinceTheLastCheck',
      binding: makeCapabilityBinding({ capability: 'stream' }),
      camera: makeCamera({ status: 'needs_attention', lastReachabilityCheckAt: null }),
      expected: CapabilityState.Unchecked,
    },
    {
      name: 'streamCheckState_ShouldSayFailed_WhenTheCameraWentOfflineAfterAPassedCheck',
      binding: makeCapabilityBinding({ capability: 'stream' }),
      camera: makeCamera({ status: 'offline', lastReachabilityCheckAt: checkedAt }),
      expected: CapabilityState.Failed,
    },
    {
      name: 'streamCheckState_ShouldSayFailed_WhenOnlyThePortAnswersAfterAFailedCheck',
      binding: makeCapabilityBinding({ capability: 'stream', verified: false }),
      camera: makeCamera({ status: 'online', lastReachabilityCheckAt: checkedAt }),
      expected: CapabilityState.Failed,
    },
    {
      name: 'streamCheckState_ShouldSayWorking_WhenTheSurveillanceFailedButTheStreamPassed',
      binding: makeCapabilityBinding({ capability: 'stream' }),
      camera: makeCamera({ status: 'config_error', lastReachabilityCheckAt: checkedAt }),
      expected: CapabilityState.Working,
    },
  ])('$name', ({ binding, camera, expected }) => {
    // Arrange & Act
    const state = streamCheckState(binding, camera)

    // Assert
    expect(state).toBe(expected)
  })
})

describe('otherTestsSuspended', () => {
  it.each([
    {
      name: 'otherTestsSuspended_ShouldFollowTheCamera_WhenTheStreamIsNotReadYet',
      stream: undefined,
      camera: makeCamera({ status: 'offline', connected: false }),
      expected: true,
    },
    {
      name: 'otherTestsSuspended_ShouldWait_WhenTheStreamCheckFailed',
      stream: makeCapabilityBinding({ capability: 'stream', verified: false }),
      camera: makeCamera({ lastReachabilityCheckAt: '2026-09-12T08:30:00Z' }),
      expected: true,
    },
    {
      name: 'otherTestsSuspended_ShouldRun_WhenTheStreamCheckPassed',
      stream: makeCapabilityBinding({ capability: 'stream' }),
      camera: makeCamera({ lastReachabilityCheckAt: '2026-09-12T08:30:00Z' }),
      expected: false,
    },
  ])('$name', ({ stream, camera, expected }) => {
    // Arrange & Act
    const suspended = otherTestsSuspended(stream, camera)

    // Assert
    expect(suspended).toBe(expected)
  })
})

describe('protocolMark', () => {
  it.each([
    {
      name: 'protocolMark_ShouldSayItIsAccessibleInGreen_WhenTheLoginWasAccepted',
      status: 'answers' as const,
      expected: { kind: 'on', label: 'Accessible' },
    },
    {
      name: 'protocolMark_ShouldRingThatAccessIsRefused_WhenTheAccountWasTurnedDown',
      status: 'refused' as const,
      expected: { kind: 'alert', label: 'Accès refusé' },
    },
    {
      name: 'protocolMark_ShouldRingThatItIsUnreachable_WhenNothingWasReached',
      status: 'unreachable' as const,
      expected: { kind: 'alert', label: 'Injoignable' },
    },
    {
      name: 'protocolMark_ShouldSayNotCheckedYetInGrey_WhenTheCameraWasNeverAsked',
      status: null,
      expected: { kind: 'off', label: 'Pas encore vérifié' },
    },
  ])('$name', ({ status, expected }) => {
    // Arrange & Act
    const mark = protocolMark(status)

    // Assert
    expect(mark).toEqual(expected)
  })
})

describe('capabilityFailureLine', () => {
  it.each([
    {
      name: 'capabilityFailureLine_ShouldSendToWakingTheCamera_WhenItsProtocolIsUnreachable',
      status: 'unreachable' as const,
      start: 'La caméra ne répond pas par ce moyen',
    },
    {
      name: 'capabilityFailureLine_ShouldSendToTheAccount_WhenItsProtocolRefusedIt',
      status: 'refused' as const,
      start: 'La caméra refuse le compte pour ce moyen',
    },
    {
      name: 'capabilityFailureLine_ShouldOfferAnotherTry_WhenItsProtocolAnswers',
      status: 'answers' as const,
      start: 'La dernière vérification a échoué',
    },
    {
      name: 'capabilityFailureLine_ShouldOfferAnotherTry_WhenItsProtocolWasNeverChecked',
      status: null,
      start: 'La dernière vérification a échoué',
    },
  ])('$name', ({ status, start }) => {
    // Arrange & Act
    const line = capabilityFailureLine(status, CapabilityStatus.Failed)

    // Assert
    expect(line.startsWith(start)).toBe(true)
  })
})

describe('capabilityFailureLine over the capability level', () => {
  it.each([
    {
      name: 'capabilityFailureLine_ShouldSayTheCameraLacksIt_WhenTheCameraAnswersWithoutTheCapability',
      status: CapabilityStatus.Missing,
      start: 'La caméra répond, mais ne montre pas cette capacité',
    },
  ])('$name', ({ status, start }) => {
    // Arrange & Act
    const line = capabilityFailureLine('answers', status)

    // Assert
    expect(line.startsWith(start)).toBe(true)
  })
})
