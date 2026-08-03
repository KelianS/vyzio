import { useEffect, useReducer, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft, Radar } from 'lucide-react'
import { appErrorMessage } from '../../common/errors/AppError'
import { Button } from '../../common/ui/button'
import { cn } from '../../common/ui/utils'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { useToast } from '../../common/components/Toast'
import { usePresenter } from '../../common/presenter/usePresenter'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { SettingsList } from '../../common/settings/SettingsList'
import type { SettingDeclaration } from '../../common/settings/settingDeclaration'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { useSurveillanceRefresh } from '../Surveillance/useSurveillanceRefresh'
import { useVendorAssistance } from './useVendorAssistance'
import { resolveVendorLinkTarget } from './vendorLinks'
import {
  VENDOR_FAMILY_OPTIONS,
  formatVendorFamily,
  fromVendorChoice,
  toVendorChoice,
} from './vendorFamilies'
import { buildAddCameraPresenter } from './AddCamera.Presenter'
import { addCameraReducer } from './AddCamera.Reducer'
import { buildInitialAddCameraUido } from './AddCamera.Uido'

/** Signal de decouverte qui autorise la voie de secours (ADR-32). */
const DVRIP_SIGNAL = 'dvrip_port_detected'

/**
 * Ajouter une camera : **une tache**, donc une page (ADR-40).
 *
 * L'ecran hérité mettait la decouverte reseau au centre de la rubrique alors
 * qu'elle ne sert qu'une fois par camera, et exposait les trois etages du
 * pipeline de decouverte (identification, enrichissement, interpretation) comme
 * autant de titres : une carte du backend, utile a nous seuls. Ici l'ordre est
 * celui de la tache — trouver, renseigner, verifier, ajouter — et les faits
 * techniques attendent sous « Avance ».
 */
export function AddCameraView() {
  const { cameras: container } = useAppContainer()
  const { toast } = useToast()
  const navigate = useNavigate()
  const refreshSurveillance = useSurveillanceRefresh()
  const [uido, dispatch] = useReducer(addCameraReducer, undefined, buildInitialAddCameraUido)
  const presenter = usePresenter(buildAddCameraPresenter, { container, dispatch })
  const knownCameras = useRootStore((state) => state.cameras)

  const candidate =
    uido.selection.kind === 'candidate'
      ? (uido.discoveryResults[uido.selection.index] ?? null)
      : null

  // Une camera deja au catalogue n'est plus a ajouter : la reproposer inviterait
  // a creer un doublon.
  const unclaimed = uido.discoveryResults.filter(
    (entry) => !knownCameras.some((known) => known.host === entry.host),
  )

  useEffect(() => {
    if (uido.selection.kind === 'candidate' && !uido.discoveryResults[uido.selection.index]) {
      presenter.onSelectManualEntry()
    }
  }, [presenter, uido.discoveryResults, uido.selection])

  const vendorAssistance = useVendorAssistance(
    container.getVendorAssistance,
    uido.form.vendorFamily ?? null,
    uido.form.streamPath,
    uido.verification?.connected ?? false,
  )

  const busy = uido.discovering || uido.refreshing || uido.verifying || uido.creating

  // Sans flux joignable ni voie de secours, il n'y a rien a renseigner : la
  // camera doit d'abord etre ouverte depuis son application.
  const needsActivation = Boolean(candidate && !candidate.streamPath && !uido.dvripMode)
  const dvripAvailable = Boolean(
    candidate?.qualificationReasons.includes(DVRIP_SIGNAL) && !candidate.streamPath,
  )
  const showForm =
    uido.selection.kind === 'manual' || Boolean(candidate?.streamPath) || uido.dvripMode
  const canVerify =
    showForm &&
    !needsActivation &&
    Boolean(
      uido.form.displayName.trim() &&
      uido.form.host.trim() &&
      (uido.dvripMode || uido.form.streamPath?.trim()),
    )
  // En voie de secours la verification du brouillon ne s'applique pas : le flux
  // n'existe qu'une fois la camera ouverte par le protocole proprietaire.
  const canAdd = Boolean(uido.verification?.connected) || uido.dvripMode

  async function add() {
    const created = await presenter.onCreate(
      uido.dvripMode,
      Boolean(uido.verification?.connected),
      uido.form,
    )
    if (!created) return
    refreshSurveillance()
    toast(created.guidance ?? `« ${created.displayName} » ajoutée.`, 'success')
    void navigate(`/settings/cameras/${created.id}/detection`)
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
      id: 'add-port',
      label: 'Port',
      nature: { kind: 'number', unit: '', min: 1, max: 65535 },
      value: uido.form.port,
      onChange: (value) => presenter.onFormChanged({ port: value as number }),
    },
  ]

  if (!uido.dvripMode) {
    declarations.push({
      id: 'add-stream-path',
      label: 'Chemin du flux',
      nature: { kind: 'text', placeholder: '/stream1' },
      help: 'Vyzio le demande à la caméra quand elle sait répondre. Ne le renseignez que si elle n’a pas été reconnue.',
      value: uido.form.streamPath ?? '',
      onChange: (value) => presenter.onFormChanged({ streamPath: (value as string) || null }),
    })
  }

  declarations.push(
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
    {
      id: 'add-vendor',
      label: 'Marque',
      nature: { kind: 'choice', options: VENDOR_FAMILY_OPTIONS },
      help: 'Renseignée, elle donne accès aux réglages propres à cette marque. Vyzio la reconnaît seul la plupart du temps.',
      value: toVendorChoice(uido.form.vendorFamily),
      onChange: (value) =>
        presenter.onFormChanged({ vendorFamily: fromVendorChoice(value as string) }),
    },
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Cet ecran nomme une tache, pas la rubrique : le retour vers la liste
          lui revient donc aussi, sinon l'ajout serait sans issue sur petit
          ecran, ou le menu des rubriques est masque. */}
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

      <SettingsPage lede="Vyzio peut chercher les caméras de votre réseau, ou vous pouvez saisir l’adresse vous-même.">
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={busy}
            onClick={() => presenter.onConfirmScanSet(true)}
          >
            <Radar aria-hidden="true" />
            {uido.discovering ? 'Recherche…' : 'Rechercher sur le réseau'}
          </Button>

          <ul className="divide-y divide-border border-y border-border">
            {unclaimed.map((entry) => {
              const index = uido.discoveryResults.indexOf(entry)
              return (
                <CandidateRow
                  key={`${entry.host}-${entry.port}`}
                  candidate={entry}
                  selected={uido.selection.kind === 'candidate' && uido.selection.index === index}
                  onSelect={() => presenter.onSelectCandidate(index, entry)}
                />
              )
            })}

            <li>
              <SelectableRow
                selected={uido.selection.kind === 'manual'}
                onSelect={() => presenter.onSelectManualEntry()}
              >
                <span className="block font-medium">Saisir l’adresse moi-même</span>
                <span className="block text-sm text-muted-foreground">
                  Utile si la caméra ne répond pas à la recherche.
                </span>
              </SelectableRow>
            </li>
          </ul>
        </div>

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

        {dvripAvailable && (
          <SettingsSection title="Autre façon de la joindre">
            <SettingsList
              settings={[
                {
                  id: 'add-dvrip',
                  label: 'Mode de connexion alternatif',
                  nature: { kind: 'toggle' },
                  help: 'Pour les caméras ICSee, Annke, Sannce, Zosi et marques proches, dont le flux standard n’est pas toujours accessible. Sur batterie, réveillez la caméra depuis son application avant d’essayer.',
                  consequence:
                    'À n’activer que si la connexion standard ne fonctionne pas : Vyzio joint alors la caméra par son protocole propriétaire.',
                  value: uido.dvripMode,
                  onChange: (value) => presenter.onDvripModeToggle(value as boolean, candidate),
                },
              ]}
            />
          </SettingsSection>
        )}

        {showForm && (
          <SettingsSection title="Connexion" lede="Comment Vyzio joindra cette caméra.">
            <SettingsList settings={declarations} />

            {uido.message && <p className="mt-4 text-sm text-success">{uido.message}</p>}
            {uido.error && <p className="mt-4 text-sm text-destructive">{uido.error}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !canVerify}
                onClick={() => void presenter.onVerifyDraft(uido.form)}
              >
                {uido.verifying ? 'Vérification…' : 'Vérifier la connexion'}
              </Button>
              {/* L'ajout reste offert mais ferme tant que rien n'a repondu :
                  griser sans expliquer laisserait chercher ce qui manque. */}
              <Button type="button" disabled={busy || !canAdd} onClick={() => void add()}>
                {uido.creating ? 'Ajout…' : 'Ajouter la caméra'}
              </Button>
            </div>
          </SettingsSection>
        )}

        {(vendorAssistance.loading ||
          vendorAssistance.error ||
          vendorAssistance.data?.markdown) && (
          <SettingsSection
            title={`Notice ${formatVendorFamily(uido.form.vendorFamily ?? null) ?? 'du constructeur'}`}
          >
            {vendorAssistance.loading ? (
              <p className="text-muted-foreground">Chargement…</p>
            ) : vendorAssistance.error ? (
              <p className="text-destructive">{appErrorMessage(vendorAssistance.error)}</p>
            ) : (
              <VendorNotice markdown={vendorAssistance.data!.markdown} />
            )}
          </SettingsSection>
        )}

        {candidate && <TechnicalFacts candidate={candidate} />}
      </SettingsPage>

      {uido.confirmScan && (
        <ConfirmModal
          title="Rechercher les caméras du réseau ?"
          body="Vyzio interroge tous les appareils de votre réseau local. La recherche prend 15 à 30 secondes."
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

function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: DiscoveredCamera
  selected: boolean
  onSelect: () => void
}) {
  const title = candidate.technicalDetails?.resolvedHostName?.trim() || candidate.displayName
  const vendor = formatVendorFamily(candidate.vendorFamily)

  return (
    <li>
      <SelectableRow selected={selected} onSelect={onSelect}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-medium">{title}</span>
            <span className="block text-sm text-muted-foreground">
              {candidate.host}
              {vendor ? ` · ${vendor}` : ''}
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs',
              candidate.streamPath
                ? 'bg-success/15 text-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {candidate.streamPath ? 'Prête' : 'À préparer'}
          </span>
        </span>
      </SelectableRow>
    </li>
  )
}

function SelectableRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'w-full px-3 py-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected ? 'bg-muted' : 'hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Les faits bruts de la decouverte, sous le repli de fin de page. Ils ne servent
 * qu'a diagnostiquer un ajout qui resiste : les mettre dans le parcours ferait
 * lire un rapport reseau pour brancher une camera.
 */
function TechnicalFacts({ candidate }: { candidate: DiscoveredCamera }) {
  const details = candidate.technicalDetails
  const ports = details?.detectedPorts ?? []
  const paths = details?.rtspPathsDetected ?? []
  const capabilities = details?.capabilities ?? []

  if (!details?.resolvedHostName && !candidate.macAddress && !ports.length && !paths.length) {
    return null
  }

  const facts: [string, string][] = [
    ...(details?.resolvedHostName
      ? [['Nom réseau', details.resolvedHostName] as [string, string]]
      : []),
    ...(candidate.macAddress
      ? [['Adresse matérielle', candidate.macAddress] as [string, string]]
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
    <SettingsSection title="Avancé">
      <dl className="divide-y divide-border text-sm">
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-wrap justify-between gap-x-4 py-2">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  )
}

function VendorNotice({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2 text-sm [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:font-medium [&_ul]:list-disc">
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
