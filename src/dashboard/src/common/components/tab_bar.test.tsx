import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TabBar } from './tab_bar'

const TABS = [
  { to: '/a', label: 'Détection' },
  { to: '/b', label: 'Conservation' },
  { to: '/c', label: 'Connexion' },
]

function renderBar() {
  render(
    <MemoryRouter initialEntries={['/a']}>
      <TabBar label="Onglets" tabs={TABS} />
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
})
