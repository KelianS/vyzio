import { describe, expect, it } from 'vitest'
import { privacyWording } from './privacy_request'

describe('privacyWording', () => {
  it.each([
    {
      request: { cameraIds: ['c1', 'c2'], active: true, cameraLabel: null },
      wording: {
        title: 'Couper toutes les caméras ?',
        body: 'Plus rien n’est enregistré ni signalé tant que vous ne les rallumez pas.',
        confirmLabel: 'Tout couper',
        done: 'Caméras coupées.',
      },
    },
    {
      request: { cameraIds: ['c1'], active: true, cameraLabel: 'Salon' },
      wording: {
        title: 'Mettre « Salon » en pause ?',
        body: 'Plus rien n’est enregistré ni signalé par cette caméra tant que vous ne la rallumez pas.',
        confirmLabel: 'Mettre en pause',
        done: 'Salon est en pause.',
      },
    },
    {
      request: { cameraIds: ['c1', 'c2'], active: false, cameraLabel: null },
      wording: {
        title: 'Reprendre la surveillance ?',
        body: 'Les caméras recommencent à enregistrer et à vous signaler ce qu’elles voient.',
        confirmLabel: 'Reprendre',
        done: 'Surveillance reprise.',
      },
    },
    {
      request: { cameraIds: ['c1'], active: false, cameraLabel: 'Salon' },
      wording: {
        title: 'Reprendre la surveillance ?',
        body: 'Cette caméra recommence à enregistrer et à vous signaler ce qu’elle voit.',
        confirmLabel: 'Reprendre',
        done: 'Salon est de nouveau surveillée.',
      },
    },
  ])(
    'privacyWording_ShouldNameWhatIsCutOrResumed_WhenOneOrAllCamerasAreAimedAt (active: $request.active, camera: $request.cameraLabel)',
    ({ request, wording }) => {
      // Arrange & Act
      const said = privacyWording(request)

      // Assert
      expect(said).toEqual(wording)
    },
  )
})
