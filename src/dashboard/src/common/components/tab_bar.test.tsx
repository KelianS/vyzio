import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { holdStill, layOut, touchDown, touchMove, touchUp } from '../../testing/finger'
import { withFullMotion } from '../../testing/full_motion'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { TabBar } from './tab_bar'

const TABS = [
  { to: '/a', label: 'Détection' },
  { to: '/b', label: 'Conservation' },
  { to: '/c', label: 'Connexion' },
]

function renderBar() {
  render(
    <MemoryRouter initialEntries={['/a']}>
      <TabBar label="Onglets" tabs={TABS}>
        <p>Contenu</p>
      </TabBar>
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: 'Onglets' })
}

// jsdom lays nothing out, and drops calc() masks: the end fade is held by the e2e suite.
function scrollTo(bar: HTMLElement, scrollLeft: number) {
  Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 200 })
  Object.defineProperty(bar, 'scrollWidth', { configurable: true, value: 500 })
  bar.scrollLeft = scrollLeft
  fireEvent.scroll(bar)
}

describe('TabBar', () => {
  it('TabBar_ShouldNotFade_WhenEveryTabFits', () => {
    // Arrange & Act
    const bar = renderBar()

    // Assert
    expect(bar.style.maskImage).toBe('')
  })

  it('TabBar_ShouldFadeTheStartOnly_WhenScrolledToTheEnd', () => {
    // Arrange
    const bar = renderBar()

    // Act
    scrollTo(bar, 300)

    // Assert
    expect(bar.style.maskImage).toBe('linear-gradient(to right, transparent, black 2rem)')
  })

  it('TabBar_ShouldLeaveTheBackStepToThePageBefore_WhenTheUserSwitchesTabs', async () => {
    // Arrange
    const router = createMemoryRouter(
      [
        { path: '/list', element: <p>Liste</p> },
        {
          path: '/:tab',
          element: (
            <TabBar label="Onglets" tabs={TABS}>
              <p>Contenu</p>
            </TabBar>
          ),
        },
      ],
      { initialEntries: ['/list', '/a'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    fireEvent.click(screen.getByRole('link', { name: 'Conservation' }))

    // Act
    await router.navigate(-1)

    // Assert
    expect(router.state.location.pathname).toBe('/list')
  })
})

describe('TabBar under the finger', () => {
  const TAB_WIDTH = 100
  let restoreLayout = () => {}

  beforeEach(() => {
    withFullMotion()
    restoreLayout = layOut(TAB_WIDTH, 44)
    // Each tab stands one width after the one before it.
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get(this: HTMLElement) {
        const tabs = [...(this.parentElement?.querySelectorAll('[data-tab]') ?? [])]
        return Math.max(0, tabs.indexOf(this)) * TAB_WIDTH
      },
    })
  })
  afterEach(() => {
    restoreLayout()
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetLeft')
  })

  function openTabs() {
    const router = createMemoryRouter(
      [
        { path: '/list', element: <p>Liste</p> },
        {
          path: '/:tab',
          element: (
            <TabBar label="Onglets" tabs={TABS}>
              <p>Contenu</p>
            </TabBar>
          ),
        },
      ],
      { initialEntries: ['/list', '/a'], initialIndex: 1 },
    )
    render(<RouterProvider router={router} />)
    const content = screen.getByText('Contenu').parentElement as HTMLElement
    const indicator = screen.getByRole('navigation').querySelector('[aria-hidden]') as HTMLElement
    return { router, content, indicator }
  }

  it('TabBar_ShouldMoveTheContentAndTheIndicatorWithTheFinger_WhenTheContentIsDraggedSideways', () => {
    // Arrange
    const { content, indicator } = openTabs()
    const half = window.innerWidth / 2

    // Act
    touchDown(content, 900, 100)
    touchMove(content, 885, 100)
    touchMove(content, 885 - half, 100)

    // Assert
    expect(content.style.transform).toBe(`translate3d(${-half}px, 0px, 0px)`)
    expect(indicator.style.transform).toBe('translate3d(50px, 0px, 0px) scaleX(1)')
  })

  it('TabBar_ShouldOpenTheNextTabWithoutAddingABackStep_WhenAFlickCarriesTheContentAside', async () => {
    // Arrange
    const { router, content } = openTabs()

    // Act
    touchDown(content, 900, 100)
    touchMove(content, 885, 100)
    touchMove(content, 840, 100)
    touchUp(content, 840, 100)

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/b'))
    await router.navigate(-1)
    expect(router.state.location.pathname).toBe('/list')
  })

  it('TabBar_ShouldStayOnItsTab_WhenTheContentIsReleasedSlowlyBeforeHalfway', async () => {
    // Arrange
    const { router, content } = openTabs()
    touchDown(content, 900, 100)
    touchMove(content, 885, 100)
    touchMove(content, 785, 100)
    await holdStill()

    // Act
    touchUp(content, 785, 100)

    // Assert
    await waitFor(() => expect(content.style.transform).toBe(''))
    expect(router.state.location.pathname).toBe('/a')
  })

  it('TabBar_ShouldStretchLessThanTheFinger_WhenTheFirstTabIsPulledTowardsNothing', () => {
    // Arrange
    const { content } = openTabs()

    // Act
    touchDown(content, 100, 100)
    touchMove(content, 115, 100)
    touchMove(content, 315, 100)

    // Assert
    const moved = Number(/translate3d\(([\d.]+)px/.exec(content.style.transform)?.[1])
    expect(moved).toBeGreaterThan(0)
    expect(moved).toBeLessThan(200)
  })
})

describe('TabBar under reduced motion', () => {
  it('TabBar_ShouldFadeTheNextTabInWithoutSliding_WhenThePhoneAsksForLessMotion', () => {
    // Arrange
    renderBar()
    const content = screen.getByText('Contenu').parentElement as HTMLElement

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'Conservation' }))

    // Assert
    expect(content.style.transform).toBe('')
    expect(document.body.querySelectorAll(':scope > [inert]')).toHaveLength(0)
  })
})
