import { useState } from 'react'
import { HelpPanel } from '../../common/components/HelpPanel'
import { ConfirmModal } from '../../common/components/ConfirmModal'
import { SettingsPage, SettingsSection } from '../../common/settings/SettingsPage'
import { Button } from '../../common/ui/button'
import { useAsyncAction } from '../../common/hooks/useAsyncAction'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'

/** Ce qu'on peut faire de son propre acces : le quitter ici, ou le retirer a tous les appareils (ADR-54). */
export function AccessPage() {
  const { access } = useAppContainer()
  const [confirming, setConfirming] = useState(false)

  // Se deconnecter fait disparaitre l'interface : c'est la porte qui se referme, pas un ecran a rafraichir.
  const leaving = useAsyncAction(async () => access.signOut.execute(), {
    onSuccess: () => window.location.reload(),
  })

  const leavingEverywhere = useAsyncAction(async () => access.signOutEverywhere.execute(), {
    onSuccess: () => window.location.reload(),
  })

  return (
    <SettingsPage lede="Qui peut ouvrir cette interface, et depuis quels appareils.">
      <SettingsSection
        title="Cet appareil"
        lede="Cet appareil reste connecté plusieurs semaines sans redemander le mot de passe. Le déconnecter ne change rien aux autres."
      >
        <Button variant="outline" disabled={leaving.loading} onClick={() => void leaving.run()}>
          Se déconnecter
        </Button>
      </SettingsSection>

      <SettingsSection
        title="Tous les appareils"
        lede="Referme toutes les sessions ouvertes, celle-ci comprise. Le mot de passe reste le même : chaque appareil devra le saisir à nouveau."
      >
        <Button
          variant="outline"
          disabled={leavingEverywhere.loading}
          onClick={() => setConfirming(true)}
        >
          Déconnecter tous les appareils
        </Button>

        <HelpPanel title="Quand faut-il déconnecter tous les appareils ?">
          <p>
            Quand un téléphone ou un ordinateur qui ouvrait Vyzio n’est plus entre vos mains :
            perdu, volé, revendu, ou simplement prêté. Tant qu’une session y reste ouverte, elle
            donne accès à vos caméras sans mot de passe.
          </p>
          <p>
            Si vous pensez que quelqu’un connaît votre mot de passe, cela ne suffit pas : il
            pourrait se reconnecter aussitôt. Changez-le d’abord — ce réglage arrivera ici.
          </p>
        </HelpPanel>
      </SettingsSection>

      {confirming && (
        <ConfirmModal
          title="Déconnecter tous les appareils ?"
          body="Vous devrez saisir votre mot de passe à nouveau, ici comme ailleurs."
          confirmLabel="Déconnecter"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false)
            await leavingEverywhere.run()
          }}
        />
      )}
    </SettingsPage>
  )
}
