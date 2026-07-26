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

## Composants UI

Quatre primitives partagees couvrent la quasi-totalite des besoins. **Toujours les reutiliser** plutot que recreer un `<button>` ou un `<select>` avec des classes ad hoc.

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

## Vocabulaire UX MVP

- Dire `Hub`, `Evenements`, `Profils`, `Alertes`, `Mode avance`.
- Eviter `MQTT`, `broker`, `frigate events`, `sub_label`, `NVR` dans le parcours nominal.