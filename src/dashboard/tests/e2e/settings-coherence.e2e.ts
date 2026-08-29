import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Ce qui ne se juge qu'en comparant les ecrans entre eux (BACKLOG `config-ui` 11).
 *
 * Chaque ecran est conforme isolement : c'est la comparaison qui revele une
 * colonne de controle qui se decale, ou un repli « Avance » qui n'en est pas un.
 * Ces deux invariants sont geometriques et structurels, donc verifiables — a la
 * difference du vocabulaire, qui reste une relecture humaine.
 */

const SETTINGS_ROUTES: [string, string][] = [
  ['/settings/cameras/camera-1/detection', 'Camera — detection'],
  ['/settings/cameras/camera-1/conservation', 'Camera — conservation'],
  ['/settings/cameras/camera-1/vie-privee', 'Camera — vie privee'],
  ['/settings/cameras/camera-1/image', 'Camera — image'],
  ['/settings/cameras/camera-1/connexion', 'Camera — connexion'],
  ['/settings/conservation', 'Conservation (installation)'],
  // Les reglages sont dans le canal, pas dans la liste qui y mene.
  ['/settings/notifications/telegram', 'Notifications — Telegram'],
  ['/settings/notifications/discord', 'Notifications — Discord'],
  ['/settings/detection/personnes/profile-1/identite', 'Personne — identite'],
]

interface FieldMeasure {
  id: string
  /** Bord droit de la colonne reservee au controle. */
  column: number
  /** Bord droit de ce que le controle **occupe reellement**. */
  filled: number
}

/**
 * Ce que chaque controle en forme de champ laisse vide au bout de sa colonne.
 *
 * On ne mesure pas la cellule : la grille l'etire, elle serait alignee meme avec un
 * champ minuscule flottant dedans — c'est exactement le defaut qu'on cherche.
 *
 * Exclu, car sa largeur est celle de l'objet et non de la colonne : l'interrupteur.
 */
async function fieldMeasures(page: Page): Promise<FieldMeasure[]> {
  return page.$$eval('[data-setting-control]', (cells) =>
    cells
      .map((cell): FieldMeasure | null => {
        const root = cell.firstElementChild?.firstElementChild
        if (!root) return null
        if (root.matches('[role="switch"]') || root.querySelector('[role="switch"]')) return null

        // Quand le controle est lui-meme l'element interactif, il occupe la colonne par
        // construction ; ses enfants sont sa doublure interne, jamais du vide.
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
    // Un champ qui n'occupe pas sa colonne casse l'alignement vertical des valeurs,
    // et la page cesse d'etre balayable — ce que l'anatomie fixe visait (ADR-43).
    for (const [path, label] of SETTINGS_ROUTES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const measures = await fieldMeasures(page)
      expect(measures.length, `${label} ne declare aucun reglage`).toBeGreaterThan(0)

      // 2px de tolerance : arrondis de sous-pixel, pas de la place perdue.
      const short = measures.filter((field) => field.column - field.filled > 2)
      expect(short, `${label} : champs plus courts que leur colonne`).toEqual([])
    }
  })

  test('hierarchie_When a page groups its settings_Should set section titles apart from labels', async ({
    page,
  }) => {
    // Titre de section et libelle de reglage rendus pareil, c'est une page ou
    // tout est au meme niveau : les sections ne separent alors plus rien.
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

      // « Avance » est une position, pas un mode (ADR-40) : donc un repli, ferme au chargement.
      const fold = page.locator('details', { has: page.getByText('Avancé', { exact: true }) })
      await expect(fold).toHaveCount(1)
      await expect(fold).not.toHaveAttribute('open', /.*/)

      await fold.getByText('Avancé', { exact: true }).click()
      await expect(fold).toHaveAttribute('open', /.*/)
    })
  }
})
