import { HelpPanel } from '../settings/HelpPanel'

/**
 * The same two questions on both retention screens (ADR-53) -- installation-wide and per camera --
 * because the answers are the same and would drift if written twice.
 */
export function RetentionHelp() {
  return (
    <>
      <HelpPanel title="Pourquoi la vidéo complète est-elle livrée à zéro ?">
        <p>
          C’est la seule des trois dont le coût grandit avec le temps qui passe plutôt qu’avec ce
          qui se produit : une semaine sur quatre caméras dépasse les 50 Go. Les séquences de
          mouvement couvrent le besoin courant — retrouver ce qui s’est passé — pour une fraction de
          cette place.
        </p>
        <p>
          Activez-la sur une caméra précise si vous voulez pouvoir remonter le temps sans dépendre
          de ce que Vyzio a jugé être un mouvement.
        </p>
      </HelpPanel>

      <HelpPanel title="Quand la place est-elle vraiment libérée ?">
        <p>
          Pas dans la seconde. La surveillance reprend les nouvelles durées quelques secondes après
          l’enregistrement, mais le ménage se fait ensuite par passes : comptez jusqu’à une heure
          avant que le disque s’allège d’une durée raccourcie.
        </p>
        <p>
          Raccourcir l’historique en sort aussi les détections plus anciennes, aperçu et vidéo
          compris. Si vous ne voulez rien conserver d’une caméra, désactivez-la : c’est le seul
          geste qui arrête aussi sa détection.
        </p>
      </HelpPanel>
    </>
  )
}
