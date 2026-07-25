import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { useToast } from './Toast'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { Btn } from './Btn'
import { Select } from './Select'
import ReactMarkdown from 'react-markdown'
import type { ApplyCameraConfiguration } from '../../application/use-cases/ApplyCameraConfiguration'
import type { CreateCamera } from '../../application/use-cases/CreateCamera'
import type { DeleteCamera } from '../../application/use-cases/DeleteCamera'
import type { DiscoverCameras } from '../../application/use-cases/DiscoverCameras'
import type { GetCameraDetectionConfig } from '../../application/use-cases/GetCameraDetectionConfig'
import type { GetCameraStatus } from '../../application/use-cases/GetCameraStatus'
import type { GetCameras } from '../../application/use-cases/GetCameras'
import type { GetCameraPrivacySchedules } from '../../application/use-cases/GetCameraPrivacySchedules'
import type { CreateCameraPrivacySchedule } from '../../application/use-cases/CreateCameraPrivacySchedule'
import type { DeleteCameraPrivacySchedule } from '../../application/use-cases/DeleteCameraPrivacySchedule'
import type { Camera } from '../../domain/entities/Camera'
import type { GetDetectionLabels as GetCameraLabels } from '../../application/use-cases/GetDetectionLabels'
import type { GetVendorAssistance } from '../../application/use-cases/GetVendorAssistance'
import type { SaveCameraDetectionConfig } from '../../application/use-cases/SaveCameraDetectionConfig'
import type { UpdateCamera } from '../../application/use-cases/UpdateCamera'
import type { VerifyDraftCamera } from '../../application/use-cases/VerifyDraftCamera'
import type { VerifyCamera } from '../../application/use-cases/VerifyCamera'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { FrigateStatus } from '../../domain/entities/SystemStats'
import type { SetPrivacyStrategy } from '../../application/use-cases/SetPrivacyStrategy'
import type { PtzStep } from '../../application/use-cases/PtzStep'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import type { GetPtzPresets } from '../../application/use-cases/GetPtzPresets'
import type { PtzSaveCurrentAsPreset } from '../../application/use-cases/PtzSaveCurrentAsPreset'
import type { PtzCalibrate } from '../../application/use-cases/PtzCalibrate'
import type { CapturePtzPresetThumbnail } from '../../application/use-cases/CapturePtzPresetThumbnail'
import { ConfirmModal } from './ConfirmModal'
import { useCameraStatus } from '../hooks/useCameraStatus'
import { useCameras } from '../hooks/useCameras'
import { useVendorAssistance } from '../hooks/useVendorAssistance'
import { resolveVendorLinkTarget } from '../vendorLinks'
import {
  formatCameraAddress,
  formatCameraStatusLabel,
  formatStatusTone,
  formatValidationStateLabel,
} from '../formatters/cameras'
import { appErrorMessage } from '../../domain/errors/AppError'
import { toAppError } from '../../domain/errors/toAppError'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { DetectionConfigSection } from './DetectionConfigSection'
import { PrivacyScheduleSection } from './PrivacyScheduleSection'
import { CapabilitySection } from './CapabilitySection'
import { PtzPresetsSection } from './PtzPresetsSection'
import { ImageSettingsPanel } from './ImageSettingsPanel'

interface CameraOnboardingViewProps {
  getCameras: GetCameras
  getCameraStatus: GetCameraStatus
  discoverCameras: DiscoverCameras
  getVendorAssistance: GetVendorAssistance
  createCamera: CreateCamera
  updateCamera: UpdateCamera
  verifyDraftCamera: VerifyDraftCamera
  verifyCamera: VerifyCamera
  applyCameraConfiguration: ApplyCameraConfiguration
  deleteCamera: DeleteCamera
  getCameraDetectionConfig: GetCameraDetectionConfig
  saveCameraDetectionConfig: SaveCameraDetectionConfig
  getCameraLabels: GetCameraLabels
  getPrivacySchedules: GetCameraPrivacySchedules
  createPrivacySchedule: CreateCameraPrivacySchedule
  deletePrivacySchedule: DeleteCameraPrivacySchedule
  setPrivacyStrategy: SetPrivacyStrategy
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  getPtzPresets: GetPtzPresets
  ptzSaveCurrentAsPreset: PtzSaveCurrentAsPreset
  ptzCalibrate: PtzCalibrate
  capturePtzPresetThumbnail: CapturePtzPresetThumbnail
  allCameras: Camera[]
  apiBaseUrl: string
  frigateStatus?: FrigateStatus
  onOpenLive: (camera: Camera, options?: { onClose?: () => Promise<void> }) => void
}

type DiscoveryCandidate = DiscoveredCamera

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
  vendorFamily: null,
  sourceType: 'rtsp_manual',
  streamProtocol: 'rtsp',
}

export function CameraOnboardingView(props: CameraOnboardingViewProps) {
  const camerasState = useCameras(props.getCameras)
  const [selection, setSelection] = useState<CameraSelection>({ kind: 'manual' })
  const selectedCameraId = selection.kind === 'camera' ? selection.cameraId : null
  const cameraStatusState = useCameraStatus(props.getCameraStatus, selectedCameraId)
  const [form, setForm] = useState<CameraDraftInput>(emptyForm)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryCandidate[]>([])
  const [applyLoading, setApplyLoading] = useState(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [detailMessage, setDetailMessage] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [draftVerification, setDraftVerification] = useState<{
    connected: boolean
    guidance: string | null
  } | null>(null)
  const [editForm, setEditForm] = useState<CameraDraftInput>(emptyForm)
  const [editPassword, setEditPassword] = useState('')
  const [detectionLabels, setDetectionLabels] = useState<string[]>(['person'])
  const [detectionAvailableLabels, setDetectionAvailableLabels] = useState<string[]>([])
  const [allDetectionLabels, setAllDetectionLabels] = useState<DetectionLabel[]>([])
  const [detectionContinuousRecording, setDetectionContinuousRecording] = useState(false)
  const [detectionConfigLoading, setDetectionConfigLoading] = useState(false)
  const [dvripMode, setDvripMode] = useState(false)
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null)
  const [strategyFeedback, setStrategyFeedback] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmScan, setConfirmScan] = useState(false)
  const [confirmApply, setConfirmApply] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    props.getCameraLabels
      .execute()
      .then(setAllDetectionLabels)
      .catch((e: unknown) => {
        toast(appErrorMessage(toAppError(e)), 'error')
      })
  }, [props.getCameraLabels, toast])

  const discoverAction = useAsyncAction(() => props.discoverCameras.execute(), {
    onSuccess: (candidates) => {
      setDiscoveryResults(candidates)
      if (candidates.length > 0) selectDiscoveryCandidate(0, candidates)
      setFormMessage(
        candidates.length > 0
          ? `${candidates.length} camera(s) candidate(s) detectee(s).`
          : 'Aucune camera detectee automatiquement.',
      )
    },
    onError: (e) => setDiscoveryError(appErrorMessage(e)),
  })

  const createAction = useAsyncAction(
    async () => {
      const created = await props.createCamera.execute(form)
      const verified = await props.verifyCamera.execute(created.id)
      camerasState.reload()
      setSelection({ kind: 'camera', cameraId: created.id })
      setDraftVerification(null)
      toast(
        verified.guidance ??
          `Camera "${created.displayName}" ajoutee. Appliquez la configuration pour activer la surveillance.`,
        'success',
      )
    },
    { onError: (e) => setFormError(appErrorMessage(e)) },
  )

  const verifyDraftAction = useAsyncAction(
    async () => {
      const status = await props.verifyDraftCamera.execute(form)
      if (!status.connected) {
        setDraftVerification(null)
        setFormError(status.guidance ?? 'Le flux n a pas pu etre valide.')
        return
      }
      setDraftVerification({ connected: status.connected, guidance: status.guidance })
      setFormMessage(status.guidance ?? 'Flux valide. Vous pouvez maintenant ajouter cette camera.')
    },
    {
      onError: (e) => {
        setDraftVerification(null)
        setFormError(appErrorMessage(e))
      },
    },
  )

  const verifyAction = useAsyncAction(
    async () => {
      const status = await props.verifyCamera.execute(selectedCameraId!)
      camerasState.reload()
      cameraStatusState.reload()
      setDetailMessage(status.guidance ?? 'Verification terminee.')
    },
    { onError: (e) => setDetailError(appErrorMessage(e)) },
  )

  const refreshAction = useAsyncAction(
    async () => {
      const candidates = await props.discoverCameras.execute({
        host: selectedCandidate!.host,
        port: selectedCandidate!.port,
      })
      const refreshed = candidates.find((c) => c.host === selectedCandidate!.host)
      if (!refreshed) {
        setFormMessage('Aucune nouvelle information detectee pour ce candidat.')
        return
      }
      const idx = selection.kind === 'candidate' ? selection.index : 0
      const nextResults = [...discoveryResults]
      nextResults[idx] = refreshed
      setDiscoveryResults(nextResults)
      selectDiscoveryCandidate(idx, nextResults)
      setFormMessage(
        refreshed.streamPath
          ? 'Candidat rafraichi. La camera semble maintenant joignable.'
          : 'Candidat rafraichi. Les informations de detection ont ete mises a jour.',
      )
    },
    { onError: (e) => setFormError(appErrorMessage(e)) },
  )

  const deleteCameraAction = useAsyncAction(
    async () => {
      const result = await props.deleteCamera.execute(selectedCameraId!)
      camerasState.reload()
      cameraStatusState.reload()
      toast(result.message, 'info')
    },
    { onError: (e) => setDetailError(appErrorMessage(e)) },
  )

  const updateAction = useAsyncAction(
    async () => {
      const updated = await props.updateCamera.execute(selectedCameraId!, {
        ...editForm,
        password: editPassword.trim() ? editPassword : null,
      })
      camerasState.reload()
      cameraStatusState.reload()
      setEditPassword('')
      toast(
        updated.validationState === 'draft'
          ? 'Camera mise a jour. Reverifiez le flux avant d appliquer la configuration.'
          : 'Camera mise a jour. Appliquez la configuration pour prendre en compte les modifications.',
        'success',
      )
    },
    { onError: (e) => setDetailError(appErrorMessage(e)) },
  )

  const saveStrategyAction = useAsyncAction(
    () => props.setPrivacyStrategy.execute(selectedCameraId!, pendingStrategy!),
    {
      onSuccess: () => {
        setStrategyFeedback('Stratégie enregistrée.')
        camerasState.reload()
      },
      onError: (e) => setStrategyFeedback(appErrorMessage(e)),
    },
  )

  const actionLoading =
    applyLoading ||
    createAction.loading ||
    verifyDraftAction.loading ||
    verifyAction.loading ||
    refreshAction.loading ||
    deleteCameraAction.loading ||
    updateAction.loading

  const selectedCandidate =
    selection.kind === 'candidate' ? (discoveryResults[selection.index] ?? null) : null

  const selectedCamera = selectedCameraId
    ? (camerasState.data.find((camera) => camera.id === selectedCameraId) ?? null)
    : null

  // undefined while status is loading → no gate flicker; false = confirmed offline
  const cameraOffline = cameraStatusState.data?.connected === false

  const matchedDiscoveryCandidate = selectedCamera
    ? (discoveryResults.find(
        (candidate) =>
          candidate.host === selectedCamera.host && candidate.port === selectedCamera.port,
      ) ?? null)
    : null

  const unclaimedDiscoveryResults = discoveryResults.filter(
    (candidate) => !camerasState.data.some((c) => c.host === candidate.host),
  )

  // form.vendorFamily is the candidate's auto-detected value until the user overrides it in
  // Interpretation (renderInterpretationSection) — reading it here (rather than
  // selectedCandidate.vendorFamily directly) makes the vendor assistance notice below follow a
  // manual correction immediately, not only after the camera is actually created.
  const activeVendorFamily =
    (selection.kind === 'candidate' ? form.vendorFamily : null) ??
    selectedCamera?.vendorFamily ??
    matchedDiscoveryCandidate?.vendorFamily ??
    null

  const activeStreamPath =
    selectedCandidate?.streamPath ?? matchedDiscoveryCandidate?.streamPath ?? null

  const vendorAssistanceState = useVendorAssistance(
    props.getVendorAssistance,
    activeVendorFamily,
    activeStreamPath,
    cameraStatusState.data?.connected ?? false,
  )

  const hasDvripSignal = Boolean(
    selectedCandidate?.qualificationReasons.includes('dvrip_port_detected'),
  )
  const dvripFallbackAvailable = hasDvripSignal && !selectedCandidate?.streamPath

  const selectedCandidateNeedsRtspActivation = Boolean(
    selectedCandidate && !selectedCandidate.streamPath && !dvripMode,
  )
  const canShowCandidateForm =
    selection.kind === 'manual' ||
    Boolean(selectedCandidate && selectedCandidate.streamPath) ||
    dvripMode
  const canVerifyDraft =
    canShowCandidateForm &&
    !selectedCandidateNeedsRtspActivation &&
    Boolean(form.displayName.trim() && form.host.trim() && (dvripMode || form.streamPath?.trim()))
  const canAddConfiguredCamera = Boolean(draftVerification?.connected) || dvripMode
  const canApplyConfiguration = camerasState.data.some(
    (camera) =>
      camera.status === 'online' ||
      camera.validationState === 'validated' ||
      camera.validationState === 'pending_removal',
  )
  const canUpdateConfiguredCamera = Boolean(
    selectedCamera &&
    editForm.displayName.trim() &&
    editForm.host.trim() &&
    (editForm.streamProtocol === 'dvrip' || editForm.streamPath?.trim()) &&
    selectedCamera.validationState !== 'pending_removal',
  )

  useEffect(() => {
    if (
      selection.kind === 'camera' &&
      !camerasState.data.some((camera) => camera.id === selection.cameraId)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection(
        camerasState.data.length > 0
          ? { kind: 'camera', cameraId: camerasState.data[0].id }
          : { kind: 'manual' },
      )
    }
  }, [camerasState.data, selection])

  useEffect(() => {
    if (selection.kind === 'candidate' && !discoveryResults[selection.index]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelection({ kind: 'manual' })
    }
  }, [discoveryResults, selection])

  useEffect(() => {
    if (!selectedCamera) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditForm({
      displayName: selectedCamera.displayName,
      host: selectedCamera.host,
      port: selectedCamera.port,
      username: selectedCamera.username ?? null,
      password: null,
      streamPath: selectedCamera.streamPath ?? null,
      vendorFamily: selectedCamera.vendorFamily ?? null,
      sourceType: selectedCamera.sourceType,
      streamProtocol: selectedCamera.streamProtocol ?? 'rtsp',
      ptzSupported: selectedCamera.ptzSupported,
    })
    setEditPassword('')
    setDetectionLabels(['person'])
    setDetectionAvailableLabels([])
    setDetectionContinuousRecording(false)
    setPendingStrategy(selectedCamera.privacyStrategy ?? 'none')
    setStrategyFeedback(null)
    setDetectionConfigLoading(true)
    props.getCameraDetectionConfig
      .execute(selectedCamera.id)
      .then((config) => {
        if (config) {
          setDetectionLabels(config.labels)
          setDetectionAvailableLabels(config.availableLabels)
          setDetectionContinuousRecording(config.continuousRecordingEnabled)
        }
      })
      .catch((e: unknown) => {
        toast(appErrorMessage(toAppError(e)), 'error')
      })
      .finally(() => setDetectionConfigLoading(false))
  }, [selectedCamera, props.getCameraDetectionConfig, toast])

  async function handleDiscovery() {
    setDiscoveryError(null)
    setFormError(null)
    await discoverAction.run()
  }

  async function handleCreate() {
    if (!dvripMode && !draftVerification?.connected) {
      setFormError('Verifiez d abord le flux avant d ajouter la camera.')
      return
    }
    setFormError(null)
    setFormMessage(null)
    setDetailMessage(null)
    await createAction.run()
  }

  async function handleVerifyDraft() {
    setFormError(null)
    setFormMessage(null)
    await verifyDraftAction.run()
  }

  async function handleVerify() {
    if (!selectedCameraId) return
    setDetailError(null)
    setDetailMessage(null)
    await verifyAction.run()
  }

  async function handleRefreshCandidate() {
    if (!selectedCandidate || selection.kind !== 'candidate') return
    setFormError(null)
    setFormMessage(null)
    await refreshAction.run()
  }

  async function handleApplyConfiguration() {
    setApplyLoading(true)
    setFormError(null)
    setDetailError(null)

    try {
      const result = await props.applyCameraConfiguration.execute()
      camerasState.reload()
      if (selectedCameraId) {
        cameraStatusState.reload()
      }

      if (!result.applied) {
        if (selection.kind === 'camera') {
          setDetailError(result.message)
        } else {
          setFormError(result.message)
        }
        return
      }

      toast(`${result.message} (${result.configPath})`, 'success')
    } catch (error: unknown) {
      const message = appErrorMessage(toAppError(error))
      if (selection.kind === 'camera') {
        setDetailError(message)
      } else {
        setFormError(message)
      }
    } finally {
      setApplyLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedCameraId) return
    setDetailError(null)
    setDetailMessage(null)
    await deleteCameraAction.run()
  }

  async function handleUpdate() {
    if (!selectedCameraId) return
    setDetailError(null)
    setDetailMessage(null)
    await updateAction.run()
  }

  function updateForm(patch: Partial<CameraDraftInput>) {
    setDraftVerification(null)
    setFormMessage(null)
    setFormError(null)
    setForm((current) => ({ ...current, ...patch }))
  }

  function selectDiscoveryCandidate(index: number, source = discoveryResults) {
    const candidate = source[index]
    if (!candidate) {
      return
    }

    setSelection({ kind: 'candidate', index })
    setDraftVerification(null)
    setDvripMode(false)
    updateForm({
      displayName: candidate.displayName,
      host: candidate.host,
      port: candidate.port,
      sourceType: candidate.sourceType,
      streamPath: candidate.streamPath,
      vendorFamily: candidate.vendorFamily,
      streamProtocol: 'rtsp',
    })
    setFormMessage(null)
  }

  function handleDvripModeToggle(enabled: boolean) {
    setDvripMode(enabled)
    setDraftVerification(null)
    setFormMessage(null)
    setFormError(null)
    if (enabled) {
      setForm((current) => ({ ...current, port: 34567, streamPath: null, streamProtocol: 'dvrip' }))
    } else {
      setForm((current) => ({
        ...current,
        port: selectedCandidate?.port ?? 554,
        streamPath: selectedCandidate?.streamPath ?? null,
        streamProtocol: 'rtsp',
      }))
    }
  }

  function selectManualEntry() {
    setSelection({ kind: 'manual' })
    setDraftVerification(null)
    setDvripMode(false)
    setForm(emptyForm)
    setFormMessage(null)
    setDetailError(null)
  }

  function selectCamera(cameraId: string) {
    setSelection({ kind: 'camera', cameraId })
    setDraftVerification(null)
    setDetailError(null)
    setDetailMessage(null)
  }

  function updateEditForm(patch: Partial<CameraDraftInput>) {
    setDetailError(null)
    setDetailMessage(null)
    setEditForm((current) => ({ ...current, ...patch }))
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

  // Kept deliberately minimal: a correctable conclusion (constructeur, always editable — the fix
  // for "auto-detection got it wrong and I can't change it") plus the capability→protocol map.
  // Support badge, raw qualification string and "detection retenue" were dropped — they either
  // duplicated the sidebar badge or exposed internal technical labels with no actionable value.
  // The "supposition" chips (vendor_hint_detected, hostname_camera_hint, etc.) were removed
  // entirely: they read as confident findings but are themselves guesses about a guess.
  //
  // Pure display: the capability→protocols mapping is decided entirely backend-side by crossing
  // detected protocols with the capability registry (ADR-32). Naturally many-to-many — a capability
  // may list several protocols, and a protocol may appear under several capabilities. The frontend
  // hardcodes no protocol or capability name; it renders exactly what the backend resolved.
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
                value={form.vendorFamily ?? ''}
                onChange={(event) => updateForm({ vendorFamily: event.target.value || null })}
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
            className={`status-pill ${camerasState.error ? 'degraded' : camerasState.loading ? 'loading' : 'online'}`}
          >
            {camerasState.loading
              ? 'Chargement'
              : camerasState.error
                ? 'Catalogue indisponible'
                : 'Catalogue pret'}
          </div>
          <p>
            {camerasState.error
              ? appErrorMessage(camerasState.error)
              : `${camerasState.data.length} camera(s) dans le catalogue actuel.`}
          </p>
          {discoveryError ? <p className="status-inline error">{discoveryError}</p> : null}
        </div>
      </section>

      <section className="camera-master-detail">
        <aside className="panel camera-sidebar">
          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Cameras configurees</h2>
              <span className="camera-sidebar-count">{camerasState.data.length}</span>
            </div>
            <button
              className="primary-cta camera-sidebar-btn"
              type="button"
              onClick={() => setConfirmApply(true)}
              disabled={actionLoading || !canApplyConfiguration}
            >
              {applyLoading ? 'Application...' : 'Appliquer'}
            </button>
            {props.frigateStatus === 'restarting' && (
              <p className="camera-sidebar-restart-hint">Redémarrage en cours…</p>
            )}

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

          <div className="camera-sidebar-group">
            <div className="camera-sidebar-header">
              <h2>Candidats</h2>
              <span className="camera-sidebar-count">{unclaimedDiscoveryResults.length}</span>
            </div>
            <button
              className="primary-cta camera-sidebar-btn"
              type="button"
              onClick={() => setConfirmScan(true)}
              disabled={discoverAction.loading || actionLoading}
            >
              {discoverAction.loading ? 'Recherche...' : 'Scanner'}
            </button>

            {discoveryError ? <p className="camera-inline-state error">{discoveryError}</p> : null}

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

            {unclaimedDiscoveryResults.length > 0 ? (
              unclaimedDiscoveryResults.map((candidate) => {
                const originalIndex = discoveryResults.indexOf(candidate)
                return (
                  <button
                    key={`${candidate.host}-${candidate.port}`}
                    type="button"
                    className={`camera-nav-item candidate-preview-card ${selection.kind === 'candidate' && selection.index === originalIndex ? 'selected' : ''}`}
                    onClick={() => selectDiscoveryCandidate(originalIndex)}
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
                        checked={dvripMode}
                        onChange={(e) => handleDvripModeToggle(e.target.checked)}
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

              {formMessage ? (
                <p className="camera-inline-state success action-feedback">{formMessage}</p>
              ) : null}
              {formError ? (
                <p className="camera-inline-state error action-feedback">{formError}</p>
              ) : null}

              {canShowCandidateForm ? (
                <>
                  <div className="camera-form-grid compact">
                    <label>
                      <span>Nom</span>
                      <input
                        value={form.displayName}
                        onChange={(event) => updateForm({ displayName: event.target.value })}
                        placeholder="Porte d'entree"
                      />
                    </label>
                    <label>
                      <span>Host</span>
                      <input
                        value={form.host}
                        onChange={(event) => updateForm({ host: event.target.value })}
                        placeholder="192.168.1.10"
                      />
                    </label>
                    <label>
                      <span>Port</span>
                      <input
                        type="number"
                        value={form.port}
                        onChange={(event) =>
                          updateForm({ port: Number(event.target.value) || 554 })
                        }
                      />
                    </label>
                    {!dvripMode ? (
                      <label>
                        <span>Chemin de flux</span>
                        <input
                          value={form.streamPath ?? ''}
                          onChange={(event) =>
                            updateForm({ streamPath: event.target.value || null })
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
                        value={form.username ?? ''}
                        onChange={(event) => updateForm({ username: event.target.value || null })}
                      />
                    </label>
                    <label>
                      <span>Mot de passe</span>
                      <input
                        type="password"
                        value={form.password ?? ''}
                        onChange={(event) => updateForm({ password: event.target.value || null })}
                      />
                    </label>
                    {selection.kind === 'manual' ? (
                      <label>
                        <span>Marque (si non reconnue automatiquement)</span>
                        <Select
                          value={form.vendorFamily ?? ''}
                          onChange={(event) =>
                            updateForm({ vendorFamily: event.target.value || null })
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
          ) : (
            <>
              <div className="panel-heading camera-panel-heading">
                <div>
                  <p className="section-kicker">Camera</p>
                  <h2>{selectedCamera?.displayName ?? '—'}</h2>
                  {selectedCamera && (
                    <div className="camera-panel-meta">
                      <span>{formatCameraAddress(selectedCamera)}</span>
                      {(selectedCamera.vendorFamily ?? matchedDiscoveryCandidate?.vendorFamily) && (
                        <>
                          <span className="camera-panel-meta-sep">·</span>
                          <span>
                            {formatVendorFamily(
                              selectedCamera.vendorFamily ??
                                matchedDiscoveryCandidate?.vendorFamily ??
                                null,
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {cameraStatusState.data && (
                  <div
                    className={`status-pill camera-detail-status ${cameraStatusState.data.connected ? 'online' : 'warning'}`}
                  >
                    {formatCameraStatusLabel(cameraStatusState.data.status)}
                  </div>
                )}
              </div>

              {cameraStatusState.loading && (
                <p className="camera-inline-state">Vérification de la connexion…</p>
              )}
              {cameraStatusState.error && (
                <p className="camera-inline-state error">
                  {appErrorMessage(cameraStatusState.error)}
                </p>
              )}

              {selectedCamera ? (
                <div className="camera-detail-sections">
                  <CapabilitySection
                    camera={selectedCamera}
                    offline={cameraOffline}
                    onReload={camerasState.reload}
                  />

                  <div className="camera-detail-section camera-live-actions">
                    <Btn
                      variant="secondary"
                      size="md"
                      onClick={() => props.onOpenLive(selectedCamera)}
                    >
                      {selectedCamera.ptzSupported ? 'Piloter la caméra' : 'Voir le live'}
                    </Btn>
                  </div>

                  {selectedCamera.ptzSupported && (
                    <PtzPresetsSection
                      cameraId={selectedCamera.id}
                      apiBaseUrl={props.apiBaseUrl}
                      getPtzPresets={props.getPtzPresets}
                      ptzSaveCurrentAsPreset={props.ptzSaveCurrentAsPreset}
                      ptzGoToPreset={props.ptzGoToPreset}
                      ptzCalibrate={props.ptzCalibrate}
                      capturePtzPresetThumbnail={props.capturePtzPresetThumbnail}
                    />
                  )}

                  {selectedCamera.verifiedCapabilities.includes('image_settings') && (
                    <ImageSettingsPanel camera={selectedCamera} offline={cameraOffline} />
                  )}

                  <details className="camera-detail-section camera-connection-details">
                    <summary>Paramètres de connexion</summary>
                    <div className="camera-form-grid compact">
                      <label>
                        <span>Nom</span>
                        <input
                          value={editForm.displayName}
                          onChange={(e) => updateEditForm({ displayName: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>Host</span>
                        <input
                          value={editForm.host}
                          onChange={(e) => updateEditForm({ host: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>Port</span>
                        <input
                          type="number"
                          value={editForm.port}
                          onChange={(e) => updateEditForm({ port: Number(e.target.value) || 554 })}
                        />
                      </label>
                      {editForm.streamProtocol !== 'dvrip' ? (
                        <label>
                          <span>Chemin de flux</span>
                          <input
                            value={editForm.streamPath ?? ''}
                            onChange={(e) => updateEditForm({ streamPath: e.target.value || null })}
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
                          value={editForm.username ?? ''}
                          onChange={(e) => updateEditForm({ username: e.target.value || null })}
                        />
                      </label>
                      <label>
                        <span>Nouveau mot de passe</span>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Laisser vide pour conserver"
                        />
                      </label>
                    </div>
                    <div className="panel-cta-row">
                      <Btn
                        variant="primary"
                        size="md"
                        loading={updateAction.loading}
                        disabled={actionLoading || !canUpdateConfiguredCamera}
                        onClick={handleUpdate}
                      >
                        Enregistrer
                      </Btn>
                      <Btn
                        variant="secondary"
                        size="md"
                        loading={verifyAction.loading}
                        disabled={
                          actionLoading || selectedCamera.validationState === 'pending_removal'
                        }
                        onClick={handleVerify}
                      >
                        Vérifier la connexion
                      </Btn>
                      <Btn
                        variant="danger"
                        size="md"
                        disabled={
                          actionLoading || selectedCamera.validationState === 'pending_removal'
                        }
                        onClick={() => setConfirmDelete(true)}
                      >
                        {selectedCamera.validationState === 'pending_removal'
                          ? 'Suppression en attente'
                          : 'Supprimer'}
                      </Btn>
                    </div>
                    {detailMessage && (
                      <p className="camera-inline-state success action-feedback">{detailMessage}</p>
                    )}
                    {detailError && (
                      <p className="camera-inline-state error action-feedback">{detailError}</p>
                    )}
                  </details>

                  <DetectionConfigSection
                    labels={detectionLabels}
                    availableLabels={detectionAvailableLabels}
                    allLabels={allDetectionLabels}
                    loading={detectionConfigLoading}
                    continuousRecordingEnabled={detectionContinuousRecording}
                    onToggle={(value) => {
                      const newLabels = detectionLabels.includes(value)
                        ? detectionLabels.filter((l) => l !== value)
                        : [...detectionLabels, value]
                      setDetectionLabels(newLabels)
                      if (selectedCameraId) {
                        props.saveCameraDetectionConfig
                          .execute(selectedCameraId, newLabels, detectionContinuousRecording)
                          .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))
                      }
                    }}
                    onToggleContinuousRecording={() => {
                      const newValue = !detectionContinuousRecording
                      setDetectionContinuousRecording(newValue)
                      if (selectedCameraId) {
                        props.saveCameraDetectionConfig
                          .execute(selectedCameraId, detectionLabels, newValue)
                          .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))
                      }
                    }}
                  />

                  <section className="camera-detail-section">
                    <h3>Mode vie privée</h3>
                    <div className="privacy-strategy-selector">
                      {[
                        {
                          value: 'none' as const,
                          label: 'Aucun',
                          desc: "Pas de mode vie privée — Frigate continue d'enregistrer.",
                          requiresPtz: false,
                          requiresHw: false,
                        },
                        {
                          value: 'software_blur' as const,
                          label: 'Logiciel (flou Frigate)',
                          desc: 'Enregistrement désactivé dans Vyzio — la caméra reste accessible en dehors.',
                          requiresPtz: false,
                          requiresHw: false,
                        },
                        {
                          value: 'ptz_parking' as const,
                          label: 'Orientation vers zone neutre',
                          desc: "La caméra pivote vers un endroit non filmé et l'enregistrement est désactivé.",
                          requiresPtz: true,
                          requiresHw: false,
                        },
                        {
                          value: 'hardware' as const,
                          label: 'Coupure matérielle',
                          desc: 'Objectif masqué directement dans la caméra (Tapo uniquement).',
                          requiresPtz: false,
                          requiresHw: true,
                        },
                      ].map(({ value, label, desc, requiresPtz, requiresHw }) => {
                        const disabled =
                          (requiresPtz && !selectedCamera.ptzSupported) ||
                          (requiresHw && selectedCamera.vendorFamily !== 'tplink_tapo')
                        return (
                          <label
                            key={value}
                            className="privacy-strategy-option"
                            style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                          >
                            <input
                              type="radio"
                              name="privacyStrategy"
                              value={value}
                              checked={pendingStrategy === value}
                              disabled={disabled}
                              onChange={() => {
                                setPendingStrategy(value)
                                setStrategyFeedback(null)
                              }}
                            />
                            <span className="privacy-strategy-label">
                              <strong>{label}</strong>
                              <span>{desc}</span>
                            </span>
                          </label>
                        )
                      })}

                      {pendingStrategy === 'ptz_parking' && (
                        <div className="privacy-strategy-warning">
                          <span className="privacy-strategy-warning-icon">⚠</span>
                          <span>
                            La caméra pivote vers une zone non sensible et l'enregistrement est
                            désactivé dans Vyzio, mais elle reste physiquement accessible sur votre
                            réseau local.
                          </span>
                        </div>
                      )}

                      <Btn
                        variant="primary"
                        size="sm"
                        style={{ alignSelf: 'flex-start', marginTop: 4 }}
                        loading={saveStrategyAction.loading}
                        disabled={
                          saveStrategyAction.loading ||
                          pendingStrategy === selectedCamera.privacyStrategy
                        }
                        onClick={async () => {
                          if (!pendingStrategy) return
                          setStrategyFeedback(null)
                          await saveStrategyAction.run()
                        }}
                      >
                        Enregistrer la stratégie
                      </Btn>

                      {strategyFeedback && <p className="ptz-feedback">{strategyFeedback}</p>}
                    </div>
                  </section>

                  {selectedCameraId && (
                    <PrivacyScheduleSection
                      camera={selectedCamera}
                      cameraId={selectedCameraId}
                      allCameras={props.allCameras}
                      getSchedules={props.getPrivacySchedules}
                      createSchedule={props.createPrivacySchedule}
                      deleteSchedule={props.deletePrivacySchedule}
                    />
                  )}
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

      {confirmScan && (
        <ConfirmModal
          title="Scanner le réseau"
          body="Vyzio va sonder l'ensemble de votre réseau local à la recherche de caméras IP. Cette opération peut prendre entre 15 et 30 secondes et génère du trafic réseau."
          confirmLabel="Lancer le scan"
          tone="confirm"
          onConfirm={async () => {
            setConfirmScan(false)
            await handleDiscovery()
          }}
          onCancel={() => setConfirmScan(false)}
        />
      )}

      {confirmApply && (
        <ConfirmModal
          title="Appliquer la configuration"
          body="Vyzio va regénérer la configuration et redémarrer Frigate. La surveillance sera interrompue brièvement (quelques secondes à quelques dizaines de secondes selon votre machine)."
          confirmLabel="Appliquer"
          tone="warn"
          onConfirm={async () => {
            setConfirmApply(false)
            await handleApplyConfiguration()
          }}
          onCancel={() => setConfirmApply(false)}
        />
      )}

      {confirmDelete && selectedCameraId && (
        <ConfirmModal
          title="Supprimer la caméra"
          body={`Supprimer "${selectedCamera?.displayName ?? 'cette caméra'}" du catalogue ? La configuration Frigate sera mise à jour et l'enregistrement sur cette caméra sera arrêté.`}
          confirmLabel="Supprimer la caméra"
          tone="danger"
          onConfirm={async () => {
            await handleDelete()
            setConfirmDelete(false)
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </main>
  )
}
