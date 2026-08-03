# Dashboard Design System

## Intention

Le Hub Vyzio doit paraitre rassurant, lisible et domestique, sans reprendre l'esthetique d'un outil NVR expert.

Le design MVP repose sur une interface claire, lumineuse et calme, avec une hierarchie visuelle simple :

- un etat systeme visible immediatement ;
- des evenements recents lisibles en un coup d'oeil ;
- des actions principales explicites ;
- un acces avance vers Frigate, present mais secondaire.

## Palette MVP

- `--bg-canvas: #f4efe6` : fond principal chaud, non clinique.
- `--bg-elevated: #fffaf2` : surfaces principales.
- `--bg-strong: #1f3a33` : panneaux fonces structurants.
- `--ink-strong: #18201d` : texte principal.
- `--ink-soft: #53605b` : texte secondaire.
- `--line-soft: #d8cfbf` : bordures discretes.
- `--brand-moss: #2f6b59` : couleur produit principale.
- `--brand-sand: #d9b37a` : accent chaud pour la mise en avant.
- `--alert-high: #c65c3d` : evenement prioritaire.
- `--alert-ok: #2d7a52` : etat sain.

## Regles d'usage

- Les surfaces critiques utilisent `--bg-elevated` pour garder un contraste doux.
- La couleur `--brand-moss` porte les CTA et les indicateurs produit.
- La couleur `--alert-high` est reservee aux evenements importants et aux statuts d'attention.
- L'acces avance Frigate doit rester visible, mais jamais presenter comme le parcours principal.

## Typographie

**L'echelle est celle de Tailwind, sans surcharge de taille racine** (base 16px). La base 18px
d'origine ecrasait l'echelle : `text-sm` valait 14px face a un corps de 18, soit un ecart trop faible
pour separer deux niveaux d'information — il fallait alors compenser dans chaque composant.

Deux niveaux se distinguent par **trois signaux a la fois** — taille, graisse et couleur. Un seul ne
suffit pas : c'est ce qui rendait un titre de rubrique et son resume quasi indistincts.

| Role | Classe |
| --- | --- |
| Titre de page | `font-serif text-3xl` |
| Titre de rubrique / section | `font-serif text-2xl` |
| Libelle de reglage, entree de liste | `font-medium` (16px) |
| Texte secondaire, resume, aide | `text-sm text-muted-foreground` |

Le serif (`--heading`) est reserve aux titres ; il porte le caractere domestique de l'interface.

## Tokens d'interface

Rayons (definis dans `src/index.css`) :

| Token | Valeur | Usage |
| --- | --- | --- |
| `--radius-xl` | `28px` | Grandes surfaces / modales pleines |
| `--radius-lg` | `24px` | Cartes, panneaux, header |
| `--radius-md` | `18px` | Sous-cartes, encarts |
| `--radius-sm` | `8px` | Petits controles (boutons `.btn`, inputs, petites pastilles) |
| `--radius-btn` | `12px` | Gros CTA (`min-height: 46px`) |
| `999px` | pilule | **Reserve** : liens de navigation + pastilles d'etat (voir regle plus bas) |

- Ombre douce : `0 18px 50px rgba(24, 32, 29, 0.08)`
- Espacement de section : `24px` a `32px`

### Regle de forme : pilule = etat, rectangle arrondi = action

Le rayon porte du sens et ne doit jamais etre choisi au hasard :

- **Pilule (`999px`)** → element **non cliquable** : pastille d'etat, badge, lien de navigation du header. Une pilule signale « statut / navigation », jamais « bouton d'action ».
- **Rectangle arrondi (`8px` / `12px`)** → element **cliquable** : tout bouton d'action.

C'est ce contraste qui permet a l'utilisateur de distinguer d'un coup d'oeil une pastille « Connectee » (etat) d'un bouton « Enregistrer » (action). Ne jamais donner un `box-shadow` surelevee ni une bordure marquee a une pastille d'etat : cela la fait ressembler a un bouton.

## Socle de composants

Deux etages, jamais confondus
([ADR-42](adr/0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md)) :

| Etage | Ce que c'est | Regle |
| --- | --- | --- |
| **Primitives** | Code shadcn/ui copie dans le depot (accessibilite, focus, clavier) | Modifiees **uniquement** pour le theme. Jamais de regle metier dedans. Pas du code Vyzio : hors discipline de redaction du projet. |
| **Composants Vyzio** | Batis **au-dessus** des primitives, ils portent le vocabulaire produit (champ de reglage et sa provenance, ligne de reglage, section repliable, barre de brouillon) | C'est la que vit la valeur ajoutee, et la que s'applique la discipline de code du projet. |

Franchir la frontiere — loger une regle Vyzio dans une primitive — reproduit l'enchevetrement que ce
socle corrige, et rend toute mise a jour de primitive risquee.

**Les tokens ci-dessus sont la source ; le theme Tailwind en est la realisation.** Aucune valeur
litterale de couleur, de rayon ou d'ombre n'est ecrite dans un composant : elle passe par un token.
C'est ce qui rend un defaut de contraste corrigeable en un point plutot qu'ecran par ecran.

### Ecrans de reglages

Un reglage **se declare, il ne se dessine pas** : sa nature determine son controle, son alignement,
sa provenance et son retour arriere. La table des controles et l'anatomie de la ligne de reglage sont
fixees par [ADR-43](adr/0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md) —
foyer unique, non recopie ici. Dessiner un reglage a la main est une exception a justifier.

Une page **ne se nomme pas elle-meme** : ce qui y mene l'a deja nommee
([ADR-40](adr/0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md)).
Concretement, `SettingsPage` est une surface **sans titre** ; `SettingsSection` n'ouvre un titre a
l'interieur d'une page que si celle-ci traite plusieurs sujets, et ce titre nomme alors autre chose
que la page. Un titre de section qui repete celui de la page signale qu'il fallait une page de plus.

### Regles de transition

`App.css` est **supprime**, pas reduit : deux systemes de style sans echeance en font trois. La
migration va jusqu'au bout, ecrans de consultation compris.

- **aucune regle nouvelle dans `App.css`** — tout ecran nouveau ou repris est en Tailwind ;
- **un ecran repris emporte la suppression de ses regles**, donc `App.css` decroit de facon monotone ;
  sa taille est l'indicateur d'avancement, sa disparition la condition de fin.

Ce qui disparait, ce sont les **classes globales**. Les tokens restent en CSS : c'est le format natif
de la configuration de theme, pas un reliquat.

Le **theme sombre est supporte partout**. Chaque couleur employee etant un token qui porte ses deux
valeurs, un ecran sans version sombre est un ecran qui ecrit une couleur en dur.

Le responsive suit l'echelle de la bibliotheque, appliquee du petit ecran vers le grand. Un point de
rupture hors echelle est une exception a justifier.

## Composants de la base historique

Ces quatre primitives maison restent **la reference pour tout ecran non encore migre** ; elles sont
remplacees ecran par ecran par le socle ci-dessus. Sur un ecran non migre, **toujours les reutiliser**
plutot que recreer un `<button>` ou un `<select>` avec des classes ad hoc.

### 1. Bouton — `<Btn>` (`src/common/components/Btn.tsx`)

Composant unique pour toutes les actions inline. Etend `ButtonHTMLAttributes` (donc `onClick`, `disabled`, `title`, `type`, `style`… passent directement).

```tsx
import { Btn } from './Btn'

<Btn variant="primary" size="md" loading={saving} onClick={handleSave}>
  Enregistrer
</Btn>
```

Props :

- `variant` (defaut `secondary`) : `primary | secondary | ghost | danger-outline | danger`
- `size` (defaut `sm`) : `sm` (28px) | `md` (34px)
- `loading` : affiche `…` et desactive le bouton
- `type` : `button` par defaut (mettre `type="submit"` dans un formulaire)

Regles de choix du **variant** :

| Variant | Quand l'utiliser |
| --- | --- |
| `primary` | Action principale d'un ecran/formulaire (vert plein). **Une seule par groupe.** |
| `secondary` | Action neutre courante (Verifier, Rafraichir, Tester…). |
| `ghost` | Action tertiaire / discrete (Annuler, Modifier, toggle). |
| `danger-outline` | Action destructrice **reversible ou de premier niveau** (Desactiver, Supprimer le canal). Rouge contour. |
| `danger` | Confirmation destructrice **finale**, typiquement dans une modale (rouge plein). |

Regles de **taille** : `sm` pour les actions dans une liste / barre d'outils / ligne de tableau ; `md` pour les CTA de formulaire et les actions de modale.

**A ne pas faire** : ne pas reintroduire les anciennes classes `.primary-cta` / `.secondary-cta` / `.danger-cta` / `.capability-btn` pour de nouveaux boutons. Elles subsistent uniquement pour les gros CTA pleine largeur et les liens `<a>` de navigation (Hub, Expert).

### 2. Pastille d'etat (CSS, pas de composant)

Indicateur **non cliquable** signalant un etat vivant (connexion, sante, actif/inactif). Toujours une **pilule** avec un **point de couleur en tete** (ajoute via `::before`, teinte = `currentColor`).

```tsx
<span className={`status-pill ${connected ? 'online' : 'warning'}`}>
  {connected ? 'Connectée' : 'Hors ligne'}
</span>

<span className={`capability-status-badge capability-status-badge--${on ? 'on' : 'off'}`}>
  {on ? 'Actif' : 'Inactif'}
</span>
```

Classes disponibles :

- `.status-pill` + `.online | .loading | .warning | .degraded` — etat systeme / camera.
- `.capability-status-badge` + `--on | --off` — capacite activee/desactivee (`pointer-events: none`).

Regles :

- Une pastille d'etat **n'est jamais un bouton**. Si l'utilisateur doit agir, mettre un `<Btn>` **a cote**, pas transformer la pastille en action (cf. le duo statut « Actif » + bouton « Desactiver » dans `CapabilitySection`).
- Reserver le point + pilule aux **etats** (on/off/sante). Les **libelles descriptifs** (protocole « ONVIF », qualification « Confirme », « Oui/Non ») restent des badges plats sans point (`.camera-support-badge`, `.camera-qualification-badge`, `.camera-rtsp-badge`).
- Semantique couleur : vert = sain (`online`/`on`), ambre = attention (`warning`/`loading`), rouge = degrade (`degraded`).

### 3. Modale de validation — `<ConfirmModal>` (`src/common/components/ConfirmModal.tsx`)

A utiliser pour **toute action destructrice ou difficilement reversible** (suppression, desactivation, application en masse). Gere deja le focus trap, `Escape`, `Tab` et l'etat de chargement d'un `onConfirm` asynchrone.

```tsx
{confirmOpen && (
  <ConfirmModal
    title="Désactiver le PTZ ?"
    body="Le panneau de contrôle sera masqué. La configuration reste sauvegardée."
    confirmLabel="Désactiver"
    tone="danger"
    onConfirm={async () => { await disable(); setConfirmOpen(false) }}
    onCancel={() => setConfirmOpen(false)}
  />
)}
```

Props : `title`, `body`, `confirmLabel`, `cancelLabel` (defaut `Annuler`), `tone` (`default | confirm | warn | danger`), `onConfirm`, `onCancel`, `loading`.

Le `tone` mappe automatiquement le variant du bouton de confirmation :

| `tone` | Bouton de confirmation | Quand |
| --- | --- | --- |
| `default` | `secondary` | Confirmation neutre (peu de risque). |
| `confirm` | `primary` (vert plein) | Validation positive, pas destructrice (ex. lancer une action). |
| `warn` | `danger-outline` | Action sensible mais reversible. |
| `danger` | `danger` (rouge plein) | Suppression / action irreversible. |

Regles :

- **Quand ouvrir une modale** : action irreversible, action en masse (plusieurs cameras/profils), ou perte de donnees. Pour une action simple et reversible, un `<Btn>` direct suffit — ne pas sur-solliciter la confirmation.
- Le bouton d'annulation est toujours `ghost` ; il ne doit jamais attirer l'oeil autant que la confirmation.
- Le `onConfirm` peut etre `async` : la modale gere seule l'etat « Traitement… ».

### 4. Selection — `<Select>` (`src/common/components/Select.tsx`)

Wrapper fin sur `<select>` natif : etend `SelectHTMLAttributes` (donc `value`, `onChange`, `disabled`… passent directement), applique juste le style commun.

```tsx
import { Select } from './Select'

<Select size="md" value={vendor} onChange={(e) => setVendor(e.target.value)}>
  <option value="">Detection automatique</option>
  <option value="v380_pro">V380 Pro</option>
</Select>
```

Props : `size` (defaut `md`) : `sm | md` — mêmes hauteurs que `<Btn>`, pour aligner select et bouton sur une même ligne.

Regle : ne jamais styler un `<select>` brut avec des classes ad hoc — passer par `<Select>`, même pour un usage ponctuel.

## Vocabulaire UX

Foyer unique des mots d'interface. Un meme geste porte **partout** le meme mot ; c'est ce qui permet
a l'utilisateur d'apprendre l'interface une fois.

### Navigation

Un libelle dit la **nature** de l'ecran — consulter ou regler — jamais l'audience visee
([ADR-40](adr/0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md)).

- Consulter : `Accueil`, `Direct`, `Historique`.
- Regler : `Reglages`, puis une rubrique (`Cameras`, `Detection`, `Conservation`, `Notifications`, `Systeme`).
- Le repli de fin de page se dit `Avance`. Ce n'est pas un mode a activer : c'est une position.
- Proscrits comme entree de navigation : `Expert` (nomme une audience, pas un contenu), et `Alertes`
  pour designer un ecran de reglages — le mot promet une liste d'evenements, que l'utilisateur
  trouve sous `Historique`.

### Cycle d'edition

Un reglage s'enregistre ; la surveillance se redemarre a part
([ADR-41](adr/0041-cycle-d-edition-des-reglages-brouillon-explicite-enregistrer-vaut-appliquer.md),
[ADR-44](adr/0044-redemarrage-de-la-surveillance-acte-explicite-groupe-et-differe.md)).

- **`Enregistrer`** — verbe unique de validation. Il persiste, et rien de plus : la surveillance n'est
  pas touchee. Ne jamais employer `Appliquer`, ni `Mettre en service` : un terme de service generique
  cache l'interruption au lieu de la dire.
- **`Annuler`** — verbe unique d'abandon, il rend la page a son dernier etat enregistre.
- Le brouillon annonce **ce qui a change**. Il n'annonce plus d'interruption : elle appartient au
  redemarrage.

| Ou | Texte |
| --- | --- |
| Declencheur | `Redemarrer la surveillance` |
| Question | `Redemarrer la surveillance maintenant ?` |
| Corps | `Des reglages enregistres ne sont pas encore appliques. La surveillance s'interrompt quelques secondes.` |
| Echec | `Redemarrage echoue` — persistant, avec `Reessayer` |

Le declencheur **n'apparait que s'il y a quelque chose a reprendre** : sa presence est le message,
son absence une information positive. On ne nomme pas la rubrique en attente — une categorie de notre
arborescence n'apprend rien a qui vient de regler une valeur.

Regle sous-jacente, valable au-dela de ce cas : **on ne nomme pas la technique, mais on nomme toujours
l'effet.** Le principe produit #2 interdit de prononcer le nom du moteur, pas de dire ce qui se passe.

- L'echec du redemarrage se dit en termes de **panne**, pas d'etape restante.

### Interdits transverses

- Jamais `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR`, ni le nom du moteur de detection,
  dans le parcours nominal (principe produit #2).
- Jamais un etat opaque sans justification lisible (principe #4).