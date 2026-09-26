import { RotateCw } from 'lucide-react'
import { Button } from '../../../common/ui/button'
import { cn } from '../../../common/ui/utils'
import { ConfirmModal } from '../../../common/components/confirm_modal'
import { Badge } from '../../../common/components/badge'
import type {
  ChannelListening,
  ChannelPairing,
} from '../../../domain/entities/notification_channel_config.entity'

const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const formatTime = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' })

/**
 * Which conversation may command this installation — started here and nowhere else, because the
 * settings are the only place Vyzio knows it is really the owner talking (ADR-50).
 */
export function ChannelPairingSection({
  displayName,
  pairing,
  pairingLoading,
  listening,
  listeningLoading,
  starting,
  confirmRevoke,
  revoking,
  onStart,
  onAskRevoke,
  onCancelRevoke,
  onRevoke,
  onRefresh,
}: {
  displayName: string
  pairing: ChannelPairing | null
  pairingLoading: boolean
  listening: ChannelListening | null
  listeningLoading: boolean
  starting: boolean
  confirmRevoke: boolean
  revoking: boolean
  onStart: () => void
  onAskRevoke: () => void
  onCancelRevoke: () => void
  onRevoke: () => void
  onRefresh: () => void
}) {
  if (pairingLoading && !pairing) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>
  }

  const status = pairing?.status ?? 'not_paired'

  return (
    <>
      <div className="flex flex-col gap-4">
        {listening && <ListeningStatus state={listening} />}

        {status === 'awaiting_conversation' ? (
          <AwaitingConversation pairing={pairing!} displayName={displayName} />
        ) : (
          <p className="text-sm text-muted-foreground">{describe(status, pairing)}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {status === 'paired' ? (
            <Button type="button" variant="destructive" onClick={onAskRevoke}>
              Couper le lien
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={starting} onClick={onStart}>
              {status === 'awaiting_conversation'
                ? 'Générer un autre code'
                : 'Relier une conversation'}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pairingLoading || listeningLoading}
            onClick={onRefresh}
          >
            <RotateCw
              className={cn((pairingLoading || listeningLoading) && 'animate-spin')}
              aria-hidden="true"
            />
            Actualiser
          </Button>
        </div>
      </div>

      {confirmRevoke && (
        <ConfirmModal
          title="Couper le lien avec cette conversation ?"
          body="Elle ne pourra plus rien demander à votre installation. Les alertes, elles, continuent d’arriver."
          confirmLabel="Couper le lien"
          tone="danger"
          loading={revoking}
          onConfirm={onRevoke}
          onCancel={onCancelRevoke}
        />
      )}
    </>
  )
}

/**
 * The state of the loop, where it happens (principle #4): a linked conversation proves nothing,
 * it is the listening that falls when the network falls (ADR-52).
 */
function ListeningStatus({ state }: { state: ChannelListening }) {
  if (state.listening) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge tone="ok">À l’écoute</Badge>
        {state.since && (
          <span className="text-sm text-muted-foreground">
            Depuis le {formatDate.format(new Date(state.since))} à{' '}
            {formatTime.format(new Date(state.since))}.
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge tone="danger">N’écoute plus</Badge>
        {state.interruptedAt && (
          <span className="text-sm text-muted-foreground">
            Depuis le {formatDate.format(new Date(state.interruptedAt))} à{' '}
            {formatTime.format(new Date(state.interruptedAt))}.
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {state.reason
          ? // The failure is said in the channel's own words: paraphrasing loses the only clue we have.
            `Vos commandes restent sans réponse jusqu’à ce qu’elle reprenne — Vyzio réessaie tout seul. Raison signalée : ${state.reason}`
          : 'Le canal doit être activé et enregistré pour répondre à vos commandes.'}
      </p>
    </div>
  )
}

function AwaitingConversation({
  pairing,
  displayName,
}: {
  pairing: ChannelPairing
  displayName: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Dans {displayName}, ouvrez la conversation qui doit commander votre installation et
        envoyez-lui&nbsp;:
      </p>
      <p className="font-mono text-2xl tracking-widest">{pairing.instruction}</p>
      {pairing.codeExpiresAt && (
        <p className="text-sm text-muted-foreground">
          Ce code est valable jusqu’à {formatTime.format(new Date(pairing.codeExpiresAt))}. Passé ce
          délai, générez-en un autre.
        </p>
      )}
    </div>
  )
}

/** One sentence per state; a stranger's message is never mentioned because it never gets an answer. */
function describe(status: ChannelPairing['status'], pairing: ChannelPairing | null): string {
  switch (status) {
    case 'not_paired':
      // Without this sentence, silence in the face of a command passes for a failure.
      return 'Aucune conversation ne peut commander votre installation : tant qu’aucune n’est reliée, une commande envoyée au bot reste sans réponse. Reliez-en une pour lui parler.'
    case 'expired':
      return 'Le code précédent a expiré sans être utilisé : tant qu’aucune conversation n’est reliée, une commande reste sans réponse.'
    case 'paired':
      return pairing?.pairedAt
        ? `Une conversation est reliée depuis le ${formatDate.format(new Date(pairing.pairedAt))}.`
        : 'Une conversation est reliée.'
    case 'awaiting_conversation':
      return 'Un code est en attente.'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
