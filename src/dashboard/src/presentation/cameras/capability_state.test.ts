import { describe, expect, it } from 'vitest'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { CapabilityState, capabilityState } from './capability_state'

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
