import { describe, expect, it } from 'vitest'
import { holdsItsOwnDrag, projection, rubberBand, startsOnControl } from './gesture'

function element(html: string, selector: string): Element {
  const host = document.createElement('div')
  host.innerHTML = html
  return host.querySelector(selector)!
}

describe('gesture', () => {
  it.each([
    [0, 0],
    [1000, 499],
    [-2000, -998],
  ])(
    'projection_ShouldCarryAFlickFurtherTheFasterItWas_WhenReleased (%i px/s)',
    (velocity, carried) => {
      // Arrange & Act
      const distance = projection(velocity)

      // Assert
      expect(distance).toBeCloseTo(carried, 0)
    },
  )

  it.each([
    [100, 300, 46.5],
    [-100, 300, -46.5],
    [1000, 300, 194.1],
  ])(
    'rubberBand_ShouldGiveLessThanTheFingerPulls_WhenPulledPastAnEnd (%i px)',
    (over, dimension, moved) => {
      // Arrange & Act
      const followed = rubberBand(over, dimension)

      // Assert
      expect(followed).toBeCloseTo(moved, 1)
    },
  )

  it.each([
    ['<input type="range" />', 'input', true],
    ['<span role="slider"><i></i></span>', 'i', true],
    ['<button><svg></svg></button>', 'svg', false],
    ['<p>Texte</p>', 'p', false],
  ])(
    'holdsItsOwnDrag_ShouldKeepTheDragForAFieldOrASlider_WhenItStartsThere (%s)',
    (html, selector, owned) => {
      // Arrange & Act
      const holds = holdsItsOwnDrag(element(html, selector))

      // Assert
      expect(holds).toBe(owned)
    },
  )

  it.each([
    ['<button title="Haut"><svg></svg></button>', 'svg', true],
    ['<a href="/x">Lien</a>', 'a', true],
    ['<div data-press-only><span></span></div>', 'span', true],
    ['<div><p>Texte</p></div>', 'p', false],
  ])(
    'startsOnControl_ShouldNeverLetTheTabsTakeTheDrag_WhenItStartsOnAControl (%s)',
    (html, selector, control) => {
      // Arrange & Act
      const onControl = startsOnControl(element(html, selector))

      // Assert
      expect(onControl).toBe(control)
    },
  )
})
