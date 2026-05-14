import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ApplyCamera } from '../../application/use-cases/ApplyCamera'
import type { CreateCamera } from '../../application/use-cases/CreateCamera'
import type { DeleteCamera } from '../../application/use-cases/DeleteCamera'
import type { DiscoverCameras } from '../../application/use-cases/DiscoverCameras'
import type { GetCameraStatus } from '../../application/use-cases/GetCameraStatus'
import type { GetCameras } from '../../application/use-cases/GetCameras'
import type { GetVendorAssistance } from '../../application/use-cases/GetVendorAssistance'
import type { VerifyCamera } from '../../application/use-cases/VerifyCamera'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import { useCameraStatus } from '../hooks/useCameraStatus'
import { useCameras } from '../hooks/useCameras'
import { useVendorAssistance } from '../hooks/useVendorAssistance'
import {
  formatCameraAddress,
  formatCameraCheck,
  formatCameraPreview,
  formatCameraStatusLabel,
  formatStatusTone,
  formatValidationStateLabel,
} from '../formatters/cameras'

interface CameraOnboardingViewProps {
  getCameras: GetCameras
  getCameraStatus: GetCameraStatus
  discoverCameras: DiscoverCameras
  getVendorAssistance: GetVendorAssistance
  createCamera: CreateCamera
  verifyCamera: VerifyCamera
  applyCamera: ApplyCamera
  deleteCamera: DeleteCamera
}

type DiscoveryCandidate = {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  discoverySource: string
  note: string | null
  macAddress: string | null
  qualification: string
  supportLevel: string
  vendorFamily: string | null
  qualificationReasons: string[]
  vendorDocumentation?: {
    vendorFamily: string
    markdown: string
  } | null
  technicalDetails?: {
    resolvedHostName: string | null
    httpPortsDetected: number[]
    rtspPortsDetected: number[]
    onvifPortsDetected: number[]
    rtspPathsDetected: string[]
  } | null
}

type CameraSelection =
  | { kind: 'manual' }
  | { kind: 'candidate'; index: number }
  | { kind: 'camera'; cameraId: string }

const emptyForm: CameraDraftInput = {
  displayName: '',
  host: '',
  port: 554,
  username: null,
  password: null,
  streamPath: null,
  sourceType: 'rtsp_manual',
  detectionPreset: 'person_default',
}

export function CameraOnboardingView(props: CameraOnboardingViewProps) {
  const camerasState = useCameras(props.getCameras)
  const [selection, setSelection] = useState<CameraSelection>({ kind: 'manual' })
  const selectedCameraId = selection.kind === 'camera' ? selection.cameraId : null
  const cameraStatusState = useCameraStatus(props.getCameraStatus, selectedCameraId)
  const [form, setForm] = useState<CameraDraftInput>(emptyForm)
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryCandidate[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [detailMessage, setDetailMessage] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const selectedCandidate = selection.kind === 'candidate'
    ? discoveryResults[selection.index] ?? null
    : null

  const selectedCamera = selectedCameraId
    ? camerasState.data.find((camera) => camera.id === selectedCameraId) ?? null
    : null

  const matchedDiscoveryCandidate = selectedCamera
    ? discoveryResults.find((candidate) =>
        candidate.host === selectedCamera.host
        && candidate.port === selectedCamera.port)
      ?? null
    : null

  const activeVendorFamily = selectedCandidate?.vendorFamily
    ?? matchedDiscoveryCandidate?.vendorFamily
    ?? null

  const activeStreamPath = selectedCandidate?.streamPath
    ?? matchedDiscoveryCandidate?.streamPath
    ?? null

  const vendorAssistanceState = useVendorAssistance(
    props.getVendorAssistance,
    activeVendorFamily,
    activeStreamPath,
    cameraStatusState.data?.connected ?? false,
  )

  const selectedCandidateNeedsRtspActivation = Boolean(selectedCandidate && !selectedCandidate.streamPath)
  const canShowCandidateForm = selection.kind === 'manual' || Boolean(selectedCandidate && selectedCandidate.streamPath)

  useEffect(() => {
    if (selection.kind === 'camera' && !camerasState.data.some((camera) => camera.id === selection.cameraId)) {
      setSelection(camerasState.data.length > 0
        ? { kind: 'camera', cameraId: camerasState.data[0].id }
        : { kind: 'manual' })
    }
  }, [camerasState.data, selection])

  useEffect(() => {
    if (selection.kind === 'candidate' && !discoveryResults[selection.index]) {
      setSelection({ kind: 'manual' })
    }
  }, [discoveryResults, selection])

  async function handleDiscovery() {
    setDiscoveryLoading(true)
    setDiscoveryError(null)
    setFormError(null)

    try {
      const candidates = await props.discoverCameras.execute()
      setDiscoveryResults(candidates)
      if (candidates.length > 0) {
        selectDiscoveryCandidate(0, candidates)
      }
      setFormMessage(candidates.length > 0 ? `${candidates.length} camera(s) candidate(s) detectee(s).` : 'Aucune camera detectee automatiquement.')
    } catch (error: unknown) {
      setDiscoveryError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  async function handleCreate() {
    setActionLoading(true)
    setFormError(null)
    setFormMessage(null)
    setDetailMessage(null)

    try {
      const created = await props.createCamera.execute(form)
      camerasState.reload()
      setSelection({ kind: 'camera', cameraId: created.id })
      setFormMessage(`Camera "${created.displayName}" ajoutee au catalogue.`)
      setDetailMessage(`Camera "${created.displayName}" est prete pour verification.`)
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleVerify() {
    if (!selectedCameraId) {
      return
    }

    setActionLoading(true)
    setDetailError(null)
    setDetailMessage(null)

    try {
      const status = await props.verifyCamera.execute(selectedCameraId)
      camerasState.reload()
      cameraStatusState.reload()
      setDetailMessage(status.guidance ?? 'Verification terminee.')
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApply() {
    if (!selectedCameraId) {
      return
    }

    setActionLoading(true)
    setDetailError(null)
    setDetailMessage(null)

    try {
      const result = await props.applyCamera.execute(selectedCameraId)
      camerasState.reload()
      cameraStatusState.reload()

      if (!result.applied) {
        setDetailError(result.message)
        return
      }

      setDetailMessage(`${result.message} (${result.configPath})`)
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedCameraId) {
      return
    }

    setActionLoading(true)
    setDetailError(null)
    setDetailMessage(null)

    try {
      const deletedCameraId = selectedCameraId
      const result = await props.deleteCamera.execute(selectedCameraId)
      const remainingCameras = camerasState.data.filter((camera) => camera.id !== deletedCameraId)

      camerasState.removeById(deletedCameraId)
      cameraStatusState.clear()

      if (remainingCameras.length > 0) {
        setSelection({ kind: 'camera', cameraId: remainingCameras[0].id })
        setDetailMessage(result.message)
        setFormMessage(null)
      } else {
        setSelection({ kind: 'manual' })
        setFormMessage(result.message)
        setDetailMessage(null)
      }

      camerasState.reload()
    } catch (error: unknown) {
      setDetailError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  function updateForm(patch: Partial<CameraDraftInput>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function selectDiscoveryCandidate(index: number, source = discoveryResults) {
    const candidate = source[index]
    if (!candidate) {
      return
    }

    setSelection({ kind: 'candidate', index })
    updateForm({
      displayName: candidate.displayName,
      host: candidate.host,
      port: candidate.port,
      sourceType: candidate.sourceType,
      streamPath: candidate.streamPath,
    })
    setFormMessage(null)
  }

  function selectManualEntry() {
    setSelection({ kind: 'manual' })
    setFormMessage('Renseignez les informations minimales de la camera pour l\'ajouter au catalogue.')
    setDetailError(null)
  }

  function selectCamera(cameraId: string) {
    setSelection({ kind: 'camera', cameraId })
    setDetailError(null)
  }

  function hasVendorDocumentation(candidate: DiscoveryCandidate | null) {
    return Boolean(candidate?.vendorDocumentation?.markdown?.trim())
  }

  function isSupportedCandidate(candidate: DiscoveryCandidate | null) {
    return Boolean(candidate && (candidate.supportLevel !== 'unknown' || hasVendorDocumentation(candidate)))
  }

  function formatSupportLabel(candidate: DiscoveryCandidate | null) {
    return isSupportedCandidate(candidate) ? 'Supporte' : 'Inconnu'
  }

  function supportBadgeTone(candidate: DiscoveryCandidate | null) {
    return isSupportedCandidate(candidate) ? 'supported' : 'unknown'
  }

  function formatVendorFamily(vendorFamily: string | null) {
    switch (vendorFamily) {
      case 'v380_pro':
        return 'V380 PRO'
      case 'tplink_tapo':
        return 'TP-Link Tapo'
      default:
        return vendorFamily ?? 'Constructeur inconnu'
    }
  }

  function formatCandidateAddress(candidate: DiscoveryCandidate) {
    return candidate.port > 0 ? `${candidate.host}:${candidate.port}` : candidate.host
  }

  function formatMutedValue(value: string | null | undefined) {
    return value && value.trim() ? value : '—'
  }

  function formatMutedList(values: Array<string | number> | null | undefined) {
    return values && values.length > 0 ? values.join(', ') : '—'
  }

  function formatOptionalVendor(vendorFamily: string | null) {
    return vendorFamily ? formatVendorFamily(vendorFamily) : '—'
  }

  function formatDiscoverySource(discoverySource: string) {
    switch (discoverySource) {
      case 'onvif':
        return 'ONVIF multicast'
      case 'onvif_unicast':
        return 'ONVIF unicast'
      case 'mac_vendor_probe':
        return 'MAC constructeur'
      case 'hostname_probe':
        return 'Nom reseau'
      case 'rtsp_probe':
        return 'RTSP local'
      case 'network_scan':
        return 'Scan RTSP'
      case 'http_probe':
        return 'HTTP camera'
      case 'http_service':
        return 'HTTP generique'
      default:
        return discoverySource
    }
  }

  function formatQualificationReason(reason: string) {
    switch (reason) {
      case 'onvif_detected':
        return 'Annonce ONVIF detectee'
      case 'http_service_detected':
        return 'Service web generique detecte'
      case 'vendor_oui_match':
        return 'Constructeur probable via MAC/OUI'
      case 'hostname_camera_hint':
        return 'Nom reseau evocateur d une camera'
      case 'rtsp_responding':
        return 'Port RTSP joignable'
      case 'http_camera_signature':
        return 'Interface web camera reconnue'
      case 'rtsp_path_known':
        return 'Chemin RTSP deja connu'
      case 'vendor_hint_detected':
        return 'Constructeur probable detecte'
      case 'mac_address_observed':
        return 'Adresse MAC observee'
      default:
        return reason
    }
  }

  const shouldShowVendorAssistance = vendorAssistanceState.loading
    || Boolean(vendorAssistanceState.error)
    || Boolean(vendorAssistanceState.data?.markdown)

  function renderTechnicalDetails(candidate: DiscoveryCandidate | null, fallbackHost: string | null = null) {
    const technicalDetails = candidate?.technicalDetails
    const host = candidate?.host ?? fallbackHost

    return (
      <details className="camera-debug-details">
        <summary>Details techniques</summary>
        <div className="camera-debug-content">
          <dl className="camera-summary-list debug">
            <div>
              <dt>IP</dt>
              <dd>{formatMutedValue(host)}</dd>
            </div>
            <div>
              <dt>Hostname</dt>
              <dd>{formatMutedValue(technicalDetails?.resolvedHostName)}</dd>
            </div>
            <div>
              <dt>MAC</dt>
              <dd>{formatMutedValue(candidate?.macAddress)}</dd>
            </div>
            <div>
              <dt>Constructeur</dt>
              <dd>{formatOptionalVendor(candidate?.vendorFamily ?? null)}</dd>
            </div>
            <div>
              <dt>Ports HTTP detectes</dt>
              <dd>{formatMutedList(technicalDetails?.httpPortsDetected)}</dd>
            </div>
            <div>
              <dt>Ports ONVIF detectes</dt>
              <dd>{formatMutedList(technicalDetails?.onvifPortsDetected)}</dd>
            </div>
            <div>
              <dt>Ports RTSP detectes</dt>
              <dd>{formatMutedList(technicalDetails?.rtspPortsDetected)}</dd>
            </div>
            <div>
              <dt>Flux RTSP detectes</dt>
              <dd>{formatMutedList(technicalDetails?.rtspPathsDetected)}</dd>
            </div>
          </dl>
        </div>
      </details>
    )
  }

  function renderConfidenceDetails(candidate: DiscoveryCandidate | null) {
    if (!candidate) {
      return null
    }

    return (
      <details className="camera-debug-details camera-confidence-details">
        <summary>Pourquoi cette camera est proposee</summary>
        <div className="camera-debug-content">
          <dl className="camera-summary-list debug">
            <div>
              <dt>Detection retenue</dt>
              <dd>{formatMutedValue(formatDiscoverySource(candidate.discoverySource))}</dd>
            </div>
            <div>
              <dt>Niveau de confiance</dt>
              <dd>{formatMutedValue(candidate.qualification)}</dd>
            </div>
          </dl>
          <div className="camera-confidence-signals">
            {candidate.qualificationReasons.length > 0 ? (
              candidate.qualificationReasons.map((reason) => (
                <span key={reason} className="camera-confidence-chip">
                  {formatQualificationReason(reason)}
                </span>
              ))
            ) : (
              <span className="camera-confidence-empty">Aucun indice detaille</span>
            )}
          </div>
        </div>
      </details>
    )
  }

  return (
    <main className="app-shell app-shell-cameras">
      <section className="panel camera-toolbar">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Parcours camera</p>
          <h1>Decouverte guidee</h1>
          <p className="camera-toolbar-lede">
            Selectionnez un candidat ou une camera existante, puis agissez dans un seul panneau de detail.
          </p>
        </div>

        <div className="camera-toolbar-status" aria-label="Etat du catalogue camera">
          <div className={`status-pill ${camerasState.error ? 'degraded' : camerasState.loading ? 'loading' : 'online'}`}>
            {camerasState.loading ? 'Chargement' : camerasState.error ? 'Catalogue indisponible' : 'Catalogue pret'}
          </div>
          <p>{camerasState.error ?? `${camerasState.data.length} camera(s) dans le catalogue actuel.`}</p>
          <div className="panel-cta-row">
            <a className="secondary-cta" href="#hub">Retour au hub</a>
            <button className="primary-cta" type="button" onClick={handleDiscovery} disabled={discoveryLoading || actionLoading}>
              {discoveryLoading ? 'Recherche...' : 'Decouverte reseau'}
            </button>
            <button className="secondary-cta" type="button" onClick={selectManualEntry} disabled={actionLoading}>
              Saisie manuelle
            </button>
          </div>
          {discoveryError ? <p className="status-inline error">{discoveryError}</p> : null}
        </div>
      </section>

      <section className="camera-master-detail">
        <aside className="panel camera-sidebar">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <div>
                <p className="section-kicker">Detection</p>
                <h2>Candidats</h2>
              </div>
              <span className="camera-sidebar-count">{discoveryResults.length}</span>
            </div>

            <button
              type="button"
              className={`camera-nav-item ${selection.kind === 'manual' ? 'selected' : ''}`}
              onClick={selectManualEntry}
            >
              <div>
                <strong>Saisie manuelle</strong>
                <p>Ajouter une camera sans detection automatique.</p>
              </div>
            </button>

            {discoveryResults.length > 0 ? (
              discoveryResults.map((candidate, index) => (
                <button
                  key={`${candidate.host}-${candidate.port}-${index}`}
                  type="button"
                  className={`camera-nav-item ${selection.kind === 'candidate' && selection.index === index ? 'selected' : ''}`}
                  onClick={() => selectDiscoveryCandidate(index)}
                >
                  <div>
                    <strong>{candidate.displayName}</strong>
                    <p>{formatCandidateAddress(candidate)}</p>
                    <div className="camera-badge-row compact">
                      <span className={`camera-support-badge ${supportBadgeTone(candidate)}`}>
                        {formatSupportLabel(candidate)}
                      </span>
                    </div>
                  </div>
                  <small>{formatVendorFamily(candidate.vendorFamily)}</small>
                </button>
              ))
            ) : (
              <div className="camera-nav-empty">
                <strong>Aucun candidat</strong>
                <p>Lancez une decouverte reseau pour remplir cette liste.</p>
              </div>
            )}
          </div>

          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <div>
                <p className="section-kicker">Catalogue</p>
                <h2>Mes cameras</h2>
              </div>
              <span className="camera-sidebar-count">{camerasState.data.length}</span>
            </div>

            {camerasState.data.length > 0 ? (
              camerasState.data.map((camera) => (
                <button
                  key={camera.id}
                  type="button"
                  className={`camera-nav-item ${formatStatusTone(camera)} ${selection.kind === 'camera' && selection.cameraId === camera.id ? 'selected' : ''}`}
                  onClick={() => selectCamera(camera.id)}
                >
                  <div>
                    <strong>{camera.displayName}</strong>
                    <p>{formatCameraAddress(camera)}</p>
                  </div>
                  <div className="camera-nav-meta">
                    <span>{formatCameraStatusLabel(camera.status)}</span>
                    <small>{formatValidationStateLabel(camera.validationState)}</small>
                  </div>
                </button>
              ))
            ) : (
              <article className="camera-nav-empty">
                <h3>Aucune camera visible</h3>
                <p>Commencez par la decouverte reseau ou la saisie manuelle.</p>
              </article>
            )}
          </div>
        </aside>

        <article className="panel camera-detail-panel">
          {(selection.kind === 'manual' || selectedCandidate) ? (
            <>
              <div className="panel-heading">
                <p className="section-kicker">Configuration</p>
                <h2>{selectedCandidate ? selectedCandidate.displayName : 'Nouvelle camera'}</h2>
              </div>

              {formMessage ? <p className="camera-inline-state success">{formMessage}</p> : null}
              {formError ? <p className="camera-inline-state error">{formError}</p> : null}

              <div className="camera-detail-sections">
                <section className="camera-detail-section">
                  <h3>Resume</h3>
                  {selectedCandidate ? (
                    <dl className="camera-summary-list">
                      <div>
                        <dt>Adresse</dt>
                        <dd>{formatCandidateAddress(selectedCandidate)}</dd>
                      </div>
                      <div>
                        <dt>Constructeur</dt>
                        <dd>{formatVendorFamily(selectedCandidate.vendorFamily)}</dd>
                      </div>
                      <div>
                        <dt>RTSP actif</dt>
                        <dd>
                          <span className={`camera-rtsp-badge ${selectedCandidate.streamPath ? 'ready' : 'missing'}`}>
                            {selectedCandidate.streamPath ? 'Oui' : 'Non'}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Support</dt>
                        <dd>
                          <span className={`camera-support-badge ${supportBadgeTone(selectedCandidate)}`}>
                            {formatSupportLabel(selectedCandidate)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="camera-section-copy">Renseignez les informations minimales de la camera. La detection automatique reste optionnelle.</p>
                  )}
                </section>

                {selectedCandidateNeedsRtspActivation ? (
                  <section className="camera-readiness-callout" aria-live="polite">
                    <strong>Camera non prete pour l'ajout</strong>
                    <p>
                      Le flux RTSP n'est pas encore actif. Activez-le d'abord sur la camera, puis revenez ici pour l'ajouter au catalogue.
                    </p>
                    {vendorAssistanceState.data?.markdown ? (
                      <p>Suivez la notice constructeur ci-dessous pour l'activer pas a pas.</p>
                    ) : (
                      <p>Quand le RTSP sera disponible, le formulaire d'ajout reapparaitra automatiquement.</p>
                    )}
                  </section>
                ) : null}

                {shouldShowVendorAssistance ? (
                  <section className="camera-detail-section vendor">
                    <h3>Assistance constructeur</h3>
                    {vendorAssistanceState.loading ? (
                      <p className="camera-section-copy">Chargement de la notice constructeur...</p>
                    ) : vendorAssistanceState.error ? (
                      <p className="camera-inline-state error">{vendorAssistanceState.error}</p>
                    ) : vendorAssistanceState.data?.markdown ? (
                      <div className="camera-vendor-markdown">
                        <ReactMarkdown>{vendorAssistanceState.data.markdown}</ReactMarkdown>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {selectedCandidate ? renderConfidenceDetails(selectedCandidate) : null}
                {selectedCandidate ? renderTechnicalDetails(selectedCandidate) : null}
              </div>

              {canShowCandidateForm ? (
                <>
                  <div className="camera-form-grid compact">
                    <label>
                      <span>Nom</span>
                      <input value={form.displayName} onChange={(event) => updateForm({ displayName: event.target.value })} placeholder="Porte d'entree" />
                    </label>
                    <label>
                      <span>Host</span>
                      <input value={form.host} onChange={(event) => updateForm({ host: event.target.value })} placeholder="192.168.1.10" />
                    </label>
                    <label>
                      <span>Port</span>
                      <input type="number" value={form.port} onChange={(event) => updateForm({ port: Number(event.target.value) || 554 })} />
                    </label>
                    <label>
                      <span>Chemin RTSP</span>
                      <input value={form.streamPath ?? ''} onChange={(event) => updateForm({ streamPath: event.target.value || null })} placeholder="/Streaming/Channels/101" />
                    </label>
                    <label>
                      <span>Utilisateur</span>
                      <input value={form.username ?? ''} onChange={(event) => updateForm({ username: event.target.value || null })} />
                    </label>
                    <label>
                      <span>Mot de passe</span>
                      <input type="password" value={form.password ?? ''} onChange={(event) => updateForm({ password: event.target.value || null })} />
                    </label>
                  </div>

                  <div className="panel-cta-row">
                    <button className="primary-cta" type="button" onClick={handleCreate} disabled={actionLoading}>
                      {actionLoading ? 'Traitement...' : 'Ajouter au catalogue'}
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="panel-heading">
                <p className="section-kicker">Camera</p>
                <h2>{selectedCamera?.displayName ?? 'Camera selectionnee'}</h2>
              </div>

              {detailMessage ? <p className="camera-inline-state success">{detailMessage}</p> : null}
              {detailError ? <p className="camera-inline-state error">{detailError}</p> : null}
              {cameraStatusState.loading ? <p className="camera-inline-state">Chargement de l&apos;etat detaille...</p> : null}
              {cameraStatusState.error ? <p className="camera-inline-state error">{cameraStatusState.error}</p> : null}

              {cameraStatusState.data ? (
                <div className="camera-detail-stack">
                  <div className="camera-detail-summary">
                    <div>
                      <h3>{cameraStatusState.data.displayName}</h3>
                      <p>{cameraStatusState.data.guidance}</p>
                    </div>
                    <div className={`status-pill ${cameraStatusState.data.connected ? 'online' : 'warning'}`}>
                      {formatCameraStatusLabel(cameraStatusState.data.status)}
                    </div>
                  </div>

                  <div className="camera-detail-sections">
                    <section className="camera-detail-section">
                      <h3>Resume</h3>
                      <dl className="camera-summary-list">
                        <div>
                          <dt>Adresse</dt>
                          <dd>{selectedCamera ? formatCameraAddress(selectedCamera) : '—'}</dd>
                        </div>
                        <div>
                          <dt>Constructeur</dt>
                          <dd>{formatVendorFamily(matchedDiscoveryCandidate?.vendorFamily ?? null)}</dd>
                        </div>
                        <div>
                          <dt>RTSP actif</dt>
                          <dd>
                            <span className={`camera-rtsp-badge ${cameraStatusState.data.connected ? 'ready' : 'missing'}`}>
                              {cameraStatusState.data.connected ? 'Oui' : 'Non'}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Support</dt>
                          <dd>
                            <span className={`camera-support-badge ${supportBadgeTone(matchedDiscoveryCandidate)}`}>
                              {formatSupportLabel(matchedDiscoveryCandidate)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </section>

                    {shouldShowVendorAssistance ? (
                      <section className="camera-detail-section vendor">
                        <h3>Assistance constructeur</h3>
                        {vendorAssistanceState.loading ? (
                          <p className="camera-section-copy">Chargement de la notice constructeur...</p>
                        ) : vendorAssistanceState.error ? (
                          <p className="camera-inline-state error">{vendorAssistanceState.error}</p>
                        ) : vendorAssistanceState.data?.markdown ? (
                          <div className="camera-vendor-markdown">
                            <ReactMarkdown>{vendorAssistanceState.data.markdown}</ReactMarkdown>
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    <div className="camera-debug-stack">
                      {renderConfidenceDetails(matchedDiscoveryCandidate)}
                      {renderTechnicalDetails(matchedDiscoveryCandidate, selectedCamera?.host ?? null)}
                      <details className="camera-debug-details">
                        <summary>Etat technique</summary>
                        <div className="camera-debug-content">
                          <dl className="camera-summary-list debug">
                            <div>
                              <dt>Validation</dt>
                              <dd>{formatValidationStateLabel(cameraStatusState.data.validationState)}</dd>
                            </div>
                            <div>
                              <dt>Derniere verification</dt>
                              <dd>{formatCameraCheck(cameraStatusState.data.lastReachabilityCheckAt)}</dd>
                            </div>
                            <div>
                              <dt>Apercu</dt>
                              <dd>{formatCameraPreview(cameraStatusState.data)}</dd>
                            </div>
                          </dl>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="camera-step-actions detail compact">
                    <div className="camera-step-summary">
                      <strong>Etape 2</strong>
                      <p>Verifiez d'abord le flux, puis appliquez ou supprimez la camera selon le resultat.</p>
                    </div>
                    <div className="panel-cta-row">
                      <button className="secondary-cta" type="button" onClick={handleVerify} disabled={actionLoading}>
                        Verifier le flux
                      </button>
                      <button className="primary-cta" type="button" onClick={handleApply} disabled={actionLoading}>
                        Appliquer a Frigate
                      </button>
                      <button className="danger-cta" type="button" onClick={handleDelete} disabled={actionLoading}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="camera-empty-state">
                  <h3>Selectionnez une camera</h3>
                  <p>Le detail, la verification et l&apos;application apparaitront ici.</p>
                </div>
              )}
            </>
          )}
        </article>
      </section>
    </main>
  )
}