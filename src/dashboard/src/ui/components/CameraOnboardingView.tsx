import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { useToast } from './Toast'
import { useAsyncAction } from '../hooks/useAsyncAction'
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
import type { SetPrivacyStrategy } from '../../application/use-cases/SetPrivacyStrategy'
import type { PtzStep } from '../../application/use-cases/PtzStep'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'

import type { ConfigurePtzParking } from '../../application/use-cases/ConfigurePtzParking'
import { ConfirmModal } from './ConfirmModal'
import { PtzControlPanel } from './PtzControlPanel'
import { useCameraStatus } from '../hooks/useCameraStatus'
import { useCameras } from '../hooks/useCameras'
import { useVendorAssistance } from '../hooks/useVendorAssistance'
import { resolveVendorLinkTarget } from '../vendorLinks'
import {
  formatCameraAddress,
  formatCameraCheck,
  formatCameraPreview,
  formatCameraStatusLabel,
  formatStatusTone,
  formatValidationStateLabel,
} from '../formatters/cameras'
import { appErrorMessage } from '../../domain/errors/AppError'
import { toAppError } from '../../domain/errors/toAppError'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { CameraLiveView } from './CameraLiveView'
import { DetectionConfigSection } from './DetectionConfigSection'
import { PrivacyScheduleSection } from './PrivacyScheduleSection'
import { CapabilitySection } from './CapabilitySection'

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
  configurePtzParking: ConfigurePtzParking
  allCameras: Camera[]
  apiBaseUrl: string
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
  const [showLive, setShowLive] = useState(false)
  const [dvripMode, setDvripMode] = useState(false)
  const [pendingStrategy, setPendingStrategy] = useState<string | null>(null)
  const [strategyFeedback, setStrategyFeedback] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmScan, setConfirmScan] = useState(false)
  const [confirmApply, setConfirmApply] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    props.getCameraLabels.execute()
      .then(setAllDetectionLabels)
      .catch((e: unknown) => { toast(appErrorMessage(toAppError(e)), 'error') })
  }, [props.getCameraLabels, toast])

  const discoverAction = useAsyncAction(
    () => props.discoverCameras.execute(),
    {
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
    },
  )

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
      const [updated] = await Promise.all([
        props.updateCamera.execute(selectedCameraId!, {
          ...editForm,
          password: editPassword.trim() ? editPassword : null,
        }),
        props.saveCameraDetectionConfig.execute(selectedCameraId!, detectionLabels, detectionContinuousRecording),
      ])
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
    (candidate) =>
      !camerasState.data.some((c) => c.host === candidate.host),
  )

  const activeVendorFamily =
    selectedCandidate?.vendorFamily ??
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

  const hasDvripSignal = Boolean(selectedCandidate?.qualificationReasons.includes('dvrip_port_detected'))
  const dvripFallbackAvailable = hasDvripSignal && !selectedCandidate?.streamPath

  const selectedCandidateNeedsRtspActivation = Boolean(
    selectedCandidate && !selectedCandidate.streamPath && !dvripMode,
  )
  const canShowCandidateForm =
    selection.kind === 'manual' || Boolean(selectedCandidate && selectedCandidate.streamPath) || dvripMode
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
    setShowLive(false)
    setPendingStrategy(selectedCamera.privacyModeStrategy ?? 'software')
    setStrategyFeedback(null)
    setDetectionConfigLoading(true)
    props.getCameraDetectionConfig.execute(selectedCamera.id)
      .then((config) => {
        if (config) {
          setDetectionLabels(config.labels)
          setDetectionAvailableLabels(config.availableLabels)
          setDetectionContinuousRecording(config.continuousRecordingEnabled)
        }
      })
      .catch((e: unknown) => { toast(appErrorMessage(toAppError(e)), 'error') })
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
        return 'Flux local'
      case 'network_scan':
        return 'Scan reseau'
      case 'http_probe':
        return 'HTTP camera'
      case 'http_service':
        return 'HTTP generique'
      case 'dvrip_probe':
        return 'Connexion alternative detectee'
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
        return 'Port de flux joignable'
      case 'http_camera_signature':
        return 'Interface web camera reconnue'
      case 'rtsp_path_known':
        return 'Chemin de flux deja connu'
      case 'vendor_hint_detected':
        return 'Constructeur probable detecte'
      case 'mac_address_observed':
        return 'Adresse MAC observee'
      case 'dvrip_port_detected':
        return 'Connexion alternative possible'
      default:
        return reason
    }
  }

  const shouldShowVendorAssistance =
    vendorAssistanceState.loading ||
    Boolean(vendorAssistanceState.error) ||
    Boolean(vendorAssistanceState.data?.markdown)

  function renderSummarySection(options: {
    address: string
    vendorFamily: string | null
    supportedCandidate?: DiscoveryCandidate | null
    rtspActive: boolean
  }) {
    const { address, vendorFamily, supportedCandidate = null, rtspActive } = options

    return (
      <section className="camera-detail-section">
        <h3>Resume</h3>
        <dl className="camera-summary-list">
          <div>
            <dt>Adresse</dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt>Constructeur</dt>
            <dd>{formatVendorFamily(vendorFamily)}</dd>
          </div>
          <div>
            <dt>Connexion active</dt>
            <dd>
              <span className={`camera-rtsp-badge ${rtspActive ? 'ready' : 'missing'}`}>
                {rtspActive ? 'Oui' : 'Non'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd>
              <span
                className={`camera-support-badge ${supportBadgeTone(vendorFamily, supportedCandidate)}`}
              >
                {formatSupportLabel(vendorFamily, supportedCandidate)}
              </span>
            </dd>
          </div>
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
          <p className="camera-inline-state error">{appErrorMessage(vendorAssistanceState.error)}</p>
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

  function renderTechnicalDetails(
    candidate: DiscoveryCandidate | null,
    fallbackHost: string | null = null,
  ) {
    const technicalDetails = candidate?.technicalDetails
    const host = candidate?.host ?? fallbackHost

    return (
      <details className="camera-debug-details">
        <summary>Informations</summary>
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
              <dt>Ports flux detectes</dt>
              <dd>{formatMutedList(technicalDetails?.rtspPortsDetected)}</dd>
            </div>
            <div>
              <dt>Chemins de flux detectes</dt>
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
              )})
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
                  renderSummarySection({
                    address: formatCandidateAddress(selectedCandidate),
                    vendorFamily: selectedCandidate.vendorFamily,
                    supportedCandidate: selectedCandidate,
                    rtspActive: Boolean(selectedCandidate.streamPath),
                  })
                ) : (
                  <section className="camera-detail-section">
                    <h3>Resume</h3>
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
                      La connexion a la camera n'est pas encore active. Configurez-la d'abord via son
                      application, puis revenez ici pour l'ajouter au catalogue.
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
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={dvripMode}
                        onChange={(e) => handleDvripModeToggle(e.target.checked)}
                        style={{ accentColor: 'currentColor' }}
                      />
                      Utiliser ce mode alternatif (ne pas activer si la connexion standard fonctionne)
                    </label>
                  </section>
                ) : null}

                {renderVendorAssistanceSection()}

                {selectedCandidate ? renderConfidenceDetails(selectedCandidate) : null}
                {selectedCandidate ? renderTechnicalDetails(selectedCandidate) : null}
              </div>

              {selectedCandidate ? (
                <div className="panel-cta-row">
                  <button
                    className="secondary-cta"
                    type="button"
                    onClick={handleRefreshCandidate}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Traitement...' : 'Rafraichir ce candidat'}
                  </button>
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
                          onChange={(event) => updateForm({ streamPath: event.target.value || null })}
                          placeholder="/Streaming/Channels/101"
                        />
                      </label>
                    ) : (
                      <label>
                        <span>Protocole</span>
                        <input value="Mode alternatif (ICSee / XMEye)" readOnly style={{ opacity: 0.6 }} />
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
                  </div>

                  <div className="panel-cta-row">
                    <button
                        className="secondary-cta"
                        type="button"
                        onClick={handleVerifyDraft}
                        disabled={actionLoading || !canVerifyDraft}
                      >
                        {actionLoading ? 'Traitement...' : 'Verifier la connexion'}
                      </button>
                    <button
                      className="primary-cta"
                      type="button"
                      onClick={handleCreate}
                      disabled={actionLoading || !canAddConfiguredCamera}
                    >
                      {actionLoading ? 'Traitement...' : 'Ajouter'}
                    </button>
                  </div>

                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="panel-heading camera-panel-heading">
                <div>
                  <p className="section-kicker">Camera</p>
                  <h2>{selectedCamera?.displayName ?? 'Camera selectionnee'}</h2>
                </div>
                {cameraStatusState.data ? (
                  <div
                    className={`status-pill camera-detail-status ${cameraStatusState.data.connected ? 'online' : 'warning'}`}
                  >
                    {formatCameraStatusLabel(cameraStatusState.data.status)}
                  </div>
                ) : null}
              </div>

              {cameraStatusState.loading ? (
                <p className="camera-inline-state">Chargement de l&apos;etat detaille...</p>
              ) : null}
              {cameraStatusState.error ? (
                <p className="camera-inline-state error">{appErrorMessage(cameraStatusState.error)}</p>
              ) : null}

              {cameraStatusState.data ? (
                <div className="camera-detail-stack">
                  <div className="camera-detail-summary">
                    <p>{cameraStatusState.data.guidance}</p>
                  </div>

                  <div className="camera-detail-sections">
                    {renderSummarySection({
                      address: selectedCamera ? formatCameraAddress(selectedCamera) : '—',
                      vendorFamily:
                        selectedCamera?.vendorFamily ??
                        matchedDiscoveryCandidate?.vendorFamily ??
                        null,
                      supportedCandidate: matchedDiscoveryCandidate,
                      rtspActive: cameraStatusState.data.connected,
                    })}

                    <section className="camera-detail-section">
                      <h3>Live</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button
                          type="button"
                          className="secondary-cta"
                          style={{ alignSelf: 'flex-start', minHeight: 28, padding: '0 10px', fontSize: '0.82rem' }}
                          onClick={() => setShowLive((v) => !v)}
                        >
                          {showLive ? 'Arreter le live' : 'Voir le live'}
                        </button>
                        {showLive && selectedCameraId && (
                          <CameraLiveView
                            cameraId={selectedCameraId}
                            apiBaseUrl={props.apiBaseUrl}
                          />
                        )}
                      </div>
                    </section>

                    {selectedCamera?.ptzSupported && selectedCameraId && (
                      <section className="camera-detail-section">
                        <h3>Contrôle PTZ</h3>

                        {cameraOffline ? (
                          <p className="camera-inline-state">
                            Caméra hors ligne — le contrôle PTZ est indisponible.
                          </p>
                        ) : (
                          <>
                            {selectedCamera.validationState === 'draft' && (
                              <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-muted, #888)',
                                background: 'var(--surface-alt, #f9fafb)',
                                border: '1px solid var(--border, #e5e7eb)',
                                borderRadius: 6,
                                padding: '8px 12px',
                                marginBottom: 12,
                              }}>
                                Caméra motorisée détectée — orientez-la vers sa position de surveillance puis cliquez <strong>Définir comme position de surveillance</strong> avant d'appliquer la configuration.
                              </p>
                            )}
                            <PtzControlPanel
                              cameraId={selectedCameraId}
                              ptzStep={props.ptzStep}
                              ptzGoToPreset={props.ptzGoToPreset}
                              configurePtzParking={props.configurePtzParking}
                            />
                          </>
                        )}
                      </section>
                    )}

                    {selectedCamera && selectedCameraId && (
                      <section className="camera-detail-section">
                        <h3>Mode vie privée</h3>
                        <div className="privacy-strategy-selector">
                          {(
                            [
                              { value: 'software' as const, label: 'Logiciel uniquement', desc: 'Enregistrement désactivé — la caméra reste accessible en dehors de Vyzio.', requiresPtz: false, requiresHw: false },
                              { value: 'ptz_parking' as const, label: 'Orientation vers zone neutre', desc: 'La caméra pivote vers un endroit non filmé et l\'enregistrement est désactivé.', requiresPtz: true, requiresHw: false },
                              { value: 'hardware' as const, label: 'Coupure matérielle', desc: 'Objectif masqué directement dans la caméra (Tapo uniquement).', requiresPtz: false, requiresHw: true },
                            ]
                          ).map(({ value, label, desc, requiresPtz, requiresHw }) => {
                            const disabled = (requiresPtz && !selectedCamera.ptzSupported) || (requiresHw && selectedCamera.vendorFamily !== 'tplink_tapo')
                            return (
                              <label key={value} className={`privacy-strategy-option${disabled ? ' opacity-50' : ''}`} style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
                                <input
                                  type="radio"
                                  name="privacyStrategy"
                                  value={value}
                                  checked={pendingStrategy === value}
                                  disabled={disabled}
                                  onChange={() => { setPendingStrategy(value); setStrategyFeedback(null) }}
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
                              <span>La caméra pivote vers une zone non sensible et l'enregistrement est désactivé dans Vyzio, mais elle reste physiquement accessible sur votre réseau local.</span>
                            </div>
                          )}

                          <button
                            type="button"
                            className="privacy-strategy-save-btn"
                            disabled={saveStrategyAction.loading || pendingStrategy === selectedCamera.privacyModeStrategy}
                            onClick={async () => {
                              if (!pendingStrategy) return
                              setStrategyFeedback(null)
                              await saveStrategyAction.run()
                            }}
                          >
                            {saveStrategyAction.loading ? 'Enregistrement...' : 'Enregistrer la stratégie'}
                          </button>

                          {strategyFeedback && (
                            <p className="ptz-feedback">{strategyFeedback}</p>
                          )}
                        </div>
                      </section>
                    )}

                    <section className="camera-detail-section">
                      <h3>Modifier</h3>
                      <div className="camera-form-grid compact">
                        <label>
                          <span>Nom</span>
                          <input
                            value={editForm.displayName}
                            onChange={(event) =>
                              updateEditForm({ displayName: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span>Host</span>
                          <input
                            value={editForm.host}
                            onChange={(event) => updateEditForm({ host: event.target.value })}
                          />
                        </label>
                        <label>
                          <span>Port</span>
                          <input
                            type="number"
                            value={editForm.port}
                            onChange={(event) =>
                              updateEditForm({ port: Number(event.target.value) || 554 })
                            }
                          />
                        </label>
                        {editForm.streamProtocol !== 'dvrip' ? (
                          <label>
                            <span>Chemin de flux</span>
                            <input
                              value={editForm.streamPath ?? ''}
                              onChange={(event) =>
                                updateEditForm({ streamPath: event.target.value || null })
                              }
                            />
                          </label>
                        ) : (
                          <label>
                            <span>Protocole</span>
                            <input value="Mode alternatif (ICSee / XMEye)" readOnly style={{ opacity: 0.6 }} />
                          </label>
                        )}
                        <label>
                          <span>Utilisateur</span>
                          <input
                            value={editForm.username ?? ''}
                            onChange={(event) =>
                              updateEditForm({ username: event.target.value || null })
                            }
                          />
                        </label>
                        <label>
                          <span>Nouveau mot de passe</span>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(event) => setEditPassword(event.target.value)}
                            placeholder="Laisser vide pour conserver"
                          />
                        </label>
                      </div>
                    </section>

                    {selectedCamera && (
                      <CapabilitySection camera={selectedCamera} offline={cameraOffline} onReload={camerasState.reload} />
                    )}

                    <DetectionConfigSection
                      labels={detectionLabels}
                      availableLabels={detectionAvailableLabels}
                      allLabels={allDetectionLabels}
                      loading={detectionConfigLoading}
                      continuousRecordingEnabled={detectionContinuousRecording}
                      onToggle={(value) =>
                        setDetectionLabels((prev) =>
                          prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value],
                        )
                      }
                      onToggleContinuousRecording={() => setDetectionContinuousRecording((v) => !v)}
                    />

                    {selectedCamera && selectedCameraId && (
                      <PrivacyScheduleSection
                        camera={selectedCamera}
                        cameraId={selectedCameraId}
                        allCameras={props.allCameras}
                        getSchedules={props.getPrivacySchedules}
                        createSchedule={props.createPrivacySchedule}
                        deleteSchedule={props.deletePrivacySchedule}
                      />
                    )}

                    <div className="camera-debug-stack">
                      {renderConfidenceDetails(matchedDiscoveryCandidate)}
                      {renderTechnicalDetails(
                        matchedDiscoveryCandidate,
                        selectedCamera?.host ?? null,
                      )}
                      <details className="camera-debug-details">
                        <summary>Etat technique</summary>
                        <div className="camera-debug-content">
                          <dl className="camera-summary-list debug">
                            <div>
                              <dt>Validation</dt>
                              <dd>
                                {formatValidationStateLabel(cameraStatusState.data.validationState)}
                              </dd>
                            </div>
                            <div>
                              <dt>Derniere verification</dt>
                              <dd>
                                {formatCameraCheck(cameraStatusState.data.lastReachabilityCheckAt)}
                              </dd>
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

                  <div className="panel-cta-row">
                    <button
                      className="primary-cta"
                      type="button"
                      onClick={handleUpdate}
                      disabled={actionLoading || !canUpdateConfiguredCamera}
                    >
                      Enregistrer
                    </button>
                    <button
                      className="secondary-cta"
                      type="button"
                      onClick={handleVerify}
                      disabled={
                        actionLoading || selectedCamera?.validationState === 'pending_removal'
                      }
                    >
                      Verifier la connexion
                    </button>
                    <button
                      className="danger-cta"
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={
                        actionLoading || selectedCamera?.validationState === 'pending_removal'
                      }
                    >
                      {selectedCamera?.validationState === 'pending_removal'
                        ? 'Suppression en attente'
                        : 'Supprimer'}
                    </button>
                  </div>

                  {detailMessage ? (
                    <p className="camera-inline-state success action-feedback">{detailMessage}</p>
                  ) : null}
                  {detailError ? (
                    <p className="camera-inline-state error action-feedback">{detailError}</p>
                  ) : null}
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

