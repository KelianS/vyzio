import { useEffect, useState } from 'react'
import type { ApplyCamera } from '../../application/use-cases/ApplyCamera'
import type { CreateCamera } from '../../application/use-cases/CreateCamera'
import type { DiscoverCameras } from '../../application/use-cases/DiscoverCameras'
import type { GetCameraStatus } from '../../application/use-cases/GetCameraStatus'
import type { GetCameras } from '../../application/use-cases/GetCameras'
import type { VerifyCamera } from '../../application/use-cases/VerifyCamera'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import { useCameraStatus } from '../hooks/useCameraStatus'
import { useCameras } from '../hooks/useCameras'
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
  createCamera: CreateCamera
  verifyCamera: VerifyCamera
  applyCamera: ApplyCamera
}

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
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const cameraStatusState = useCameraStatus(props.getCameraStatus, selectedCameraId)
  const [form, setForm] = useState<CameraDraftInput>(emptyForm)
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [discoveryResults, setDiscoveryResults] = useState<Array<{ displayName: string; host: string; port: number; sourceType: string; streamPath: string | null; discoverySource: string; note: string | null }>>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCameraId && camerasState.data.length > 0) {
      setSelectedCameraId(camerasState.data[0].id)
    }
  }, [camerasState.data, selectedCameraId])

  async function handleDiscovery() {
    setDiscoveryLoading(true)
    setDiscoveryError(null)

    try {
      const candidates = await props.discoverCameras.execute()
      setDiscoveryResults(candidates)
      setActionMessage(candidates.length > 0 ? `${candidates.length} camera(s) candidate(s) detectee(s).` : 'Aucune camera detectee automatiquement.')
    } catch (error: unknown) {
      setDiscoveryError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  async function handleCreate() {
    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)

    try {
      const created = await props.createCamera.execute(form)
      camerasState.reload()
      setSelectedCameraId(created.id)
      setActionMessage(`Camera "${created.displayName}" ajoutee au catalogue.`)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleVerify() {
    if (!selectedCameraId) {
      return
    }

    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)

    try {
      const status = await props.verifyCamera.execute(selectedCameraId)
      camerasState.reload()
      cameraStatusState.reload()
      setActionMessage(status.guidance ?? 'Verification terminee.')
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleApply() {
    if (!selectedCameraId) {
      return
    }

    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)

    try {
      const result = await props.applyCamera.execute(selectedCameraId)
      camerasState.reload()
      cameraStatusState.reload()

      if (!result.applied) {
        setActionError(result.message)
        return
      }

      setActionMessage(`${result.message} (${result.configPath})`)
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setActionLoading(false)
    }
  }

  function updateForm(patch: Partial<CameraDraftInput>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function applyDiscoveryCandidate(index: number) {
    const candidate = discoveryResults[index]
    if (!candidate) {
      return
    }

    updateForm({
      displayName: candidate.displayName,
      host: candidate.host,
      port: candidate.port,
      sourceType: candidate.sourceType,
      streamPath: candidate.streamPath,
    })
    setActionMessage(`Le candidat ${candidate.displayName} a ete recopie dans le formulaire.`)
  }

  return (
    <main className="app-shell app-shell-cameras">
      <section className="hero-panel cameras-hero">
        <div className="hero-copy">
          <p className="eyebrow">Parcours camera</p>
          <h1>Ajouter, verifier, appliquer.</h1>
          <p className="lede">
            Le hub guide la decouverte reseau, la saisie manuelle et l&apos;application de la configuration Frigate.
          </p>
        </div>

        <div className="hero-status" aria-label="Etat du catalogue camera">
          <div className={`status-pill ${camerasState.error ? 'degraded' : camerasState.loading ? 'loading' : 'online'}`}>
            {camerasState.loading ? 'Chargement' : camerasState.error ? 'Catalogue indisponible' : 'Catalogue pret'}
          </div>
          <div className="status-summary">
            <strong>
              {camerasState.loading
                ? 'Le hub charge les cameras.'
                : camerasState.error
                  ? 'Le hub ne peut pas lire le catalogue camera.'
                  : 'Le parcours camera est disponible.'}
            </strong>
            <p>{camerasState.error ?? `${camerasState.data.length} camera(s) dans le catalogue actuel.`}</p>
          </div>
          <div className="panel-cta-row">
            <a className="secondary-cta" href="#hub">Retour au hub</a>
            <button className="primary-cta" type="button" onClick={handleDiscovery} disabled={discoveryLoading || actionLoading}>
              {discoveryLoading ? 'Recherche...' : 'Decouverte reseau'}
            </button>
          </div>
          {discoveryError ? <p className="status-inline error">{discoveryError}</p> : null}
          {actionMessage ? <p className="status-inline">{actionMessage}</p> : null}
          {actionError ? <p className="status-inline error">{actionError}</p> : null}
        </div>
      </section>

      <section className="hub-grid cameras-grid cameras-grid-extended">
        <article className="panel panel-primary cameras-panel-list">
          <div className="panel-heading">
            <p className="section-kicker">Catalogue</p>
            <h2>Cameras connues</h2>
          </div>

          <div className="camera-list">
            {camerasState.data.length > 0 ? (
              camerasState.data.map((camera) => (
                <button
                  key={camera.id}
                  type="button"
                  className={`camera-card ${formatStatusTone(camera)} ${selectedCameraId === camera.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCameraId(camera.id)}
                >
                  <div>
                    <h3>{camera.displayName}</h3>
                    <p>{formatCameraAddress(camera)}</p>
                  </div>
                  <div className="camera-card-meta">
                    <span>{formatCameraStatusLabel(camera.status)}</span>
                    <small>{formatValidationStateLabel(camera.validationState)}</small>
                  </div>
                </button>
              ))
            ) : (
              <article className="camera-empty-state">
                <h3>Aucune camera visible</h3>
                <p>Commencez par la decouverte reseau ou la saisie manuelle.</p>
              </article>
            )}
          </div>
        </article>

        <article className="panel panel-secondary cameras-panel-form">
          <div className="panel-heading">
            <p className="section-kicker">Ajout</p>
            <h2>Decouverte et saisie manuelle</h2>
          </div>

          <div className="camera-discovery-results">
            {discoveryResults.length > 0 ? (
              discoveryResults.map((candidate, index) => (
                <button key={`${candidate.host}-${candidate.port}-${index}`} type="button" className="discovery-card" onClick={() => applyDiscoveryCandidate(index)}>
                  <div>
                    <h3>{candidate.displayName}</h3>
                    <p>{candidate.host}:{candidate.port}</p>
                  </div>
                  <small>{candidate.note ?? candidate.discoverySource}</small>
                </button>
              ))
            ) : (
              <div className="camera-empty-state compact">
                <h3>Decouverte assistee</h3>
                <p>Les candidats reseau apparaitront ici. La saisie manuelle reste disponible en secours.</p>
              </div>
            )}
          </div>

          <div className="camera-form-grid">
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
        </article>

        <article className="panel panel-secondary cameras-panel-detail">
          <div className="panel-heading">
            <p className="section-kicker">Verification</p>
            <h2>Etat detaille et application</h2>
          </div>

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

              <dl className="camera-facts">
                <div>
                  <dt>Validation</dt>
                  <dd>{formatValidationStateLabel(cameraStatusState.data.validationState)}</dd>
                </div>
                <div>
                  <dt>Flux</dt>
                  <dd>{cameraStatusState.data.connected ? 'Joignable' : 'A verifier'}</dd>
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

              <div className="panel-cta-row">
                <button className="secondary-cta" type="button" onClick={handleVerify} disabled={actionLoading}>
                  Verifier le flux
                </button>
                <button className="primary-cta" type="button" onClick={handleApply} disabled={actionLoading}>
                  Appliquer a Frigate
                </button>
              </div>

              <div className="camera-next-actions">
                <h3>Application</h3>
                <p>
                  La camera est ecrite dans la configuration Frigate geree par Vyzio, puis Frigate est relance pour appliquer le changement.
                </p>
              </div>
            </div>
          ) : (
            <div className="camera-empty-state">
              <h3>Selectionnez une camera</h3>
              <p>Le detail, la verification et l&apos;application apparaitront ici.</p>
            </div>
          )}
        </article>
      </section>
    </main>
  )
}