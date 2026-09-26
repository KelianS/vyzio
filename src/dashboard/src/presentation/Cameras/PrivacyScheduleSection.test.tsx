import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyScheduleSection } from './PrivacyScheduleSection'
import type { Camera } from '../../domain/entities/Camera'
import type { CameraPrivacySchedule } from '../../domain/entities/CameraPrivacySchedule'
import type { GetCameraPrivacySchedules } from '../../domain/usecases/GetCameraPrivacySchedules'
import type { CreateCameraPrivacySchedule } from '../../domain/usecases/CreateCameraPrivacySchedule'
import type { DeleteCameraPrivacySchedule } from '../../domain/usecases/DeleteCameraPrivacySchedule'
import { HttpError } from '../../infrastructure/http/HttpError'

function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    slug: 'front-door',
    displayName: 'Front Door',
    sourceType: 'rtsp_manual',
    host: '192.168.1.10',
    port: 554,
    streamProtocol: 'rtsp',
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    lastReachabilityCheckAt: null,
    lastSuccessfulFrameAt: null,
    frigateCameraName: 'front_door',
    vendorFamily: null,
    privacyModeActive: false,
    privacyModeSource: null,
    privacyVendorCut: false,
    ptzSupported: false,
    privacyStrategy: 'software_blur',
    supportedProtocols: [],
    connected: true,
    verifiedCapabilities: [],
    ...overrides,
  }
}

function makeSchedule(overrides: Partial<CameraPrivacySchedule> = {}): CameraPrivacySchedule {
  return {
    id: 'schedule-1',
    cameraId: 'camera-1',
    enabled: true,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('PrivacyScheduleSection', () => {
  it('shows an empty state when no schedules exist', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as GetCameraPrivacySchedules
    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    expect(await screen.findByText('Aucune planification configurée.')).toBeInTheDocument()
  })

  it('lists existing schedules with day labels and times', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([makeSchedule()]),
    } as unknown as GetCameraPrivacySchedules

    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    expect(await screen.findByText('Lun, Mar, Mer, Jeu, Ven')).toBeInTheDocument()
    expect(screen.getByText('22:00 → 06:00 le lendemain')).toBeInTheDocument()
  })

  it('PrivacyScheduleSection_ShouldSayTheRangeEndsTheNextDay_WhenTheEndIsBeforeTheStart', async () => {
    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={
          { execute: vi.fn().mockResolvedValue([]) } as unknown as GetCameraPrivacySchedules
        }
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    expect(
      await screen.findByText('La plage passe minuit : elle se termine le lendemain à 06:00.'),
    ).toBeInTheDocument()
  })

  it('PrivacyScheduleSection_ShouldNotAnnounceTheNextDay_WhenTheEndIsNotSet', async () => {
    const user = userEvent.setup()
    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={
          { execute: vi.fn().mockResolvedValue([]) } as unknown as GetCameraPrivacySchedules
        }
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )
    await screen.findByText('La plage passe minuit : elle se termine le lendemain à 06:00.')

    await user.clear(screen.getByLabelText('Fin'))

    expect(screen.queryByText(/passe minuit/)).not.toBeInTheDocument()
  })

  it('PrivacyScheduleSection_ShouldSayWhatToChange_WhenTheServerRefusesAnEmptyRange', async () => {
    const createSchedule = {
      execute: vi
        .fn()
        .mockRejectedValue(
          new HttpError(
            400,
            '/api/cameras/camera-1/privacy/schedules',
            'POST /api/cameras/camera-1/privacy/schedules 400 schedule_empty_range',
            'schedule_empty_range',
          ),
        ),
    } as unknown as CreateCameraPrivacySchedule
    const user = userEvent.setup()
    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={
          { execute: vi.fn().mockResolvedValue([]) } as unknown as GetCameraPrivacySchedules
        }
        createSchedule={createSchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )
    await screen.findByText('Aucune planification configurée.')

    await user.click(screen.getByRole('button', { name: /Ajouter/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le début et la fin sont à la même heure : choisissez deux heures différentes',
    )
  })

  it('shows a hardware privacy cut badge when the camera reports vendor cut', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as GetCameraPrivacySchedules

    render(
      <PrivacyScheduleSection
        camera={makeCamera({ privacyVendorCut: true })}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    expect(await screen.findByText(/Coupure matérielle confirmée/)).toBeInTheDocument()
  })

  it('requires at least one day selected before adding a schedule', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as GetCameraPrivacySchedules
    const createSchedule = { execute: vi.fn() } as unknown as CreateCameraPrivacySchedule
    const user = userEvent.setup()

    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={createSchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    await screen.findByText('Aucune planification configurée.')

    for (const label of ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']) {
      await user.click(screen.getByText(label))
    }

    await user.click(screen.getByText('Ajouter à cette caméra'))

    expect(await screen.findByText('Sélectionnez au moins un jour.')).toBeInTheDocument()
    expect(createSchedule.execute).not.toHaveBeenCalled()
  })

  it('creates a schedule for the current camera and reloads the list', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([makeSchedule()]),
    } as unknown as GetCameraPrivacySchedules
    const createSchedule = {
      execute: vi.fn().mockResolvedValue(makeSchedule()),
    } as unknown as CreateCameraPrivacySchedule
    const user = userEvent.setup()

    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={createSchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    await screen.findByText('Aucune planification configurée.')
    await user.click(screen.getByText('Ajouter à cette caméra'))

    await waitFor(() => {
      expect(createSchedule.execute).toHaveBeenCalledWith('camera-1', {
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: '22:00',
        endTime: '06:00',
      })
    })
    expect(await screen.findByText('22:00 → 06:00 le lendemain')).toBeInTheDocument()
  })

  it('only offers "apply to all" when there is more than one camera', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as GetCameraPrivacySchedules

    const { rerender } = render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )
    await screen.findByText('Aucune planification configurée.')
    expect(screen.queryByText(/Appliquer à toutes/)).not.toBeInTheDocument()

    rerender(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera(), makeCamera({ id: 'camera-2' })]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={{ execute: vi.fn() } as unknown as DeleteCameraPrivacySchedule}
      />,
    )

    expect(await screen.findByText('Appliquer à toutes (2)')).toBeInTheDocument()
  })

  it('deletes a schedule when the delete button is clicked', async () => {
    const getSchedules = {
      execute: vi.fn().mockResolvedValue([makeSchedule()]),
    } as unknown as GetCameraPrivacySchedules
    const deleteSchedule = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeleteCameraPrivacySchedule
    const user = userEvent.setup()

    render(
      <PrivacyScheduleSection
        camera={makeCamera()}
        cameraId="camera-1"
        allCameras={[makeCamera()]}
        getSchedules={getSchedules}
        createSchedule={{ execute: vi.fn() } as unknown as CreateCameraPrivacySchedule}
        deleteSchedule={deleteSchedule}
      />,
    )

    await screen.findByText('22:00 → 06:00 le lendemain')
    await user.click(screen.getByTitle('Supprimer'))

    await waitFor(() => {
      expect(deleteSchedule.execute).toHaveBeenCalledWith('camera-1', 'schedule-1')
    })
    expect(screen.queryByText('22:00 → 06:00 le lendemain')).not.toBeInTheDocument()
  })
})
