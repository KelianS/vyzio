import { useEffect, useReducer, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft, Keyboard, Radar } from 'lucide-react'
import { DiagnosticLine, ErrorMessage } from '../../common/components/error_message'
import { Badge } from '../../common/components/badge'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { ConfirmModal } from '../../common/components/confirm_modal'
import { useToast } from '../../common/components/toast'
import { usePresenter } from '../../common/presenter/use_presenter'
import { SettingsPage, SettingsSection } from '../../common/settings/settings_page'
import { HelpPanel } from '../../common/components/help_panel'
import { AdvancedFold } from '../../common/settings/advanced_fold'
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

/** What to prepare in a camera app whatever its brand: the help when no vendor sheet is chosen. */
const OTHER_BRAND_HELP =
  'Ouvrez l’application de la caméra et créez-y un compte pour Vyzio. Si elle propose la vidéo locale (RTSP), activez-la.'

/** Adding a camera is one task, one page (ADR-40): find it, give its access, add it; its page sets the rest (ADR-68). */
export function AddCameraView() {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
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

  const busy = uido.discovering || uido.refreshing || uido.creating

  // One-line summary of step 1's pick, shown once the list collapses.
  const chosen = candidate
    ? {
        title: candidate.technicalDetails?.resolvedHostName?.trim() || candidate.displayName,
        detail: candidateDetail(candidate),
      }
    : uido.selection.kind === 'manual'
      ? { title: 'Adresse saisie à la main', detail: uido.form.host || 'Adresse à renseigner' }
      : null

  // No protocol serves the stream yet: the camera must be opened from its app first.
  const needsActivation = Boolean(candidate && !candidate.stream)
  const showForm = uido.selection.kind === 'manual' || Boolean(candidate?.stream)
  // A ready camera needs no preparing, so only the other two ways in offer the help list.
  const offersHelpList = needsActivation || uido.selection.kind === 'manual'
  // The vendor only picks the help sheet; it is never handed to the camera (#274).
  const vendorFamily = offersHelpList ? uido.helpVendor : null
  useEffect(() => {
    void presenter.onVendorAssistanceNeeded(vendorFamily)
  }, [presenter, vendorFamily])
  const vendorAssistance = uido.vendorAssistance
  const canAdd = Boolean(uido.form.displayName.trim() && uido.form.host.trim())

  async function add() {
    const createdId = await presenter.onCreate(uido.form)
    if (createdId) void navigate(`/settings/cameras/${createdId}`)
  }

  const declarations: SettingDeclaration[] = [
    {
      id: 'add-name',
      label: 'Nom',
      nature: { kind: 'text', placeholder: 'Porte d’entrée' },
      value: uido.form.displayName,
      onChange: (value) => presenter.onFormChanged({ displayName: value as string }),
    },
    {
      id: 'add-host',
      label: 'Adresse',
      nature: { kind: 'text', placeholder: '192.168.1.50' },
      help: 'L’adresse de la caméra sur votre réseau local.',
      value: uido.form.host,
      onChange: (value) => presenter.onFormChanged({ host: value as string }),
    },
    {
      id: 'add-username',
      label: 'Identifiant',
      nature: { kind: 'text' },
      value: uido.form.username ?? '',
      onChange: (value) => presenter.onFormChanged({ username: (value as string) || null }),
    },
    {
      id: 'add-password',
      label: 'Mot de passe',
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

  return (
    <div className="flex flex-col gap-4">
      {/* Own back link: this route names a task, not the rubric, and owns its exit on mobile. */}
      <div>
        <Link
          to="/settings/cameras"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Caméras
        </Link>
        <h1 className="mt-1 font-serif text-3xl">Ajouter une caméra</h1>
      </div>

      <SettingsPage lede="Deux étapes : désigner la caméra, puis lui donner de quoi se connecter.">
        <SettingsSection
          title="Quelle caméra ?"
          lede={
            chosen
              ? undefined
              : 'Vyzio peut la chercher sur votre réseau, ou vous pouvez saisir son adresse.'
          }
        >
          {/* Une fois la camera designee, la liste se replie : sur un ecran de
              telephone elle repoussait la configuration hors de vue, si bien
              qu'un clic ne semblait rien faire. Elle reste a un geste. */}
          {chosen ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium">{chosen.title}</span>
                <span className="block text-sm text-muted-foreground">{chosen.detail}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={presenter.onClearSelection}
              >
                Changer
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Deux facons d'en designer une, donc deux boutons de meme
                  nature. La saisie manuelle trainait au bas de la liste des
                  resultats, ou elle se lisait comme une camera trouvee. */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void presenter.onSearchAsked()}
                >
                  <Radar aria-hidden="true" />
                  {uido.discovering ? 'Recherche…' : 'Rechercher sur le réseau'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => presenter.onSelectManualEntry()}
                >
                  <Keyboard aria-hidden="true" />
                  Saisir l’adresse moi-même
                </Button>
              </div>

              <Feedback message={uido.message} error={uido.error} />

              {/* La liste ne contient plus que ce que la recherche a trouve. */}
              {unclaimed.length > 0 && (
                <ul className="divide-y divide-border border-y border-border">
                  {unclaimed.map((entry) => {
                    const index = uido.discoveryResults.indexOf(entry)
                    return (
                      <CandidateRow
                        key={`${entry.host}-${entry.port}`}
                        candidate={entry}
                        onSelect={() => presenter.onSelectCandidate(index, entry)}
                      />
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <HelpPanel title="La recherche ne trouve pas ma caméra ?">
            <p>
              C’est fréquent et ce n’est pas une panne : Vyzio ne parcourt que les plages d’adresses
              que sa confirmation annonce, et beaucoup de caméras ne répondent qu’une fois
              réveillées depuis leur propre application. Prenez alors{' '}
              <em>Saisir l’adresse moi-même</em> : son adresse sur le réseau, que l’application de
              la caméra ou votre box indiquent.
            </p>
            <p>
              Une fois la caméra ajoutée, sa page cherche comment la joindre et dit ce qui répond.
              Une caméra sur batterie doit être réveillée avant de répondre.
            </p>
          </HelpPanel>
        </SettingsSection>

        {needsActivation && (
          <SettingsSection
            title="Cette caméra n’est pas encore joignable"
            lede="Ouvrez-la depuis son application, puis revenez ici. Le formulaire apparaîtra dès qu’elle répondra."
          >
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                candidate &&
                uido.selection.kind === 'candidate' &&
                void presenter.onRefreshCandidate(uido.selection.index, candidate)
              }
            >
              {uido.refreshing ? 'Vérification…' : 'Réessayer maintenant'}
            </Button>
          </SettingsSection>
        )}

        {showForm && (
          <SettingsSection
            title="Connexion"
            lede="Son nom, son adresse et son compte : Vyzio trouve le reste une fois la caméra ajoutée."
          >
            <SettingsList settings={declarations} />

            <div className="mt-4">
              <Feedback message={uido.message} error={uido.error} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !canAdd} onClick={() => void add()}>
                {uido.creating ? 'Ajout…' : 'Ajouter la caméra'}
              </Button>
            </div>
          </SettingsSection>
        )}

        {/* Last, so a user who already prepared the camera never scrolls past it. */}
        {offersHelpList && (
          <SettingsSection
            title="Aide de votre caméra"
            lede="Choisissez sa marque pour savoir quoi préparer dans son application. Ce choix sert seulement à afficher l’aide."
          >
            <SettingsList settings={[helpChoice]} />
            <div className="mt-4">
              {vendorFamily === null ? (
                <p className="text-sm">{OTHER_BRAND_HELP}</p>
              ) : vendorAssistance.loading ? (
                <p className="text-muted-foreground">Chargement…</p>
              ) : vendorAssistance.error ? (
                <ErrorMessage error={vendorAssistance.error} className="text-base" />
              ) : vendorAssistance.markdown ? (
                <VendorNotice markdown={vendorAssistance.markdown} />
              ) : null}
            </div>
          </SettingsSection>
        )}
        {candidate && <TechnicalFacts candidate={candidate} />}
      </SettingsPage>

      {uido.confirmScan && (
        <ConfirmModal
          title="Rechercher les caméras du réseau ?"
          body={searchWarning(uido.rangesToSweep)}
          details={<RangesToSweep rangesToSweep={uido.rangesToSweep} />}
          confirmLabel="Rechercher"
          tone="confirm"
          onConfirm={async () => {
            presenter.onConfirmScanSet(false)
            await presenter.onDiscover()
          }}
          onCancel={() => presenter.onConfirmScanSet(false)}
        />
      )}
    </div>
  )
}

/** The address, then the vendor as text, only when discovery recognised it (#274). */
function candidateDetail(candidate: DiscoveredCamera): string {
  return [candidate.host, formatVendorFamily(candidate.vendorFamily)].filter(Boolean).join(' · ')
}

function CandidateRow({
  candidate,
  onSelect,
}: {
  candidate: DiscoveredCamera
  onSelect: () => void
}) {
  const title = candidate.technicalDetails?.resolvedHostName?.trim() || candidate.displayName

  return (
    <li>
      <SelectableRow onSelect={onSelect}>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{candidateDetail(candidate)}</span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={candidate.stream ? 'ok' : 'warn'}>
            {candidate.stream ? 'Prête' : 'À préparer'}
          </Badge>
        </span>
      </SelectableRow>
    </li>
  )
}

const RANGE_SOURCE_LABELS: Record<DiscoveryRangeSource, string> = {
  [DiscoveryRangeSource.Configured]: 'plage configurée par défaut',
  [DiscoveryRangeSource.DashboardAddress]: 'autour de l’adresse utilisée pour ouvrir Vyzio',
}

/** What the search confirmation names: every range it will sweep, with where each comes from (ADR-71). */
function RangesToSweep({ rangesToSweep }: { rangesToSweep: AddCameraUido['rangesToSweep'] }) {
  if (rangesToSweep.loading)
    return <p className="text-sm text-muted-foreground">Lecture des adresses à parcourir…</p>
  if (rangesToSweep.error)
    return (
      <div className="text-sm text-destructive">
        <p>{rangesToSweep.error.message}</p>
        {rangesToSweep.error.diagnostic && <DiagnosticLine text={rangesToSweep.error.diagnostic} />}
      </div>
    )
  if (rangesToSweep.ranges.length === 0) return null
  return (
    <ul className="list-disc pl-5 text-left text-sm">
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

/** Last action's outcome: success or failure, never both. */
function Feedback({ message, error }: { message: string | null; error: AddCameraUido['error'] }) {
  if (error)
    return (
      <div role="alert" className="text-sm text-destructive">
        <p>{error.message}</p>
        {error.diagnostic && <DiagnosticLine text={error.diagnostic} />}
      </div>
    )
  if (message) return <p className="text-sm text-success">{message}</p>
  return null
}

function SelectableRow({ onSelect, children }: { onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full px-3 py-3 text-left transition-colors hover:bg-muted/60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      {children}
    </button>
  )
}

/** Raw discovery facts, kept under the closing fold: only useful to diagnose a stuck add. */
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
    <AdvancedFold>
      <dl className="divide-y divide-border text-sm">
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-wrap justify-between gap-x-4 py-2">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </AdvancedFold>
  )
}

function VendorNotice({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2 text-sm wrap-anywhere [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-medium [&_ul]:list-disc">
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
