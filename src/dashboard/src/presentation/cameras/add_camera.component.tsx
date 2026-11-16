import { useEffect, useReducer, useRef, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate, useSearchParams } from 'react-router'
import { Keyboard, LoaderCircle, Radar, RotateCw, Video } from 'lucide-react'
import { PageHeader } from '../../common/components/page_header'
import { TechnicalDetails } from '../../common/components/technical_details'
import { ReadFailure } from '../../common/components/error_message'
import { Button } from '../../common/ui/button'
import { SecondaryButton } from '../../common/components/secondary_button'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { GroupedList, GroupedRow } from '../../common/components/grouped_list'
import { HelpNotes, HelpQuestion } from '../../common/components/help_notes'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { SettingsList } from '../../common/settings/settings_list'
import type { SettingDeclaration } from '../../common/settings/setting_declaration'
import { useAppContainer } from '../../infrastructure/providers/app_container.context'
import { useRootStore } from '../../infrastructure/store/root.store'
import {
  DiscoveryRangeSource,
  type DiscoveredCamera,
} from '../../domain/entities/discovered_camera.entity'
import { resolveVendorLinkTarget } from './vendor_links'
import { formatVendorFamily, helpVendorOptions, NO_HELP_VENDOR } from './vendor_families'
import { buildAddCameraPresenter } from './add_camera.presenter'
import { addCameraReducer } from './add_camera.reducer'
import { buildInitialAddCameraUido, type AddCameraUido } from './add_camera.uido'
import { Loading } from '../../common/components/loading'

/** What to prepare in a camera app whatever its brand: the help when no vendor sheet is chosen. */
const OTHER_BRAND_HELP =
  'Ouvrez l’application de la caméra et créez-y un compte pour Vyzio. Si elle propose la vidéo locale (RTSP), activez-la.'

/** The second step lives in the address, so the bar's back button returns to the first (CAM-62). */
const STEP_PARAM = 'step'
const ACCESS_STEP = 'access'

const PAGE_TITLE = 'Ajouter une caméra'

/** Adding a camera is two simple steps (CAM-62): find it, then give its access and add it; its page sets the rest (ADR-04). */
export function AddCameraView() {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [uido, dispatch] = useReducer(addCameraReducer, undefined, buildInitialAddCameraUido)
  const presenter = usePresenter(buildAddCameraPresenter, {
    container,
    dispatch,
    toast,
  })
  const knownCameras = useRootStore((state) => state.cameras)

  const candidate =
    uido.selection.kind === 'candidate'
      ? (uido.discoveryResults[uido.selection.index] ?? null)
      : null

  // Already-catalogued cameras are dropped to avoid re-adding a duplicate.
  const unclaimed = uido.discoveryResults.filter(
    (entry) => !knownCameras.some((known) => known.host === entry.host),
  )

  useEffect(() => {
    // Chosen candidate vanished from a fresh scan: clear rather than keep a stale form.
    if (uido.selection.kind === 'candidate' && !uido.discoveryResults[uido.selection.index]) {
      presenter.onClearSelection()
    }
  }, [presenter, uido.discoveryResults, uido.selection])

  // The address leads: back from the second step clears the choice, a reload on it starts over.
  const onAccessStep = searchParams.get(STEP_PARAM) === ACCESS_STEP
  const chosen = uido.selection.kind !== 'none'
  const wasOnAccessStep = useRef(onAccessStep)
  useEffect(() => {
    if (wasOnAccessStep.current && !onAccessStep) presenter.onClearSelection()
    wasOnAccessStep.current = onAccessStep
  }, [presenter, onAccessStep])
  const openedOnAccessStep = useRef(onAccessStep)
  useEffect(() => {
    if (openedOnAccessStep.current) void navigate({ search: '' }, { replace: true })
  }, [navigate])

  function toAccessStep() {
    void navigate({ search: `?${STEP_PARAM}=${ACCESS_STEP}` })
  }

  const busy = uido.discovering || uido.refreshing || uido.creating

  // No protocol serves the stream yet: the camera must be opened from its app first.
  const needsActivation = Boolean(candidate && !candidate.stream)
  // A ready camera needs no preparing, so only the other two ways in offer the help list.
  const offersHelpList = needsActivation || uido.selection.kind === 'manual'
  // The vendor only picks the help sheet; it is never handed to the camera (#274).
  const vendorFamily = offersHelpList ? uido.helpVendor : null
  useEffect(() => {
    void presenter.onVendorAssistanceNeeded(vendorFamily)
  }, [presenter, vendorFamily])

  if (!chosen || !onAccessStep)
    return (
      <>
        <PageHeader title={PAGE_TITLE} />
        <SettingsPage>
          <GroupedList
            label="Sur votre réseau"
            labelAside={
              uido.discovering && (
                <LoaderCircle
                  role="img"
                  aria-label="Recherche en cours"
                  className="size-3.5 animate-spin"
                />
              )
            }
          >
            {unclaimed.map((entry) => {
              const index = uido.discoveryResults.indexOf(entry)
              return (
                <GroupedRow
                  key={`${entry.host}-${entry.port}`}
                  icon={Video}
                  title={candidateTitle(entry)}
                  // A ready camera is the nominal case: only one to prepare says so (UI-31).
                  subtitle={
                    entry.stream ? candidateDetail(entry) : `${candidateDetail(entry)} · À préparer`
                  }
                  trailing="none"
                  onClick={() => {
                    presenter.onSelectCandidate(index, entry)
                    toAccessStep()
                  }}
                />
              )
            })}
            <GroupedRow
              icon={Radar}
              title={uido.discovering ? 'Recherche…' : 'Rechercher sur le réseau'}
              weight="action"
              trailing="none"
              disabled={busy}
              onClick={() => void presenter.onSearchAsked()}
            />
          </GroupedList>

          <GroupedList label="Elle n’apparaît pas ?">
            <GroupedRow
              icon={Keyboard}
              title="Saisir son adresse"
              weight="action"
              trailing="none"
              disabled={busy}
              onClick={() => {
                presenter.onSelectManualEntry()
                toAccessStep()
              }}
            />
          </GroupedList>

          <HelpNotes>
            <HelpQuestion title="Elle n’apparaît pas, que vérifier ?">
              <p>
                Vyzio ne parcourt que les plages d’adresses que sa confirmation annonce, et beaucoup
                de caméras ne répondent qu’une fois réveillées depuis leur propre application : une
                caméra sur batterie doit être réveillée avant de répondre.
              </p>
              <p>
                Sinon, prenez « Saisir son adresse » : son adresse sur le réseau, que l’application
                de la caméra ou votre box indiquent. Une fois la caméra ajoutée, sa page cherche
                comment la joindre et dit ce qui répond.
              </p>
            </HelpQuestion>
          </HelpNotes>
        </SettingsPage>

        {uido.confirmScan && (
          <ConfirmModal
            title="Rechercher les caméras du réseau ?"
            body={searchWarning(uido.rangesToSweep)}
            details={
              <RangesToSweep
                rangesToSweep={uido.rangesToSweep}
                onRetry={() => void presenter.onSearchAsked()}
              />
            }
            confirmLabel="Rechercher"
            onConfirm={async () => {
              presenter.onConfirmScanSet(false)
              await presenter.onDiscover()
            }}
            onCancel={() => presenter.onConfirmScanSet(false)}
          />
        )}
      </>
    )

  const canAdd = Boolean(uido.form.displayName.trim() && uido.form.host.trim())

  async function add() {
    const createdId = await presenter.onCreate(uido.form)
    if (createdId) void navigate(`/settings/cameras/${createdId}`, { replace: true })
  }

  const declarations: SettingDeclaration[] = [
    {
      id: 'add-name',
      label: 'Nom',
      nature: { kind: 'text', placeholder: 'Porte d’entrée' },
      value: uido.form.displayName,
      onChange: (value) => presenter.onFormChanged({ displayName: value as string }),
    },
    // A found camera brings its address: only a typed one asks for it.
    ...(uido.selection.kind === 'manual'
      ? [
          {
            id: 'add-host',
            label: 'Adresse',
            nature: { kind: 'text', placeholder: '192.168.1.50', keyboard: 'address' },
            help: 'L’adresse de la caméra sur votre réseau local.',
            value: uido.form.host,
            onChange: (value) => presenter.onFormChanged({ host: value as string }),
          } satisfies SettingDeclaration,
        ]
      : []),
    {
      id: 'add-username',
      label: 'Identifiant de la caméra',
      nature: { kind: 'text', keyboard: 'identifier' },
      value: uido.form.username ?? '',
      onChange: (value) => presenter.onFormChanged({ username: (value as string) || null }),
    },
    {
      id: 'add-password',
      label: 'Mot de passe de la caméra',
      nature: { kind: 'secret' },
      value: uido.form.password ?? '',
      onChange: (value) => presenter.onFormChanged({ password: (value as string) || null }),
    },
  ]

  const helpChoice: SettingDeclaration = {
    id: 'add-help-vendor',
    label: 'Marque',
    nature: { kind: 'choice', options: helpVendorOptions },
    value: vendorFamily ?? NO_HELP_VENDOR,
    onChange: (value) =>
      presenter.onHelpVendorChosen(value === NO_HELP_VENDOR ? null : (value as string)),
  }

  const vendorHelp = (
    <>
      <SettingsList settings={[helpChoice]} />
      {vendorFamily === null ? (
        <p className="mx-1 text-body">{OTHER_BRAND_HELP}</p>
      ) : uido.vendorAssistance.loading ? (
        <Loading />
      ) : uido.vendorAssistance.error ? (
        <ReadFailure
          error={uido.vendorAssistance.error}
          onRetry={() => void presenter.onVendorAssistanceNeeded(vendorFamily)}
        />
      ) : uido.vendorAssistance.markdown ? (
        <VendorNotice markdown={uido.vendorAssistance.markdown} />
      ) : null}
    </>
  )

  return (
    <>
      <PageHeader title={candidate ? candidateTitle(candidate) : PAGE_TITLE} />
      <SettingsPage>
        {needsActivation ? (
          <>
            <SettingsSection
              title="Cette caméra n’est pas encore joignable"
              lede="Ouvrez-la depuis son application, puis revenez ici. Le formulaire apparaîtra dès qu’elle répondra."
            >
              <div>
                <SecondaryButton
                  icon={RotateCw}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    candidate &&
                    uido.selection.kind === 'candidate' &&
                    void presenter.onRefreshCandidate(uido.selection.index, candidate)
                  }
                >
                  {uido.refreshing ? 'Vérification…' : 'Réessayer maintenant'}
                </SecondaryButton>
              </div>
            </SettingsSection>
            <SettingsSection
              title="Aide de votre caméra"
              lede="Choisissez sa marque pour savoir quoi préparer dans son application. Ce choix sert seulement à afficher l’aide."
            >
              {vendorHelp}
            </SettingsSection>
          </>
        ) : (
          <>
            <SettingsList settings={declarations} />

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={busy || !canAdd}
              onClick={() => void add()}
            >
              {uido.creating ? 'Ajout…' : 'Ajouter'}
            </Button>

            <HelpNotes>
              <HelpQuestion title="Où trouver ces identifiants">
                {offersHelpList ? (
                  <div className="flex flex-col gap-3 text-foreground">{vendorHelp}</div>
                ) : (
                  <p>{OTHER_BRAND_HELP}</p>
                )}
              </HelpQuestion>
            </HelpNotes>
          </>
        )}

        {candidate && <TechnicalFacts candidate={candidate} />}
      </SettingsPage>
    </>
  )
}

/** A found camera by what identifies it: its network name, else what discovery calls it. */
function candidateTitle(candidate: DiscoveredCamera): string {
  return candidate.technicalDetails?.resolvedHostName?.trim() || candidate.displayName
}

/** The address, then the vendor as text, only when discovery recognised it (#274). */
function candidateDetail(candidate: DiscoveredCamera): string {
  return [candidate.host, formatVendorFamily(candidate.vendorFamily)].filter(Boolean).join(' · ')
}

const RANGE_SOURCE_LABELS: Record<DiscoveryRangeSource, string> = {
  [DiscoveryRangeSource.Configured]: 'plage configurée par défaut',
  [DiscoveryRangeSource.DashboardAddress]: 'autour de l’adresse utilisée pour ouvrir Vyzio',
}

/** What the search confirmation names: every range it will sweep, with where each comes from (ADR-05). */
function RangesToSweep({
  rangesToSweep,
  onRetry,
}: {
  rangesToSweep: AddCameraUido['rangesToSweep']
  onRetry: () => void
}) {
  if (rangesToSweep.loading)
    return <p className="text-body text-muted-foreground">Lecture des adresses à parcourir…</p>
  if (rangesToSweep.error) return <ReadFailure error={rangesToSweep.error} onRetry={onRetry} />
  if (rangesToSweep.ranges.length === 0) return null
  return (
    <ul className="list-disc pl-5 text-left text-body">
      {rangesToSweep.ranges.map((range) => (
        <li key={range.cidr}>
          {range.firstAddress} à {range.lastAddress} · {RANGE_SOURCE_LABELS[range.source]}
        </li>
      ))}
    </ul>
  )
}

/** The confirmation's sentence: a warning over the ranges once read, or how to get some when there are none. */
function searchWarning(rangesToSweep: AddCameraUido['rangesToSweep']): string {
  if (rangesToSweep.loading || rangesToSweep.error)
    return 'Vyzio va interroger les adresses de votre réseau local pour y chercher des caméras. La recherche prend 15 à 30 secondes.'
  if (rangesToSweep.ranges.length === 0)
    return 'Aucune plage d’adresses n’est à parcourir : ouvrez Vyzio avec son adresse sur votre réseau (par exemple 192.168.1.10), ou saisissez l’adresse de la caméra.'
  return 'Vyzio va interroger chaque adresse de ces plages pour y chercher des caméras. La recherche prend 15 à 30 secondes.'
}

/** Raw discovery facts for support (UI-02): only useful to diagnose a stuck add. */
function TechnicalFacts({ candidate }: { candidate: DiscoveredCamera }) {
  const details = candidate.technicalDetails
  const ports = details?.detectedPorts ?? []
  const paths = details?.rtspPathsDetected ?? []
  const capabilities = details?.capabilities ?? []

  if (!details?.resolvedHostName && !ports.length && !paths.length) {
    return null
  }

  const facts: [string, string][] = [
    ...(details?.resolvedHostName
      ? [['Nom réseau', details.resolvedHostName] as [string, string]]
      : []),
    ...(paths.length ? [['Flux détectés', paths.join(', ')] as [string, string]] : []),
    ...(ports.length
      ? [
          ['Ports ouverts', ports.map((port) => `${port.port} (${port.label})`).join(', ')] as [
            string,
            string,
          ],
        ]
      : []),
    ...capabilities.map(
      (capability) => [capability.label, capability.protocolLabels.join(', ')] as [string, string],
    ),
  ]

  return (
    <TechnicalDetails>
      <dl className="divide-y divide-border text-body">
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-wrap justify-between gap-x-4 py-2">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </TechnicalDetails>
  )
}

function VendorNotice({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2 text-body wrap-anywhere [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-medium [&_ul]:list-disc">
      <ReactMarkdown
        components={{
          a({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
            const target = resolveVendorLinkTarget(href)
            return (
              <a
                {...props}
                href={target?.href ?? href}
                target="_blank"
                rel="noreferrer noopener"
                download={target?.download || undefined}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
