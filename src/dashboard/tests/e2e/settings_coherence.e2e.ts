import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

/**
 * What can only be judged by comparing screens with each other.
 *
 * Every screen is compliant on its own: it is the comparison that reveals a control
 * column drifting, or an "Avance" fold that is not one. Both invariants are
 * geometric and structural, hence checkable - unlike the vocabulary, which stays a
 * human read-through.
 */

const SETTINGS_ROUTES = [
  '/settings/cameras/camera-1/detection',
  '/settings/cameras/camera-1/retention',
  '/settings/cameras/camera-1/privacy',
  '/settings/cameras/camera-1/image',
  '/settings/cameras/camera-1/connection',
  '/settings/retention',
  // The settings are in the channel, not in the list leading to it.
  '/settings/notifications/telegram',
  '/settings/notifications/discord',
  '/settings/face-recognition/profile-1/identity',
]

interface FieldMeasure {
  id: string
  /** Right edge of the column reserved for the control. */
  column: number
  /** Right edge of what the control **actually fills**. */
  filled: number
}

/**
 * What each field-shaped control leaves empty at the end of its column.
 *
 * The cell is not what is measured: the grid stretches it, it would be aligned even
 * with a tiny field floating inside - which is exactly the defect being looked for.
 *
 * Excluded, because its width is that of the object and not of the column: the switch, and the
 * number field, sized to its value (DESIGN SYSTEM § Settings screens), whose row still counts.
 */
async function fieldMeasures(page: Page): Promise<FieldMeasure[]> {
  return page.$$eval('[data-setting-control]', (cells) =>
    cells
      .map((cell): FieldMeasure | null => {
        const root = cell.firstElementChild?.firstElementChild
        if (!root) return null
        if (root.matches('[role="switch"]') || root.querySelector('[role="switch"]')) return null

        const labelled = cell.parentElement?.querySelector('label')
        if (root.querySelector('input[type="number"]')) {
          const right = Math.round(cell.getBoundingClientRect().right)
          return { id: labelled?.getAttribute('for') ?? '?', column: right, filled: right }
        }

        // When the control is itself the interactive element, it fills the column by
        // construction; its children are its inner lining, never empty space.
        const isWrapper = !root.matches('input, button, [role="combobox"]')
        const parts = isWrapper ? [...root.children] : [root]
        const filled = Math.max(...parts.map((node) => node.getBoundingClientRect().right))

        return {
          id: labelled?.getAttribute('for') ?? '?',
          column: Math.round(cell.getBoundingClientRect().right),
          filled: Math.round(filled),
        }
      })
      .filter((entry): entry is FieldMeasure => entry !== null),
  )
}

function seedBackend(page: Page) {
  return installFakeBackend(
    page,
    createFakeBackendState({
      cameras: [
        makeFakeCamera({
          id: 'camera-1',
          displayName: 'Salon',
          ptzSupported: true,
          verifiedCapabilities: ['image_settings'],
        }),
      ],
      profiles: [
        {
          id: 'profile-1',
          name: 'Alice',
          category: 'family',
          alertMode: 'always',
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  )
}

test.describe('Settings screens coherence', () => {
  test.beforeEach(async ({ page }) => {
    await seedBackend(page)
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('SettingRow_ShouldFillItsControlColumn_WhenRenderedOnAnyScreen', async ({ page }) => {
    // A field that does not fill its column breaks the vertical alignment of the values,
    // and the page stops being scannable - which is what the fixed anatomy aimed at (ADR-15).
    for (const path of SETTINGS_ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const measures = await fieldMeasures(page)
      expect(measures.length, `${path} declares no setting`).toBeGreaterThan(0)

      // 2px of tolerance: sub-pixel rounding, not lost space.
      const short = measures.filter((field) => field.column - field.filled > 2)
      expect(short, `${path}: fields shorter than their column`).toEqual([])
    }
  })

  test('SettingsSection_ShouldSetItsTitleApartFromLabels_WhenAPageGroupsItsSettings', async ({
    page,
  }) => {
    // A section label and a setting label rendered alike make a page where everything
    // sits at the same level: the label sits above its list, smaller, bold and quieter (DESIGN SYSTEM § Typography).
    for (const path of SETTINGS_ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const typography = (selector: string) =>
        page.$$eval(selector, (nodes) =>
          nodes.map((node) => ({
            text: node.textContent ?? '',
            size: Number.parseFloat(getComputedStyle(node).fontSize),
            weight: Number.parseFloat(getComputedStyle(node).fontWeight),
            color: getComputedStyle(node).color,
          })),
        )

      const titles = await typography('section h2')
      const labels = await typography('label[id$="-label"]')
      if (titles.length === 0) continue

      const smallestLabel = Math.min(...labels.map((entry) => entry.size))
      const labelColours = labels.map((entry) => entry.color)
      for (const title of titles) {
        expect(title.weight, `${path}: "${title.text}" is not set bold`).toBeGreaterThanOrEqual(600)
        expect(title.size, `${path}: "${title.text}" is the size of a setting label`).toBeLessThan(
          smallestLabel,
        )
        expect(labelColours, `${path}: "${title.text}" has a setting label's colour`).not.toContain(
          title.color,
        )
      }
    }
  })

  const ADVANCED_ROUTES = [
    '/settings/face-recognition/profile-1/photos',
    '/settings/cameras/camera-1/connection',
    '/settings/hardware',
  ]

  for (const path of ADVANCED_ROUTES) {
    test(`AdvancedFold_ShouldOpenInPlace_WhenTheUserOpensIt (${path})`, async ({ page }) => {
      await page.goto(path)
      const fold = page.locator('summary', { hasText: /^Avancé/ })

      // "Avance" is a position, not a mode (UI-09): a closed fold that opens where it stands (UI-25).
      await fold.click()
      await expect(fold.locator('xpath=..')).toHaveAttribute('open', '')
      await expect(page).toHaveURL(path)
    })
  }
})
