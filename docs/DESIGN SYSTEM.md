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
- `--ink-soft: #606d67` : texte secondaire.
- `--line-soft: #d8cfbf` : bordures discretes.
- `--brand-moss: #2f6b59` : couleur produit principale.
- `--brand-sand: #d9b37a` : accent chaud pour la mise en avant.
- `--alert-high: #b04c30` : evenement prioritaire.
- `--alert-ok: #2d7a52` : etat sain.

Valeurs du theme clair ; le theme sombre (memes roles, valeurs propres) vit dans `src/index.css`,
seul foyer des deux themes.

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

Rayons (definis dans `src/index.css`, deux echelles distinctes — jamais confondues) :

| Token | Usage |
| --- | --- |
| `--radius`, `--radius-sm/md/lg/xl` | Elements **cliquables** (boutons, inputs, petites pastilles) — echelle Tailwind `rounded-*` |
| `--radius-inset`, `--radius-card`, `--radius-panel` | Surfaces **non cliquables** (cartes, panneaux, modales) |
| `999px` | pilule — **reservee** : liens de navigation + pastilles d'etat (voir regle plus bas) |

Valeurs exactes dans `src/index.css`, seul foyer — non recopiees ici pour ne pas driver a nouveau.

- Ombre douce : `0 18px 50px rgba(24, 32, 29, 0.08)`
- Espacement de section : `24px` a `32px`

### Regle de forme : pilule = etat, rectangle arrondi = action

Le rayon porte du sens et ne doit jamais etre choisi au hasard :

- **Pilule (`999px`)** → element **non cliquable** : pastille d'etat, badge, lien de navigation du header. Une pilule signale « statut / navigation », jamais « bouton d'action ».
- **Rectangle arrondi** (`--radius-sm`/`--radius`) → element **cliquable** : tout bouton d'action.

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

### Aide : trois niveaux, pas un manuel

Le mode d'emploi d'une feature vit **dans l'ecran qui la porte**, jamais dans un document a cote
([ADR-53](adr/0053-la-doc-utilisateur-vit-dans-l-interface-trois-niveaux-d-aide.md), foyer de la
regle). Trois profondeurs : ce qui est **visible** (libelle et cout d'un reglage), l'**infobulle**
d'un reglage, et le panneau repli **`En savoir plus`** d'une section.

La limite qui les separe se verifie : **une infobulle tient en deux phrases**. Ce qui deborde parle
de la tache et non du champ — cela descend dans le panneau de la section, en laissant dans
l'infobulle la phrase qui suffit. Un **cout** ne descend jamais : il reste visible sans un geste.

Le panneau est le composant `common/settings/HelpPanel`, jamais un `<details>` reecrit. Son
en-tete porte la **question** que le lecteur se pose (« Ou trouver ces informations ? ») plutot que
les mots « En savoir plus », qui ne disent pas ce qu'on y trouvera ; il ne s'ouvre de lui-meme que
la ou la tache qu'il explique n'est pas encore faite.

Un panneau `En savoir plus` n'est pas le repli `Avance`, qui est une position de fin de page pour
les reglages rares ([ADR-40](adr/0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md)) :
l'aide s'ouvre a cote de ce qu'elle explique.

### Style et theme

`App.css` (CSS global, classes nommees a la main) n'existe plus : un seul systeme de style, Tailwind
+ tokens ([ADR-42](adr/0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md)).
Aucune classe globale, aucune couleur ni rayon litteral dans un composant — toujours un token.

Le **theme sombre est supporte partout**. Chaque couleur employee etant un token qui porte ses deux
valeurs, un ecran sans version sombre est un ecran qui ecrit une couleur en dur.

Le responsive suit l'echelle de la bibliotheque, appliquee du petit ecran vers le grand. Un point de
rupture hors echelle est une exception a justifier.

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
  pas touchee. Ne jamais l'appeler `Appliquer` ni `Mettre en service` : le premier promet une prise
  d'effet qui n'a pas lieu, le second cache l'interruption derriere un terme de service generique.
- **`Annuler`** — verbe unique d'abandon, il rend la page a son dernier etat enregistre.
- Le brouillon annonce **ce qui a change**. Il n'annonce plus d'interruption : elle appartient au
  redemarrage.

| Ou | Texte |
| --- | --- |
| Declencheur | `Appliquer les changements` |
| Question | `Redemarrer la surveillance maintenant ?` |
| Corps | `Des reglages enregistres ne sont pas encore appliques. La surveillance s'interrompt quelques secondes.` |
| En cours | `Redemarrage…` |
| Echec | `Redemarrage echoue` — persistant, avec `Reessayer` |

Le declencheur nomme **l'etat en attente**, la question nomme **l'acte**. Ce n'est pas une nuance de
style : le declencheur survit a la session ou le reglage a ete enregistre, et se lit deux jours plus
tard sans que rien n'ait redemarre entre-temps. `Redemarrer` y annoncerait un acte deja fait ;
`Appliquer les changements` dit ce qui reste vrai tant qu'on n'a pas clique. L'interruption, elle,
n'est jamais tue : elle est enoncee au moment ou l'on decide.

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
- Jamais un mode d'emploi hors du produit, ni une aide qui paraphrase l'ecran : navigation, bouton
  grise, option absente se lisent deja a l'ecran (ADR-53).