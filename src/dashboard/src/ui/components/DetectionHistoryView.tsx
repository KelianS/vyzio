import { useEffect, useState } from 'react'
import { useToast } from './Toast'
import { appErrorMessage } from '../../domain/errors/AppError'
import { toAppError } from '../../domain/errors/toAppError'
import type { CorrectDetectionIdentity } from '../../application/use-cases/CorrectDetectionIdentity'
import type { GetDetectionHistory } from '../../application/use-cases/GetDetectionHistory'
import type { GetDetectionLabels as GetCameraLabels } from '../../application/use-cases/GetDetectionLabels'
import type { GetProfiles } from '../../application/use-cases/GetProfiles'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { DetectionHistoryPage } from '../../domain/entities/DetectionHistory'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

interface DetectionHistoryViewProps {
  getDetectionHistory: GetDetectionHistory
  getCameraLabels: GetCameraLabels
  correctDetectionIdentity: CorrectDetectionIdentity
  getProfiles: GetProfiles
  apiBaseUrl: string
  onBack: () => void
}

export function DetectionHistoryView({
  getDetectionHistory,
  getCameraLabels,
  correctDetectionIdentity,
  getProfiles,
  apiBaseUrl,
}: DetectionHistoryViewProps) {
  const [page, setPage] = useState<DetectionHistoryPage | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [detectionLabels, setDetectionLabels] = useState<DetectionLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)

  const [filterCamera, setFilterCamera] = useState('')
  const [filterLabel, setFilterLabel] = useState('')
  const [filterProfileId, setFilterProfileId] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { toast } = useToast()
  const [correcting, setCorrecting] = useState<string | null>(null)

  useEffect(() => {
    getProfiles.execute().then(setProfiles).catch((e: unknown) => {
      toast(appErrorMessage(toAppError(e)), 'error')
    })
  }, [getProfiles, toast])

  useEffect(() => {
    getCameraLabels.execute()
      .then(setDetectionLabels)
      .catch((e: unknown) => {
        toast(appErrorMessage(toAppError(e)), 'error')
      })
  }, [getCameraLabels, toast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    getDetectionHistory
      .execute({
        camera: filterCamera || undefined,
        label: filterLabel || undefined,
        profileId: filterProfileId || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        page: currentPage,
        limit: 20,
      })
      .then((result) => { setPage(result); setLoading(false) })
      .catch(() => { setError("Impossible de charger l'historique."); setLoading(false) })
  }, [getDetectionHistory, filterCamera, filterLabel, filterProfileId, filterFrom, filterTo, currentPage])

  async function handleCorrect(eventId: string, profileId: string | null) {
    setCorrecting(eventId)
    try {
      await correctDetectionIdentity.execute(eventId, profileId)
      const result = await getDetectionHistory.execute({
        camera: filterCamera || undefined,
        label: filterLabel || undefined,
        profileId: filterProfileId || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        page: currentPage,
        limit: 20,
      })
      setPage(result)
      toast(profileId ? 'Reconnaissance corrigée' : 'Identité retirée', 'success')
    } catch {
      toast("Erreur lors de la correction de l'identité.", 'error')
    } finally {
      setCorrecting(null)
    }
  }

  function isoToDatetimeLocal(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function resetFilters() {
    setFilterCamera('')
    setFilterLabel('')
    setFilterProfileId('')
    setFilterFrom('')
    setFilterTo('')
    setCurrentPage(1)
  }

  return (
    <div className="app-shell app-shell-cameras">
      {snapshotUrl && (
        <div
          onClick={() => setSnapshotUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setSnapshotUrl(null)}
              style={{ position: 'absolute', top: -36, right: 0, background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
            <img src={snapshotUrl} alt="Aperçu détection" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }} />
          </div>
        </div>
      )}
      <div className="camera-toolbar panel">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Historique</p>
          <h1>Historique des detections</h1>
          <p className="camera-toolbar-lede">
            Consultez l'historique filtre et corrigez les identifications incorrectes.
          </p>
        </div>
        <div className="camera-toolbar-status">
          {page && (
            <div className="status-pill online">
              {page.total} detection{page.total !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="history-layout">
        <aside className="panel history-filters">
          <h2>Filtres</h2>

          <div className="camera-form-field">
            <label>Caméra</label>
            <input
              type="text"
              placeholder="Nom de la caméra"
              value={filterCamera}
              onChange={(e) => { setFilterCamera(e.target.value); setCurrentPage(1) }}
            />
          </div>

          <div className="camera-form-field">
            <label>Type</label>
            <select value={filterLabel} onChange={(e) => { setFilterLabel(e.target.value); setCurrentPage(1) }}>
              <option value="">Tous</option>
              {detectionLabels.map(({ value, displayName, emoji }) => (
                <option key={value} value={value}>{emoji} {displayName}</option>
              ))}
            </select>
          </div>

          <div className="camera-form-field">
            <label>Profil</label>
            <select value={filterProfileId} onChange={(e) => { setFilterProfileId(e.target.value); setCurrentPage(1) }}>
              <option value="">Tous</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="camera-form-field">
            <label>Depuis</label>
            <input type="datetime-local" value={isoToDatetimeLocal(filterFrom)} onChange={(e) => { setFilterFrom(e.target.value ? new Date(e.target.value).toISOString() : ''); setCurrentPage(1) }} />
          </div>

          <div className="camera-form-field">
            <label>Jusqu'à</label>
            <input type="datetime-local" value={isoToDatetimeLocal(filterTo)} onChange={(e) => { setFilterTo(e.target.value ? new Date(e.target.value).toISOString() : ''); setCurrentPage(1) }} />
          </div>

          <button type="button" className="secondary-cta" onClick={resetFilters}>
            Réinitialiser
          </button>
        </aside>

        <div className="history-events">
          {error && <p className="history-load-error">{error}</p>}

          {loading && <p className="history-loading">Chargement…</p>}

          {!loading && page && (
            <>
              {page.items.length === 0 ? (
                <div className="panel" style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>
                  Aucune detection pour ces filtres.
                </div>
              ) : (
                <div className="panel">
                  <div style={{ overflowX: 'auto', minWidth: 0 }}>
                  <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(247,244,237,0.15)' }}>
                        {['Date', 'Camera', 'Type', 'Confiance', 'Identite', 'Action'].map((h) => (
                          <th key={h} style={{ padding: '10px 12px', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {page.items.map((event) => (
                        <EventRow
                          key={event.eventId}
                          event={event}
                          profiles={profiles}
                          apiBaseUrl={apiBaseUrl}
                          correcting={correcting === event.eventId}
                          onCorrect={(profileId) => handleCorrect(event.eventId, profileId)}
                          onShowSnapshot={(url) => setSnapshotUrl(url)}
                        />
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {page.totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="secondary-cta"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={{ minHeight: 30, padding: '0 12px', fontSize: '0.82rem' }}
                  >
                    ← Precedent
                  </button>
                  <span style={{ opacity: 0.7, fontSize: '0.88rem' }}>
                    Page {page.page} / {page.totalPages}
                  </span>
                  <button
                    type="button"
                    className="secondary-cta"
                    onClick={() => setCurrentPage((p) => Math.min(page.totalPages, p + 1))}
                    disabled={currentPage >= page.totalPages}
                    style={{ minHeight: 30, padding: '0 12px', fontSize: '0.82rem' }}
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EventRow({
  event,
  profiles,
  apiBaseUrl,
  correcting,
  onCorrect,
  onShowSnapshot,
}: {
  event: DetectionEvent
  profiles: Profile[]
  apiBaseUrl: string
  correcting: boolean
  onCorrect: (profileId: string | null) => Promise<void>
  onShowSnapshot: (url: string) => void
}) {
  const [showCorrect, setShowCorrect] = useState(false)
  const [showClip, setShowClip] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState(event.profileId ?? '')

  async function handleApply() {
    await onCorrect(selectedProfileId || null)
    setShowCorrect(false)
  }

  const confidence = event.confidence !== null ? `${Math.round(event.confidence * 100)} %` : '—'
  const identity = event.identity ?? '—'

  return (
    <>
      <tr style={{ borderBottom: showClip ? 'none' : '1px solid rgba(247,244,237,0.07)' }}>
        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
          {new Date(event.occurredAt).toLocaleString('fr-FR')}
        </td>
        <td style={{ padding: '8px 12px' }}>{event.camera}</td>
        <td style={{ padding: '8px 12px' }}>
          <span className="camera-support-badge unknown">{event.label}</span>
        </td>
        <td style={{ padding: '8px 12px' }}>{confidence}</td>
        <td style={{ padding: '8px 12px' }}>
          {event.hasSnapshot && (
            <button
              type="button"
              onClick={() => onShowSnapshot(`${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`)}
              style={{ marginRight: 6, opacity: 0.7, fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              title="Voir l'aperçu"
            >
              🖼
            </button>
          )}
          {identity}
        </td>
        <td style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {!showCorrect ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="secondary-cta"
                  style={{ minHeight: 26, padding: '0 8px', fontSize: '0.78rem' }}
                  onClick={() => setShowCorrect(true)}
                >
                  Corriger
                </button>
                {event.hasClip && (
                  <button
                    type="button"
                    className="secondary-cta"
                    style={{ minHeight: 26, padding: '0 8px', fontSize: '0.78rem' }}
                    onClick={() => setShowClip((v) => !v)}
                  >
                    {showClip ? '✕ Clip' : '▶ Clip'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '2px 4px' }}
                >
                  <option value="">Inconnu</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="primary-cta"
                  style={{ minHeight: 26, padding: '0 8px', fontSize: '0.78rem' }}
                  onClick={handleApply}
                  disabled={correcting}
                >
                  {correcting ? '…' : 'OK'}
                </button>
                <button
                  type="button"
                  className="secondary-cta"
                  style={{ minHeight: 26, padding: '0 8px', fontSize: '0.78rem' }}
                  onClick={() => setShowCorrect(false)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {showClip && (
        <tr style={{ borderBottom: '1px solid rgba(247,244,237,0.07)' }}>
          <td colSpan={6} style={{ padding: '0 12px 12px' }}>
            <video
              src={`${apiBaseUrl}/api/detection-events/${event.eventId}/clip`}
              controls
              preload="metadata"
              style={{ width: '100%', maxHeight: 320, borderRadius: 4, background: '#000' }}
            />
          </td>
        </tr>
      )}
    </>
  )
}
