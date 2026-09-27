import { describe, expect, it } from 'vitest'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import {
  CapabilityState,
  capabilityFailureLine,
  capabilityState,
  protocolPill,
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

describe('protocolPill', () => {
  it.each([
    {
      name: 'protocolPill_ShouldSayItAnswers_WhenTheLoginWasAccepted',
      status: 'answers' as const,
      label: 'Répond',
    },
    {
      name: 'protocolPill_ShouldSayItRefusesAccess_WhenTheAccountWasTurnedDown',
      status: 'refused' as const,
      label: 'Refuse l’accès',
    },
    {
      name: 'protocolPill_ShouldSayItDoesNotAnswer_WhenNothingWasReached',
      status: 'unreachable' as const,
      label: 'Ne répond pas',
    },
    {
      name: 'protocolPill_ShouldSayNotCheckedYet_WhenTheCameraWasNeverAsked',
      status: null,
      label: 'Pas encore vérifié',
    },
  ])('$name', ({ status, label }) => {
    // Arrange & Act
    const pill = protocolPill(status)

    // Assert
    expect(pill.label).toBe(label)
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
    const line = capabilityFailureLine(status)

    // Assert
    expect(line.startsWith(start)).toBe(true)
  })
})
