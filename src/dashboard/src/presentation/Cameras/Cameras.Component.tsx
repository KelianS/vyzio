import { useEffect, useReducer, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { appErrorMessage } from '../../common/errors/AppError'
import { Btn } from '../../common/components/Btn'
import { Select } from '../../common/components/Select'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { LiveFeedModal } from '../../common/components/LiveFeedModal'
import { useToast } from '../../common/components/Toast'
import { usePresenter } from '../../common/presenter/usePresenter'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { useCameraStatus } from './useCameraStatus'
import { useVendorAssistance } from './useVendorAssistance'
import { resolveVendorLinkTarget } from './vendorLinks'
import { buildCamerasPresenter } from './Cameras.Presenter'
import { camerasReducer } from './Cameras.Reducer'
import { buildInitialCamerasUido } from './Cameras.Uido'

type DiscoveryCandidate = DiscoveredCamera

export function CamerasView() {
  const { apiBaseUrl, cameras: container } = useAppContainer()
  const { toast } = useToast()
  const [uido, dispatch] = useReducer(camerasReducer, undefined, buildInitialCamerasUido)
  const presenter = usePresenter(buildCamerasPresenter, { container, dispatch, toast })

  const cameras = useRootStore((s) => s.cameras)
  const camerasLoading = useRootStore((s) => s.camerasLoading)
  const camerasError = useRootStore((s) => s.camerasError)
  const frigateStatus = useRootStore((s) => s.systemStats?.status ?? 'active')

  const { selection } = uido
  const selectedCameraId = selection.kind === 'camera' ? selection.cameraId : null
  const cameraStatusState = useCameraStatus(container.getCameraStatus, selectedCameraId)

  const [modalMedia, setModalMedia] = useState<{
    cameraId: string
    label: string
    ptzSupported: boolean
  } | null>(null)

  useEffect(() => {
    presenter.onMount()
  }, [presenter])

  const actionLoading =
    uido.applyLoading ||
    uido.createLoading ||
    uido.verifyDraftLoading ||
    uido.verifyLoading ||
    uido.refreshLoading ||
    uido.deleteLoading ||
    uido.updateLoading

  const selectedCandidate =
    selection.kind === 'candidate' ? (uido.discoveryResults[selection.index] ?? null) : null

  const selectedCamera = selectedCameraId
    ? (cameras.find((camera) => camera.id === selectedCameraId) ?? null)
    : null

  const matchedDiscoveryCandidate = selectedCamera
    ? (uido.discoveryResults.find(
        (candidate) =>
          candidate.host === selectedCamera.host && candidate.port === selectedCamera.port,
      ) ?? null)
    : null

  const unclaimedDiscoveryResults = uido.discoveryResults.filter(
    (candidate) => !cameras.some((c) => c.host === candidate.host),
  )

  // uido.form.vendorFamily is the candidate's auto-detected value until the user overrides it in
  // Interpretation (renderInterpretationSection) — reading it here (rather than
  // selectedCandidate.vendorFamily directly) makes the vendor assistance notice below follow a
  // manual correction immediately, not only after the camera is actually created.
  const activeVendorFamily =
    (selection.kind === 'candidate' ? uido.form.vendorFamily : null) ??
    selectedCamera?.vendorFamily ??
    matchedDiscoveryCandidate?.vendorFamily ??
    null

  const activeStreamPath =
    selectedCandidate?.streamPath ?? matchedDiscoveryCandidate?.streamPath ?? null

  const vendorAssistanceState = useVendorAssistance(
    container.getVendorAssistance,
    activeVendorFamily,
    activeStreamPath,
    cameraStatusState.data?.connected ?? false,
  )

  const hasDvripSignal = Boolean(
    selectedCandidate?.qualificationReasons.includes('dvrip_port_detected'),
  )
  const dvripFallbackAvailable = hasDvripSignal && !selectedCandidate?.streamPath

  const selectedCandidateNeedsRtspActivation = Boolean(
    selectedCandidate && !selectedCandidate.streamPath && !uido.dvripMode,
  )
  const canShowCandidateForm =
    selection.kind === 'manual' ||
    Boolean(selectedCandidate && selectedCandidate.streamPath) ||
    uido.dvripMode
  const canVerifyDraft =
    canShowCandidateForm &&
    !selectedCandidateNeedsRtspActivation &&
    Boolean(
      uido.form.displayName.trim() &&
      uido.form.host.trim() &&
      (uido.dvripMode || uido.form.streamPath?.trim()),
    )
  const canAddConfiguredCamera = Boolean(uido.draftVerification?.connected) || uido.dvripMode

  useEffect(() => {
    if (
      selection.kind === 'camera' &&
      !cameras.some((camera) => camera.id === selection.cameraId)
    ) {
      if (cameras.length > 0) {
        presenter.onSelectCamera(cameras[0].id)
      } else {
        presenter.onSelectManualEntry()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras, selection])

  useEffect(() => {
    if (selection.kind === 'candidate' && !uido.discoveryResults[selection.index]) {
      presenter.onSelectManualEntry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uido.discoveryResults, selection])

  useEffect(() => {
    if (!selectedCamera) return
    void presenter.onCameraSelectedForDetail(selectedCamera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera?.id])

  async function handleDiscovery() {
    await presenter.onDiscover()
  }

  async function handleCreate() {
    await presenter.onCreate(uido.dvripMode, Boolean(uido.draftVerification?.connected), uido.form)
  }

  async function handleVerifyDraft() {
    await presenter.onVerifyDraft(uido.form)
  }

  async function handleRefreshCandidate() {
    if (!selectedCandidate || selection.kind !== 'candidate') return
    await presenter.onRefreshCandidate(selection.index, selectedCandidate)
  }

  async function handleApplyConfiguration() {
    await presenter.onApplyConfiguration(selection.kind)
    if (selectedCameraId) {
      cameraStatusState.reload()
    }
  }

  async function handleDelete() {
    if (!selectedCameraId) return
    await presenter.onDelete(selectedCameraId)
    cameraStatusState.reload()
  }

  function hasVendorDocumentation(candidate: DiscoveryCandidate | null) {
    return Boolean(candidate?.vendorDocumentation?.markdown?.trim())
  }

  function isSupportedVendor(
    vendorFamily: string | null,
    candidate: DiscoveryCandidate | null = null,
  ) {
    return Boolean(vendorFamily || hasVendorDocumentation(candidate))
  }

  function formatSupportLabel(
    vendorFamily: string | null,
    candidate: DiscoveryCandidate | null = null,
  ) {
    return isSupportedVendor(vendorFamily, candidate) ? 'Supporte' : 'Inconnu'
  }

  function supportBadgeTone(
    vendorFamily: string | null,
    candidate: DiscoveryCandidate | null = null,
  ) {
    return isSupportedVendor(vendorFamily, candidate) ? 'supported' : 'unknown'
  }

  function formatVendorFamily(vendorFamily: string | null) {
    switch (vendorFamily) {
      case 'v380_pro':
        return 'V380 PRO'
      case 'tplink_tapo':
        return 'TP-Link Tapo'
      case 'icsee':
        return 'ICSee / XMEye'
      default:
        return vendorFamily ?? 'Constructeur inconnu'
    }
  }

  function formatKnownVendorFamily(vendorFamily: string | null) {
    return vendorFamily ? formatVendorFamily(vendorFamily) : null
  }

  function formatCandidatePreviewTitle(candidate: DiscoveryCandidate) {
    return candidate.technicalDetails?.resolvedHostName?.trim() || candidate.displayName
  }

  function formatCandidateAddress(candidate: DiscoveryCandidate) {
    return candidate.host
  }

  function isReadyCandidate(candidate: DiscoveryCandidate) {
    return Boolean(candidate.streamPath)
  }

  const shouldShowVendorAssistance =
    vendorAssistanceState.loading ||
    Boolean(vendorAssistanceState.error) ||
    Boolean(vendorAssistanceState.data?.markdown)

  // The 3 sections below mirror the backend discovery pipeline's own stages (ADR-32) instead of
  // an ad-hoc "Resume / Assistance / Informations / Pourquoi" layout grown incrementally: what we
  // found (identification), what we gathered about it (enrichissement), what it means
  // (interpretation). Keeping this 1:1 with AssistedCameraDiscoveryProbePipeline /
  // AssistedCameraDiscoveryIdentifier makes the UI explain itself the same way the backend does.

  function renderIdentificationSection(candidate: DiscoveryCandidate) {
    return (
      <section className="camera-detail-section">
        <h3>1. Identification</h3>
        <dl className="camera-summary-list">
          <div>
            <dt>Adresse</dt>
            <dd>{formatCandidateAddress(candidate)}</dd>
          </div>
        </dl>
      </section>
    )
  }

  // Pure display: every label/protocol name comes from candidate.technicalDetails.detectedPorts,
  // which the backend already fully resolved (DiscoveryProtocolCatalog, ADR-32). This component
  // never hardcodes a protocol name — adding a new probe to the backend catalog is the only change
  // needed for it to show up here automatically, in the port table and in the stream verdict below.
  function renderEnrichmentSection(candidate: DiscoveryCandidate) {
    const technicalDetails = candidate.technicalDetails
    const detectedPorts = technicalDetails?.detectedPorts ?? []
    const hasFacts = Boolean(
      technicalDetails?.resolvedHostName ||
      candidate.macAddress ||
      detectedPorts.length ||
      technicalDetails?.rtspPathsDetected?.length,
    )

    if (!hasFacts) {
      return null
    }

    return (
      <details className="camera-debug-details">
        <summary>2. Enrichissement</summary>
        <div className="camera-debug-content">
          <dl className="camera-summary-list debug">
            {technicalDetails?.resolvedHostName ? (
              <div>
                <dt>Hostname</dt>
                <dd>{technicalDetails.resolvedHostName}</dd>
              </div>
            ) : null}
            {candidate.macAddress ? (
              <div>
                <dt>MAC</dt>
                <dd>{candidate.macAddress}</dd>
              </div>
            ) : null}
            {technicalDetails?.rtspPathsDetected?.length ? (
              <div>
                <dt>Chemins de flux detectes</dt>
                <dd>{technicalDetails.rtspPathsDetected.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          {detectedPorts.length > 0 ? (
            <table className="camera-detected-ports">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Protocole</th>
                </tr>
              </thead>
              <tbody>
                {detectedPorts.map((entry) => (
                  <tr key={`${entry.protocol}-${entry.port}`}>
                    <td>{entry.port}</td>
                    <td>{entry.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </details>
    )
  }

  // Kept deliberately minimal: a correctable conclusion (constructeur, always editable) plus the
  // capability→protocol map. Pure display: the mapping is decided entirely backend-side (ADR-32).
  function renderInterpretationSection(candidate: DiscoveryCandidate) {
    const capabilities = candidate.technicalDetails?.capabilities ?? []

    return (
      <section className="camera-detail-section">
        <h3>3. Interpretation</h3>
        <dl className="camera-summary-list">
          <div>
            <dt>Constructeur</dt>
            <dd>
              <Select
                size="sm"
                value={uido.form.vendorFamily ?? ''}
                onChange={(event) =>
                  presenter.onFormChanged({ vendorFamily: event.target.value || null })
                }
              >
                <option value="">Non reconnu (choisir si connu)</option>
                <option value="v380_pro">V380 PRO</option>
                <option value="tplink_tapo">TP-Link Tapo</option>
                <option value="icsee">ICSee / XMEye</option>
              </Select>
            </dd>
          </div>
          {capabilities.length > 0 ? (
            capabilities.map((cap) => (
              <div key={cap.capability}>
                <dt>{cap.label}</dt>
                <dd>{cap.protocolLabels.join(', ')}</dd>
              </div>
            ))
          ) : (
            <div>
              <dt>Capacites detectees</dt>
              <dd>Aucune capacite confirmee</dd>
            </div>
          )}
        </dl>
      </section>
    )
  }

  function renderVendorAssistanceSection() {
    if (!shouldShowVendorAssistance) {
      return null
    }

    return (
      <section className="camera-detail-section vendor">
        <h3>Assistance constructeur</h3>
        {vendorAssistanceState.loading ? (
          <p className="camera-section-copy">Chargement de la notice constructeur...</p>
        ) : vendorAssistanceState.error ? (
          <p className="camera-inline-state error">
            {appErrorMessage(vendorAssistanceState.error)}
          </p>
        ) : vendorAssistanceState.data?.markdown ? (
          <div className="camera-vendor-markdown">
            <ReactMarkdown
              components={{
                a({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
                  const linkTarget = resolveVendorLinkTarget(href)

                  return (
                    <a
                      {...props}
                      href={linkTarget?.href ?? href}
                      target="_blank"
                      rel="noreferrer noopener"
                      download={linkTarget?.download || undefined}
                    >
                      {children}
                    </a>
                  )
                },
              }}
            >
              {vendorAssistanceState.data.markdown}
            </ReactMarkdown>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <main className="app-shell app-shell-cameras">
      <section className="panel camera-toolbar">
        <div className="camera-toolbar-copy">
          <p className="eyebrow">Parcours camera</p>
          <h1>Decouverte guidee</h1>
          <p className="camera-toolbar-lede">
            Selectionnez un candidat ou une camera existante, puis agissez dans un seul panneau de
            detail.
          </p>
        </div>
        <div className="camera-toolbar-status" aria-label="Etat du catalogue camera">
          <div
            className={`status-pill ${camerasError ? 'degraded' : camerasLoading ? 'loading' : 'online'}`}
          >
            {camerasLoading
              ? 'Chargement'
              : camerasError
                ? 'Catalogue indisponible'
                : 'Catalogue pret'}
          </div>
          <p>
            {camerasError
              ? appErrorMessage(camerasError)
              : `${cameras.length} camera(s) dans le catalogue actuel.`}
          </p>
          {uido.discoveryError ? (
            <p className="status-inline error">{uido.discoveryError}</p>
          ) : null}
        </div>
      </section>

      <section className="camera-master-detail">
        <aside className="panel camera-sidebar">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Candidats</h2>
              <span className="camera-sidebar-count">{unclaimedDiscoveryResults.length}</span>
            </div>
            <button
              className="primary-cta camera-sidebar-btn"
              type="button"
              onClick={() => presenter.onConfirmScanSet(true)}
              disabled={uido.discoverLoading || actionLoading}
            >
              {uido.discoverLoading ? 'Recherche...' : 'Scanner'}
            </button>

            {uido.discoveryError ? (
              <p className="camera-inline-state error">{uido.discoveryError}</p>
            ) : null}

            <button
              type="button"
              className={`camera-nav-item ${selection.kind === 'manual' ? 'selected' : ''}`}
              onClick={() => presenter.onSelectManualEntry()}
            >
              <div>
                <strong>Saisie manuelle</strong>
                <p>Ajouter une camera sans detection automatique.</p>
              </div>
            </button>

            {unclaimedDiscoveryResults.length > 0 ? (
              unclaimedDiscoveryResults.map((candidate) => {
                const originalIndex = uido.discoveryResults.indexOf(candidate)
                return (
                  <button
                    key={`${candidate.host}-${candidate.port}`}
                    type="button"
                    className={`camera-nav-item candidate-preview-card ${selection.kind === 'candidate' && selection.index === originalIndex ? 'selected' : ''}`}
                    onClick={() => presenter.onSelectDiscoveryCandidate(originalIndex, candidate)}
                  >
                    <div className="candidate-preview-main">
                      <strong>{formatCandidatePreviewTitle(candidate)}</strong>
                      <p>{formatCandidateAddress(candidate)}</p>
                      <div className="candidate-preview-footer">
                        <div className="camera-badge-row compact">
                          <span
                            className={`camera-support-badge ${supportBadgeTone(candidate.vendorFamily, candidate)}`}
                          >
                            {formatSupportLabel(candidate.vendorFamily, candidate)}
                          </span>
                          {isReadyCandidate(candidate) ? (
                            <span className="camera-rtsp-badge ready">Prete</span>
                          ) : null}
                        </div>

                        {formatKnownVendorFamily(candidate.vendorFamily) ? (
                          <div className="camera-nav-meta compact candidate-preview-meta">
                            <small>{formatKnownVendorFamily(candidate.vendorFamily)}</small>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="camera-nav-empty">
                <strong>Aucun candidat</strong>
                <p>Lancez une decouverte reseau pour remplir cette liste.</p>
              </div>
            )}
          </div>
        </aside>

        <article className="panel camera-detail-panel">
          {selection.kind === 'manual' || selectedCandidate ? (
            <>
              <div className="panel-heading">
                <p className="section-kicker">Configuration</p>
                <h2>{selectedCandidate ? selectedCandidate.displayName : 'Nouvelle camera'}</h2>
              </div>

              <div className="camera-detail-sections">
                {selectedCandidate ? (
                  renderIdentificationSection(selectedCandidate)
                ) : (
                  <section className="camera-detail-section">
                    <h3>1. Identification</h3>
                    <p className="camera-section-copy">
                      Renseignez les informations minimales de la camera. La detection automatique
                      reste optionnelle.
                    </p>
                  </section>
                )}

                {selectedCandidateNeedsRtspActivation ? (
                  <section className="camera-readiness-callout" aria-live="polite">
                    <strong>Camera non prete pour l'ajout</strong>
                    <p>
                      La connexion a la camera n'est pas encore active. Configurez-la d'abord via
                      son application, puis revenez ici pour l'ajouter au catalogue.
                    </p>
                    {vendorAssistanceState.data?.markdown ? (
                      <p>Suivez la notice constructeur ci-dessous pour l'activer pas a pas.</p>
                    ) : (
                      <p>
                        Quand la camera sera accessible, le formulaire d'ajout reapparaitra
                        automatiquement.
                      </p>
                    )}
                  </section>
                ) : null}

                {dvripFallbackAvailable ? (
                  <section className="camera-readiness-callout dvrip-fallback" aria-live="polite">
                    <strong>Mode de connexion alternatif disponible</strong>
                    <p>
                      Ce mode de connexion alternatif (ICSee, Annke, Sannce, Zosi et marques
                      similaires) peut être utilisé si la connexion standard n'est pas accessible.
                    </p>
                    <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                      Si c'est une camera sur batterie, elle doit être éveillée via son application
                      avant la vérification. Elle restera active tant que la connexion est ouverte.
                    </p>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        marginTop: 8,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={uido.dvripMode}
                        onChange={(e) =>
                          presenter.onDvripModeToggle(e.target.checked, selectedCandidate)
                        }
                        style={{ accentColor: 'currentColor' }}
                      />
                      Utiliser ce mode alternatif (ne pas activer si la connexion standard
                      fonctionne)
                    </label>
                  </section>
                ) : null}

                {selectedCandidate ? renderEnrichmentSection(selectedCandidate) : null}
                {selectedCandidate ? renderInterpretationSection(selectedCandidate) : null}
                {renderVendorAssistanceSection()}
              </div>

              {selectedCandidate ? (
                <div className="panel-cta-row">
                  <Btn
                    variant="secondary"
                    size="sm"
                    loading={actionLoading}
                    onClick={handleRefreshCandidate}
                  >
                    Rafraichir ce candidat
                  </Btn>
                </div>
              ) : null}

              {uido.formMessage ? (
                <p className="camera-inline-state success action-feedback">{uido.formMessage}</p>
              ) : null}
              {uido.formError ? (
                <p className="camera-inline-state error action-feedback">{uido.formError}</p>
              ) : null}

              {canShowCandidateForm ? (
                <>
                  <div className="camera-form-grid compact">
                    <label>
                      <span>Nom</span>
                      <input
                        value={uido.form.displayName}
                        onChange={(event) =>
                          presenter.onFormChanged({ displayName: event.target.value })
                        }
                        placeholder="Porte d'entree"
                      />
                    </label>
                    <label>
                      <span>Host</span>
                      <input
                        value={uido.form.host}
                        onChange={(event) => presenter.onFormChanged({ host: event.target.value })}
                        placeholder="192.168.1.10"
                      />
                    </label>
                    <label>
                      <span>Port</span>
                      <input
                        type="number"
                        value={uido.form.port}
                        onChange={(event) =>
                          presenter.onFormChanged({ port: Number(event.target.value) || 554 })
                        }
                      />
                    </label>
                    {!uido.dvripMode ? (
                      <label>
                        <span>Chemin de flux</span>
                        <input
                          value={uido.form.streamPath ?? ''}
                          onChange={(event) =>
                            presenter.onFormChanged({ streamPath: event.target.value || null })
                          }
                          placeholder="/Streaming/Channels/101"
                        />
                      </label>
                    ) : (
                      <label>
                        <span>Protocole</span>
                        <input
                          value="Mode alternatif (ICSee / XMEye)"
                          readOnly
                          style={{ opacity: 0.6 }}
                        />
                      </label>
                    )}
                    <label>
                      <span>Utilisateur</span>
                      <input
                        value={uido.form.username ?? ''}
                        onChange={(event) =>
                          presenter.onFormChanged({ username: event.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      <span>Mot de passe</span>
                      <input
                        type="password"
                        value={uido.form.password ?? ''}
                        onChange={(event) =>
                          presenter.onFormChanged({ password: event.target.value || null })
                        }
                      />
                    </label>
                    {selection.kind === 'manual' ? (
                      <label>
                        <span>Marque (si non reconnue automatiquement)</span>
                        <Select
                          value={uido.form.vendorFamily ?? ''}
                          onChange={(event) =>
                            presenter.onFormChanged({ vendorFamily: event.target.value || null })
                          }
                        >
                          <option value="">Detection automatique</option>
                          <option value="v380_pro">V380 PRO</option>
                          <option value="tplink_tapo">TP-Link Tapo</option>
                          <option value="icsee">ICSee / XMEye</option>
                        </Select>
                      </label>
                    ) : null}
                  </div>

                  <div className="panel-cta-row">
                    <Btn
                      variant="secondary"
                      size="md"
                      loading={actionLoading}
                      disabled={actionLoading || !canVerifyDraft}
                      onClick={handleVerifyDraft}
                    >
                      Verifier la connexion
                    </Btn>
                    <Btn
                      variant="primary"
                      size="md"
                      loading={actionLoading}
                      disabled={actionLoading || !canAddConfiguredCamera}
                      onClick={handleCreate}
                    >
                      Ajouter
                    </Btn>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </article>
      </section>

      {uido.confirmScan && (
        <ConfirmModal
          title="Scanner le réseau"
          body="Vyzio va sonder l'ensemble de votre réseau local à la recherche de caméras IP. Cette opération peut prendre entre 15 et 30 secondes et génère du trafic réseau."
          confirmLabel="Lancer le scan"
          tone="confirm"
          onConfirm={async () => {
            presenter.onConfirmScanSet(false)
            await handleDiscovery()
          }}
          onCancel={() => presenter.onConfirmScanSet(false)}
        />
      )}

      {uido.confirmApply && (
        <ConfirmModal
          title="Appliquer la configuration"
          body="Vyzio va regénérer la configuration et redémarrer Frigate. La surveillance sera interrompue brièvement (quelques secondes à quelques dizaines de secondes selon votre machine)."
          confirmLabel="Appliquer"
          tone="warn"
          onConfirm={async () => {
            presenter.onConfirmApplySet(false)
            await handleApplyConfiguration()
          }}
          onCancel={() => presenter.onConfirmApplySet(false)}
        />
      )}

      {uido.confirmDelete && selectedCameraId && (
        <ConfirmModal
          title="Supprimer la caméra"
          body={`Supprimer "${selectedCamera?.displayName ?? 'cette caméra'}" du catalogue ? La configuration Frigate sera mise à jour et l'enregistrement sur cette caméra sera arrêté.`}
          confirmLabel="Supprimer la caméra"
          tone="danger"
          onConfirm={async () => {
            await handleDelete()
            presenter.onConfirmDeleteSet(false)
          }}
          onCancel={() => presenter.onConfirmDeleteSet(false)}
        />
      )}

      {modalMedia && (
        <div onClick={() => setModalMedia(null)} className="media-modal-backdrop">
          <div onClick={(e) => e.stopPropagation()} className="media-modal-content">
            <button type="button" onClick={() => setModalMedia(null)} className="media-modal-close">
              ✕
            </button>
            <LiveFeedModal
              cameraId={modalMedia.cameraId}
              apiBaseUrl={apiBaseUrl}
              label={modalMedia.label}
              ptzSupported={modalMedia.ptzSupported}
              frigateStatus={frigateStatus}
              ptzStep={container.ptzStep}
              ptzGoToPreset={container.ptzGoToPreset}
              getPtzPresets={container.getPtzPresets}
              capturePtzPresetThumbnail={container.capturePtzPresetThumbnail}
            />
          </div>
        </div>
      )}
    </main>
  )
}
