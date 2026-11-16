import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { barAlerts, formatSince, stillDismissed, trackFirstSeen } from './bar_alerts'

function stats(overrides: Partial<SystemStats> = {}): SystemStats {
  return {
    status: 'active',
    storage: { totalGb: 100, usedGb: 40, freeGb: 60 },
    cameras: [],
    detection: { hardware: 'cpu', targetFps: 5 },
    pendingChanges: false,
    ...overrides,
  }
}

const QUIET = {
  cameras: [],
  systemStats: stats(),
  hubLost: false,
  restartFailed: false,
  privacyActing: [],
  privacyMissesTold: [],
}

const MISSED = {
  id: 'c-3',
  displayName: 'Salon',
  privacyModeActive: true,
  privacyModeSource: 'schedule' as const,
  privacyStrategy: PrivacyStrategy.PtzParking,
  privacyMiss: PrivacyMiss.CameraFailed,
}

describe('barAlerts', () => {
  it('barAlerts_ShouldRaiseNothing_WhenAllIsWell', () => {
    // Arrange & Act
    const alerts = barAlerts(QUIET)

    // Assert
    expect(alerts).toEqual([])
  })

  it('barAlerts_ShouldNameTheCamera_WhenAWatchedOneIsOffline', () => {
    // Arrange
    const cameras = [makeCamera({ id: 'c-2', displayName: 'Jardin', status: 'offline' })]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras })

    // Assert
    expect(alerts).toEqual([
      {
        key: 'camera-offline:c-2',
        title: 'Jardin ne répond plus',
        since: 'Hors ligne depuis',
        to: '/cameras/c-2',
        dismissible: true,
      },
    ])
  })

  it('barAlerts_ShouldNameTheCameraAndTheConsequence_WhenARangeCutItAndItDidNotFollow', () => {
    // Arrange
    const cameras = [makeCamera(MISSED)]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras })

    // Assert
    expect(alerts).toEqual([
      {
        key: 'privacy-miss:c-3:on:camera_failed',
        title: 'Salon : la caméra ne s’est pas tournée',
        detail: 'Enregistrement désactivé',
        to: '/cameras/c-3',
        dismissible: true,
      },
    ])
  })

  it('barAlerts_ShouldSayWhatIsMissing_WhenARangeCouldNotTurnTheCamera', () => {
    // Arrange
    const cameras = [makeCamera({ ...MISSED, privacyMiss: PrivacyMiss.PositionMissing })]

    // Act
    const [alert] = barAlerts({ ...QUIET, cameras })

    // Assert
    expect(alert.detail).toBe('Sa position Parking n’est pas enregistrée')
  })

  it('barAlerts_ShouldLeaveTheMissOut_WhenAToastAlreadyToldIt', () => {
    // Arrange
    const cameras = [makeCamera(MISSED)]

    // Act
    const alerts = barAlerts({
      ...QUIET,
      cameras,
      privacyMissesTold: ['privacy-miss:c-3:on:camera_failed'],
    })

    // Assert
    expect(alerts).toEqual([])
  })

  it('barAlerts_ShouldLeaveTheMissToTheAct_WhenTheUserIsCuttingTheCamera', () => {
    // Arrange
    const cameras = [makeCamera(MISSED)]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras, privacyActing: ['c-3'] })

    // Assert
    expect(alerts).toEqual([])
  })

  it('barAlerts_ShouldOnlySayTheCameraIsOffline_WhenAnOfflineCameraDidNotFollow', () => {
    // Arrange
    const cameras = [makeCamera({ ...MISSED, status: 'offline' })]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras })

    // Assert
    expect(alerts.map((alert) => alert.title)).toEqual(['Salon ne répond plus'])
  })

  it('barAlerts_ShouldStayQuiet_WhenTheOfflineCameraIsStillToSetUp', () => {
    // Arrange
    const cameras = [makeCamera({ status: 'offline', validationState: 'to_set_up' })]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras })

    // Assert
    expect(alerts).toEqual([])
  })

  it.each([
    ['restarting', 'La surveillance redémarre'],
    ['unavailable', 'La surveillance est arrêtée'],
  ] as const)(
    'barAlerts_ShouldSayWhereSurveillanceStands_WhenItIsNotRunning (%s)',
    (status, title) => {
      // Arrange & Act
      const alerts = barAlerts({ ...QUIET, systemStats: stats({ status }) })

      // Assert
      expect(alerts.map((alert) => alert.title)).toEqual([title])
    },
  )

  it('barAlerts_ShouldSayTheDiskIsAlmostFull_WhenItPassesTheCriticalShare', () => {
    // Arrange
    const systemStats = stats({ storage: { totalGb: 100, usedGb: 95, freeGb: 5 } })

    // Act
    const alerts = barAlerts({ ...QUIET, systemStats })

    // Assert
    expect(alerts).toEqual([
      {
        key: 'storage-critical',
        title: 'Disque presque plein',
        detail: '5 Go libres',
        to: '/settings/retention',
        dismissible: true,
      },
    ])
  })

  it('barAlerts_ShouldLeadToTheSettings_WhenARestartFailed', () => {
    // Arrange & Act
    const alerts = barAlerts({ ...QUIET, restartFailed: true })

    // Assert
    expect(alerts.map((alert) => alert.to)).toEqual(['/settings'])
  })

  it('barAlerts_ShouldKeepOnlyTheLoss_WhenVyzioCannotBeReached', () => {
    // Arrange
    const cameras = [makeCamera({ status: 'offline' })]

    // Act
    const alerts = barAlerts({ ...QUIET, cameras, hubLost: true, restartFailed: true })

    // Assert
    expect(alerts).toEqual([
      {
        key: 'hub-lost',
        title: 'Vyzio ne répond plus',
        since: 'Injoignable depuis',
        dismissible: false,
      },
    ])
  })
})

describe('trackFirstSeen', () => {
  it('trackFirstSeen_ShouldKeepTheFirstMomentAndForgetEndedAlerts_WhenTheAlertsChange', () => {
    // Arrange
    const seen = { lasting: 1_000, ended: 2_000 }

    // Act
    const tracked = trackFirstSeen(seen, ['lasting', 'new'], 9_000)

    // Assert
    expect(tracked).toEqual({ lasting: 1_000, new: 9_000 })
  })
})

describe('stillDismissed', () => {
  it('stillDismissed_ShouldForgetASetAsideAlert_WhenItsCauseHasEnded', () => {
    // Arrange & Act
    const kept = stillDismissed(
      ['camera-offline:c-1', 'storage-critical'],
      ['storage-critical'],
      true,
    )

    // Assert
    expect(kept).toEqual(['storage-critical'])
  })

  it('stillDismissed_ShouldKeepEverySetAsideAlert_WhenTheFactsAreNotReadYet', () => {
    // Arrange & Act
    const kept = stillDismissed(['camera-offline:c-1', 'storage-critical'], [], false)

    // Assert
    expect(kept).toEqual(['camera-offline:c-1', 'storage-critical'])
  })
})

describe('formatSince', () => {
  it.each([
    [30_000, 'moins d’une minute'],
    [4 * 60_000, '4 min'],
    [125 * 60_000, '2 h'],
  ])('formatSince_ShouldReadAsTheBarSaysIt_WhenTimeHasPassed (%i ms)', (elapsed, text) => {
    // Arrange & Act
    const since = formatSince(elapsed)

    // Assert
    expect(since).toBe(text)
  })
})
