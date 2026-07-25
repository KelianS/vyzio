import { useEffect, useReducer, useState } from 'react'
import { Btn } from '../../common/components/Btn'
import { Select } from '../../common/components/Select'
import { useToast } from '../../common/components/Toast'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { Profile } from '../../domain/entities/Profile'
import { buildDetectionHistoryPresenter } from './DetectionHistory.Presenter'
import { detectionHistoryReducer } from './DetectionHistory.Reducer'
import { buildInitialDetectionHistoryUido } from './DetectionHistory.Uido'

export function DetectionHistoryView() {
  const { apiBaseUrl, detectionHistory: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(
    detectionHistoryReducer,
    undefined,
    buildInitialDetectionHistoryUido,
  )
  const presenter = usePresenter(buildDetectionHistoryPresenter, { container, dispatch, toast })

  const query = {
    camera: uido.filterCamera || undefined,
    label: uido.filterLabel || undefined,
    profileId: uido.filterProfileId || undefined,
    from: uido.filterFrom || undefined,
    to: uido.filterTo || undefined,
    page: uido.currentPage,
    limit: 20,
  }

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  useEffect(() => {
    presenter.onLoadHistory(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    presenter,
    uido.filterCamera,
    uido.filterLabel,
    uido.filterProfileId,
    uido.filterFrom,
    uido.filterTo,
    uido.currentPage,
  ])

  function isoToDatetimeLocal(iso: string): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="app-shell app-shell-cameras">
      {uido.snapshotUrl && (
        <div
          onClick={() => presenter.onSnapshotSet(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => presenter.onSnapshotSet(null)}
              style={{
                position: 'absolute',
                top: -36,
                right: 0,
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '1.5rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <img
              src={uido.snapshotUrl}
              alt="Aperçu détection"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, display: 'block' }}
            />
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
          {uido.page && (
            <div className="status-pill online">
              {uido.page.total} detection{uido.page.total !== 1 ? 's' : ''}
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
              value={uido.filterCamera}
              onChange={(e) => presenter.onFilterCameraChange(e.target.value)}
            />
          </div>

          <div className="camera-form-field">
            <label>Type</label>
            <Select
              value={uido.filterLabel}
              onChange={(e) => presenter.onFilterLabelChange(e.target.value)}
            >
              <option value="">Tous</option>
              {uido.detectionLabels.map(({ value, displayName, emoji }) => (
                <option key={value} value={value}>
                  {emoji} {displayName}
                </option>
              ))}
            </Select>
          </div>

          <div className="camera-form-field">
            <label>Profil</label>
            <Select
              value={uido.filterProfileId}
              onChange={(e) => presenter.onFilterProfileChange(e.target.value)}
            >
              <option value="">Tous</option>
              {uido.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="camera-form-field">
            <label>Depuis</label>
            <input
              type="datetime-local"
              value={isoToDatetimeLocal(uido.filterFrom)}
              onChange={(e) =>
                presenter.onFilterFromChange(
                  e.target.value ? new Date(e.target.value).toISOString() : '',
                )
              }
            />
          </div>

          <div className="camera-form-field">
            <label>Jusqu'à</label>
            <input
              type="datetime-local"
              value={isoToDatetimeLocal(uido.filterTo)}
              onChange={(e) =>
                presenter.onFilterToChange(
                  e.target.value ? new Date(e.target.value).toISOString() : '',
                )
              }
            />
          </div>

          <Btn variant="secondary" size="sm" onClick={() => presenter.onResetFilters()}>
            Réinitialiser
          </Btn>
        </aside>

        <div className="history-events">
          {uido.error && <p className="history-load-error">{uido.error}</p>}

          {uido.loading && <p className="history-loading">Chargement…</p>}

          {!uido.loading && uido.page && (
            <>
              {uido.page.items.length === 0 ? (
                <div className="panel" style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>
                  Aucune detection pour ces filtres.
                </div>
              ) : (
                <div className="panel">
                  <div style={{ overflowX: 'auto', minWidth: 0 }}>
                    <table
                      style={{
                        width: '100%',
                        minWidth: 540,
                        borderCollapse: 'collapse',
                        fontSize: '0.88rem',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(247,244,237,0.15)',
                          }}
                        >
                          {['Date', 'Camera', 'Type', 'Confiance', 'Identite', 'Action'].map(
                            (h) => (
                              <th key={h} style={{ padding: '10px 12px', fontWeight: 600 }}>
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {uido.page.items.map((event) => (
                          <EventRow
                            key={event.eventId}
                            event={event}
                            profiles={uido.profiles}
                            apiBaseUrl={apiBaseUrl}
                            correcting={uido.correctingEventId === event.eventId}
                            onCorrect={(profileId) =>
                              presenter.onCorrect(event.eventId, profileId, query)
                            }
                            onShowSnapshot={(url) => presenter.onSnapshotSet(url)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {uido.page.totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 12,
                    justifyContent: 'center',
                  }}
                >
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() => presenter.onPageChange(Math.max(1, uido.currentPage - 1))}
                    disabled={uido.currentPage <= 1}
                  >
                    ← Precedent
                  </Btn>
                  <span style={{ opacity: 0.7, fontSize: '0.88rem' }}>
                    Page {uido.page.page} / {uido.page.totalPages}
                  </span>
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      presenter.onPageChange(Math.min(uido.page!.totalPages, uido.currentPage + 1))
                    }
                    disabled={uido.currentPage >= uido.page.totalPages}
                  >
                    Suivant →
                  </Btn>
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
              onClick={() =>
                onShowSnapshot(`${apiBaseUrl}/api/detection-events/${event.eventId}/snapshot`)
              }
              style={{
                marginRight: 6,
                opacity: 0.7,
                fontSize: '0.8rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
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
                <Btn variant="secondary" size="sm" onClick={() => setShowCorrect(true)}>
                  Corriger
                </Btn>
                {event.hasClip && (
                  <Btn variant="ghost" size="sm" onClick={() => setShowClip((v) => !v)}>
                    {showClip ? '✕ Clip' : '▶ Clip'}
                  </Btn>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Select
                  size="sm"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                >
                  <option value="">Inconnu</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Btn variant="primary" size="sm" loading={correcting} onClick={handleApply}>
                  OK
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => setShowCorrect(false)}>
                  ×
                </Btn>
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
