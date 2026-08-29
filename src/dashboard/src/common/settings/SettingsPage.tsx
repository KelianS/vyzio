import type { ReactNode } from 'react'

/**
 * Surface d'une page de reglages.
 *
 * **Elle ne porte pas de titre**, et c'est la regle : ce qui mene a la page l'a
 * deja nommee — l'onglet reste affiche juste au-dessus, l'entree de rubrique
 * reste surlignee a cote. Le repeter ajoutait un titre par palier, jusqu'a
 * coiffer un seul reglage de trois noms identiques.
 *
 * Le nom de la page est donc rendu **une fois**, par la coquille qui la contient
 * (`SettingsView`, ou l'en-tete de la camera).
 */
export function SettingsPage({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-card p-5 text-card-foreground shadow-[var(--shadow-soft)] sm:p-6">
      {lede && <p className="mb-5 text-sm text-muted-foreground">{lede}</p>}
      {children}
    </section>
  )
}

/**
 * Un groupe **a l'interieur** d'une page, quand celle-ci traite reellement
 * plusieurs sujets.
 *
 * Un titre de groupe se justifie s'il nomme autre chose que la page ; sinon
 * c'est la page qu'il faut ouvrir, pas un cadre qu'il faut ajouter. Il est rendu
 * plus discret qu'un titre de page, mais dans le **serif des titres** : c'est ce
 * qui l'empeche de ressembler au libelle d'un reglage, qui n'est jamais un titre.
 */
export function SettingsSection({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: ReactNode
}) {
  return (
    <section className="mt-8 border-t border-border pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-2xl">{title}</h2>
      {lede && <p className="mt-1 mb-4 text-sm text-muted-foreground">{lede}</p>}
      <div className={lede ? undefined : 'mt-4'}>{children}</div>
    </section>
  )
}
