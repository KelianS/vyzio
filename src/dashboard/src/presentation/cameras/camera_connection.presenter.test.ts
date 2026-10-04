import { describe, expect, it, vi } from 'vitest'
import type { AvailableStream } from '../../domain/entities/camera_stream.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { makeAvailableStream } from '../../testing/camera_stream_fixture'
import { buildCameraConnectionPresenter } from './camera_connection.presenter'

describe('buildCameraConnectionPresenter', () => {
  it('onListAvailableStreams_ShouldKeepTheLatestList_WhenAnEarlierRequestAnswersLast', async () => {
    // Arrange
    let answerEarlier: (value: AvailableStream[]) => void = () => undefined
    const earlier = new Promise<AvailableStream[]>((resolve) => (answerEarlier = resolve))
    const latest = [makeAvailableStream({ path: '/latest' })]
    const execute = vi.fn().mockReturnValueOnce(earlier).mockResolvedValueOnce(latest)
    const dispatch = vi.fn()
    const presenter = buildCameraConnectionPresenter({
      container: { getAvailableCameraStreams: { execute } } as unknown as CamerasContainer,
      hubContainer: {} as HubContainer,
      dispatch,
      toast: vi.fn(),
    })
    const first = presenter.onListAvailableStreams('camera-1', 'rtsp')
    await presenter.onListAvailableStreams('camera-1', 'rtsp')

    // Act
    answerEarlier([makeAvailableStream({ path: '/earlier' })])
    await first

    // Assert
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'AVAILABLE_STREAMS_LOADED',
      protocol: 'rtsp',
      streams: latest,
    })
  })
})
