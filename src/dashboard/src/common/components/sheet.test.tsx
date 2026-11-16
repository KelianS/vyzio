import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { holdStill, layOut, touchDown, touchMove, touchUp } from '../../testing/finger'
import { withFullMotion } from '../../testing/full_motion'
import { Sheet } from './sheet'

const SHEET_HEIGHT = 300

function openSheet() {
  const onClose = vi.fn()
  render(
    <Sheet
      title="Silence"
      effect="Plus de notifications."
      options={[{ key: 'hour', title: 'Pendant 1 heure', onPick: vi.fn() }]}
      onClose={onClose}
    />,
  )
  const sheet = screen.getByRole('dialog')
  const head = within(sheet).getByText('Silence').closest('[data-sheet-head]') as HTMLElement
  return { sheet, head, onClose }
}

/** The sheet once it has risen into place. */
async function risenSheet() {
  const opened = openSheet()
  await waitFor(() => expect(opened.sheet.style.transform).toBe(''))
  return opened
}

/** How far a `translate3d` moves down, in pixels. */
function loweredBy(sheet: HTMLElement): number {
  return Number(/translate3d\(0px, (-?[\d.]+)px/.exec(sheet.style.transform)?.[1] ?? 0)
}

describe('Sheet motion', () => {
  let restoreLayout = () => {}
  beforeEach(() => {
    withFullMotion()
    restoreLayout = layOut(360, SHEET_HEIGHT)
  })
  afterEach(() => restoreLayout())

  it('Sheet_ShouldRiseFromTheBottomEdge_WhenItOpens', () => {
    // Arrange & Act
    const { sheet } = openSheet()

    // Assert
    expect(loweredBy(sheet)).toBe(SHEET_HEIGHT)
  })

  it('Sheet_ShouldFollowTheFingerOneToOne_WhenDraggedDown', async () => {
    // Arrange
    const { sheet, head } = await risenSheet()

    // Act
    touchDown(head, 100, 100)
    touchMove(head, 100, 115)
    touchMove(head, 100, 175)

    // Assert
    expect(sheet.style.transform).toBe('translate3d(0px, 60px, 0px)')
  })

  it('Sheet_ShouldClose_WhenAFlickCarriesItDownBeforeHalfway', async () => {
    // Arrange
    const { head, onClose } = await risenSheet()

    // Act
    touchDown(head, 100, 100)
    touchMove(head, 100, 115)
    touchMove(head, 100, 140)
    touchUp(head, 100, 140)

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('Sheet_ShouldComeBack_WhenReleasedSlowlyBeforeHalfway', async () => {
    // Arrange
    const { sheet, head, onClose } = await risenSheet()
    touchDown(head, 100, 100)
    touchMove(head, 100, 115)
    touchMove(head, 100, 175)
    await holdStill()

    // Act
    touchUp(head, 100, 175)

    // Assert
    await waitFor(() => expect(sheet.style.transform).toBe(''))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Sheet_ShouldClose_WhenReleasedSlowlyPastHalfway', async () => {
    // Arrange
    const { head, onClose } = await risenSheet()
    touchDown(head, 100, 100)
    touchMove(head, 100, 115)
    touchMove(head, 100, 315)
    await holdStill()

    // Act
    touchUp(head, 100, 315)

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('Sheet_ShouldStretchLessAndLessThanTheFinger_WhenDraggedUp', async () => {
    // Arrange
    const { sheet, head } = await risenSheet()

    // Act
    touchDown(head, 100, 300)
    touchMove(head, 100, 285)
    touchMove(head, 100, 160)

    // Assert
    expect(loweredBy(sheet)).toBeLessThan(0)
    expect(loweredBy(sheet)).toBeGreaterThan(-125 / 2)
  })

  it('Sheet_ShouldBeCaughtWhereItStands_WhenGrabbedWhileItRises', () => {
    // Arrange
    const { sheet, head } = openSheet()

    // Act
    touchDown(head, 100, 100)
    touchMove(head, 100, 115)

    // Assert
    expect(loweredBy(sheet)).toBeGreaterThan(SHEET_HEIGHT / 2)
  })

  it('Sheet_ShouldLeaveDownwards_WhenAnnulerIsTapped', async () => {
    // Arrange
    const { sheet, onClose } = await risenSheet()

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Annuler' }))

    // Assert
    await waitFor(() => expect(loweredBy(sheet)).toBeGreaterThan(0))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})

describe('Sheet under reduced motion', () => {
  it('Sheet_ShouldNeitherRiseNorSlide_WhenThePhoneAsksForLessMotion', async () => {
    // Arrange
    const { sheet, onClose } = openSheet()
    const transforms = new Set<string>()
    new MutationObserver(() => transforms.add(sheet.style.transform)).observe(sheet, {
      attributes: true,
      attributeFilter: ['style'],
    })

    // Act
    await userEvent.click(within(sheet).getByRole('button', { name: 'Annuler' }))

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect([...transforms].filter(Boolean)).toEqual([])
  })
})
