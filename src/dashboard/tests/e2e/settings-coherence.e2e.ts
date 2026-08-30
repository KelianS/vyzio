import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * What can only be judged by comparing screens with each other.
 *
 * Every screen is compliant on its own: it is the comparison that reveals a control
 * column drifting, or an "Avance" fold that is not one. Both invariants are
 * geometric and structural, hence checkable - unlike the vocabulary, which stays a
 * human read-through.
 */

const SETTINGS_ROUTES: [string, string][] = [
  ['/settings/cameras/camera-1/detection', 'Camera — detection'],
  ['/settings/cameras/camera-1/conservation', 'Camera — conservation'],
  ['/settings/cameras/camera-1/vie-privee', 'Camera — vie privee'],
  ['/settings/cameras/camera-1/image', 'Camera — image'],
  ['/settings/cameras/camera-1/connexion', 'Camera — connexion'],
  ['/settings/conservation', 'Conservation (installation)'],
  // The settings are in the channel, not in the list leading to it.
  ['/settings/notifications/telegram', 'Notifications — Telegram'],
  ['/settings/notifications/discord', 'Notifications — Discord'],
  ['/settings/detection/personnes/profile-1/identite', 'Personne — identite'],
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
 * Excluded, because its width is that of the object and not of the column: the switch.
 */
async function fieldMeasures(page: Page): Promise<FieldMeasure[]> {
  return page.$$eval('[data-setting-control]', (cells) =>
    cells
      .map((cell): FieldMeasure | null => {
        const root = cell.firstElementChild?.firstElementChild
        if (!root) return null
        if (root.matches('[role="switch"]') || root.querySelector('[role="switch"]')) return null

        // When the control is itself the interactive element, it fills the column by
        // construction; its children are its inner lining, never empty space.
        const isWrapper = !root.matches('input, button, [role="combobox"]')
        const parts = isWrapper ? [...root.children] : [root]
        const filled = Math.max(...parts.map((node) => node.getBoundingClientRect().right))

        const labelled = cell.parentElement?.querySelector('label')
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

test.describe('Coherence des ecrans de reglages', () => {
  test.beforeEach(async ({ page }) => {
    await seedBackend(page)
    await page.setViewportSize({ width: 1280, height: 900 })
  })

  test('colonne_When a field renders on any screen_Should fill its control column', async ({
    page,
  }) => {
    // A field that does not fill its column breaks the vertical alignment of the values,
    // and the page stops being scannable - which is what the fixed anatomy aimed at (ADR-43).
    for (const [path, label] of SETTINGS_ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const measures = await fieldMeasures(page)
      expect(measures.length, `${label} ne declare aucun reglage`).toBeGreaterThan(0)

      // 2px of tolerance: sub-pixel rounding, not lost space.
      const short = measures.filter((field) => field.column - field.filled > 2)
      expect(short, `${label} : champs plus courts que leur colonne`).toEqual([])
    }
  })

  test('hierarchie_When a page groups its settings_Should set section titles apart from labels', async ({
    page,
  }) => {
    // A section title and a setting label rendered alike make a page where everything
    // sits at the same level: the sections then separate nothing.
    for (const [path, label] of SETTINGS_ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const typography = (selector: string) =>
        page.$$eval(selector, (nodes) =>
          nodes.map((node) => ({
            text: node.textContent ?? '',
            size: Number.parseFloat(getComputedStyle(node).fontSize),
            serif: getComputedStyle(node).fontFamily.includes('Iowan'),
          })),
        )

      const titles = await typography('section h2')
      const labels = await typography('label[id$="-label"]')
      if (titles.length === 0) continue

      const biggestLabel = Math.max(...labels.map((entry) => entry.size))
      for (const title of titles) {
        expect(title.serif, `${label} : « ${title.text} » n'est pas dans le serif des titres`).toBe(
          true,
        )
        expect(
          title.size,
          `${label} : « ${title.text} » a la taille d'un libelle de reglage`,
        ).toBeGreaterThan(biggestLabel)
      }
    }
  })

  const FOLD_ROUTES: [string, string][] = [
    ['/settings/systeme', 'Systeme'],
    ['/settings/detection/personnes/profile-1/photos', 'Personne — photos'],
  ]

  for (const [path, label] of FOLD_ROUTES) {
    test(`repli_When "Avance" appears on ${label}_Should be a closed fold`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // "Avance" is a position, not a mode (ADR-40): hence a fold, closed on load.
      const fold = page.locator('details', { has: page.getByText('Avancé', { exact: true }) })
      await expect(fold).toHaveCount(1)
      await expect(fold).not.toHaveAttribute('open', /.*/)

      await fold.getByText('Avancé', { exact: true }).click()
      await expect(fold).toHaveAttribute('open', /.*/)
    })
  }
})
