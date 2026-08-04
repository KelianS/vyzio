import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PtzControlPanel } from './PtzControlPanel'
import { ToastProvider } from './Toast'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { PtzStep } from '../../domain/usecases/PtzStep'

function makePreset(overrides: Partial<PtzPreset> = {}): PtzPreset {
  return {
    presetId: 1,
    label: 'Surveillance',
    native: false,
    stepsX: 3,
    stepsY: 2,
    configured: true,
    ...overrides,
  }
}

interface Harness {
  presets?: PtzPreset[]
  calibrated?: boolean
  currentPosition?: { x: number; y: number } | null
}

function renderPanel({ presets = [], calibrated = true, currentPosition = null }: Harness = {}) {
  const getPtzPresets = {
    execute: vi.fn().mockResolvedValue({ presets, calibrated, currentPosition }),
  } as unknown as GetPtzPresets
  const ptzSaveCurrentAsPreset = {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as PtzSaveCurrentAsPreset
  const ptzGoToPreset = {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as PtzGoToPreset
  const ptzCalibrate = {
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as PtzCalibrate
  const ptzStep = { execute: vi.fn().mockResolvedValue(undefined) } as unknown as PtzStep

  render(
    <ToastProvider>
      <PtzControlPanel
        cameraId="camera-1"
        apiBaseUrl=""
        ptzStep={ptzStep}
        ptzGoToPreset={ptzGoToPreset}
        getPtzPresets={getPtzPresets}
        ptzSaveCurrentAsPreset={ptzSaveCurrentAsPreset}
        ptzCalibrate={ptzCalibrate}
      />
    </ToastProvider>,
  )

  return { getPtzPresets, ptzSaveCurrentAsPreset, ptzGoToPreset, ptzCalibrate }
}

describe('PtzControlPanel', () => {
  it('enregistre une position encore vide d’un simple appui', async () => {
    const { ptzSaveCurrentAsPreset } = renderPanel()

    const empty = await screen.findAllByTitle('Enregistrer la position actuelle ici')
    await userEvent.click(empty[0])

    // Un appui long serait le geste de l'ecrasement : il n'y a rien a ecraser.
    await waitFor(() => expect(ptzSaveCurrentAsPreset.execute).toHaveBeenCalledWith('camera-1', 1))
  })

  it('accuse l’arrivée sur une position enregistrée', async () => {
    const { ptzGoToPreset } = renderPanel({ presets: [makePreset()] })

    const tile = await screen.findByTitle(/Surveillance — appui/)
    await userEvent.click(tile)

    expect(ptzGoToPreset.execute).toHaveBeenCalledWith('camera-1', 1)
    expect(await screen.findByText('Caméra en position « Surveillance ».')).toBeInTheDocument()
  })

  it('montre sur quelle position la caméra se trouve', async () => {
    renderPanel({
      presets: [makePreset({ presetId: 2, label: 'Parking', stepsX: 7, stepsY: 4 })],
      currentPosition: { x: 7, y: 4 },
    })

    const tile = await screen.findByTitle(/Parking — appui/)
    expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

  it('dit pourquoi les positions sont inertes quand la caméra n’est pas calibrée', async () => {
    const { ptzCalibrate } = renderPanel({ calibrated: false })

    expect(await screen.findByText(/pas de position de référence/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Calibrer maintenant' }))
    await waitFor(() => expect(ptzCalibrate.execute).toHaveBeenCalledWith('camera-1'))
  })

  it('n’ouvre pas le menu contextuel du navigateur sur une position', async () => {
    renderPanel({ presets: [makePreset()] })

    const tile = await screen.findByTitle(/Surveillance — appui/)
    // L'appui long est notre geste de redefinition ; le menu du navigateur le volait sur mobile.
    expect(fireEvent.contextMenu(tile)).toBe(false)
  })
})
