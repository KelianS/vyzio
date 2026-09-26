import { describe, expect, it, vi } from 'vitest'
import type { VendorAssistance } from '../../domain/entities/vendor_assistance.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { buildAddCameraPresenter } from './add_camera.presenter'

function notice(markdown: string): VendorAssistance {
  return { vendorFamily: 'tplink_tapo', markdown }
}

describe('buildAddCameraPresenter', () => {
  it('onVendorAssistanceNeeded_ShouldKeepTheLatestNotice_WhenAnEarlierRequestAnswersLast', async () => {
    // Arrange
    let answerEarlier: (value: VendorAssistance) => void = () => undefined
    const earlier = new Promise<VendorAssistance>((resolve) => (answerEarlier = resolve))
    const execute = vi.fn().mockReturnValueOnce(earlier).mockResolvedValueOnce(notice('latest'))
    const dispatch = vi.fn()
    const presenter = buildAddCameraPresenter({
      container: { getVendorAssistance: { execute } } as unknown as CamerasContainer,
      hubContainer: {} as HubContainer,
      dispatch,
      toast: vi.fn(),
    })
    const first = presenter.onVendorAssistanceNeeded('icsee', null, false)
    await presenter.onVendorAssistanceNeeded('tplink_tapo', '/stream1', true)

    // Act
    answerEarlier(notice('earlier'))
    await first

    // Assert
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'VENDOR_ASSISTANCE_SUCCEEDED',
      markdown: 'latest',
    })
    expect(dispatch).not.toHaveBeenCalledWith({
      type: 'VENDOR_ASSISTANCE_SUCCEEDED',
      markdown: 'earlier',
    })
  })
})
