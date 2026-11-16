import { describe, expect, it, vi } from 'vitest'
import type { DetectionHistoryPage } from '../../domain/entities/detection_history.entity'
import type { DetectionHistoryContainer } from '../../infrastructure/providers/detection_history.container'
import { buildDetectionHistoryPresenter } from './detection_history.presenter'

const EMPTY_PAGE: DetectionHistoryPage = { items: [], nextCursor: null }

describe('buildDetectionHistoryPresenter', () => {
  it('onLoadMore_ShouldNotAddAnOlderPageToTheNewList_WhenTheListWasReadAgainMeanwhile', async () => {
    // Arrange
    let answerOlderPage: (page: DetectionHistoryPage) => void = () => {}
    const execute = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<DetectionHistoryPage>((resolve) => (answerOlderPage = resolve)),
      )
      .mockResolvedValueOnce(EMPTY_PAGE)
    const container = { getDetectionHistory: { execute } } as unknown as DetectionHistoryContainer
    const dispatch = vi.fn()
    const presenter = buildDetectionHistoryPresenter({ container, dispatch, toast: vi.fn() })
    presenter.onLoadMore({}, 'older')
    presenter.onLoadHistory({})
    await Promise.resolve()

    // Act
    answerOlderPage(EMPTY_PAGE)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Assert
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'HISTORY_MORE_SUCCEEDED' }),
    )
  })
})
