# ADR-42 — Socle de composants d'interface : shadcn/ui sur Radix et Tailwind, tokens du design system en source unique

> Statut : Accepté

## Contexte

Le déclencheur documenté est un symptôme mineur : des `select` blancs sur blanc — fond translucide
posé sur une carte blanche — corrigés au cas par cas. Le problème est systémique : il n'existe ni
token de contraste, ni états focus/disabled cohérents, ni accessibilité garantie. Chaque correction
locale reproduit la cause.

L'état du front, mesuré :

- **4091 lignes de CSS global** dans un seul `App.css`, adressant les écrans par classes nommées à la
  main ;
- **quatre composants réellement partagés** — `Btn`, `Select`, `ConfirmModal`, `Toast` — tout le reste
  étant du JSX et des classes écrits sur place ;
- **six points de rupture responsive différents** (480, 640, 720, 860, 900, 1100 px), preuve que
  l'adaptation s'est faite écran par écran plutôt que par un système ;
- **aucune dépendance d'interface** : ni bibliothèque de composants, ni primitives accessibles.

Il faut noter que **shadcn/ui et Tailwind figurent déjà dans les choix techniques du
[SAD](../SAD.md) (annexe A)**, retenus pour l'accessibilité et la personnalisation sans designer. La
décision n'est donc pas nouvelle : elle n'a jamais été honorée, et le CSS global mesuré ci-dessus est
la forme qu'a prise cet écart. Le présent ADR la reprend, la motive et surtout **fixe les conditions
qui manquaient** — les deux étages de composants, la source unique des tokens et la fin bornée de la
cohabitation — faute desquelles l'adoption produirait un troisième système de style au lieu d'en
supprimer un.

Ce socle ne tient pas la charge qui arrive.
[ADR-40](0040-information-architecture-viewing-apart-from-configuring-two-level-settings-tree.md)
multiplie les écrans de formulaire et introduit des sections repliables, une navigation à deux
niveaux et un panneau mobile ;
[ADR-41](0041-settings-edit-cycle-an-explicit-draft-and-saving-means-applying.md) impose
un état de brouillon et une barre d'actions identique partout. Construire cela sur du CSS global et
quatre composants revient à écrire à la main — et à tester à la main — la gestion du focus, le
piégeage clavier des surfaces modales, les libellés d'assistance et le comportement tactile des
info-bulles. C'est précisément le travail qui n'a pas été fait jusqu'ici.

Le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) apporte en revanche deux acquis qu'aucune bibliothèque ne
fournira et qui doivent survivre intacts : la **palette chaude et domestique** (l'anti-NVR, intention
produit) et la **règle de forme** *pilule = état, rectangle arrondi = action*, qui porte du sens.

## Options comparées

1. **Adopter shadcn/ui** — primitives accessibles Radix, style Tailwind, composants **copiés dans le
   dépôt** plutôt qu'importés d'un paquet.
2. **Outiller la base maison** : extraire des primitives, ajouter des tokens de contraste et
   d'états, découper `App.css` en modules colocalisés. Écarté : ne traite pas la cause. Accessibilité,
   gestion du focus, navigation clavier et comportement des surfaces flottantes sur mobile restent
   entièrement à écrire et à tester. Rien n'indique que ce projet le ferait mieux la prochaine fois
   qu'il ne l'a fait jusqu'ici, et le volume à produire vient d'être multiplié par ADR-40.
3. **Primitives headless seules** (Radix, Base UI ou Ark) sans Tailwind : le comportement accessible
   vient de la bibliothèque, l'apparence reste en CSS Vyzio. Compromis honnête, écarté : on récupère
   la moitié difficile mais on garde la moitié volumineuse — tout l'habillage de chaque composant
   reste à écrire — et sans la discipline de tokens qui accompagne shadcn, le CSS global se
   reconstitue.

Le vrai axe de choix entre 1 et 3 est **« adopte-t-on Tailwind ? »**. La question est posée
franchement plutôt que dissimulée dans le choix d'une bibliothèque.

## Décision

**Option 1 : shadcn/ui, donc Radix et Tailwind.**

### Ce que Tailwind apporte ici, au-delà du style

Tailwind supprime la couche qui pose problème : les **noms de classes globaux**. Le style redevient
local au composant, et une règle ne peut plus fuir vers un écran qu'on n'avait pas en tête — ce qui
est exactement le mode de production des `select` blancs sur blanc.

Sa configuration se déclare **en CSS**, sous forme de variables de thème. Les tokens du DESIGN SYSTEM
(palette, rayons, ombres) deviennent donc **littéralement** le thème : une seule définition, lisible
comme CSS, consommée par les utilitaires. La règle *pilule = état, rectangle arrondi = action* devient
une contrainte de tokens plutôt qu'une consigne à respecter de mémoire.

### Les composants sont copiés, pas dépendus

shadcn/ui n'est pas un paquet mais un **générateur** : le code atterrit dans le dépôt, lisible et
modifiable. Deux conséquences retenues comme des propriétés, pas des effets de bord — aucun
enfermement dans une bibliothèque tierce, et la rethématisation sur la palette Vyzio se fait dans le
code du projet plutôt que contre les surcharges d'un paquet.

En contrepartie, ce code n'est **pas** du code Vyzio : il n'est pas soumis aux règles de rédaction du
projet et n'est pas maintenu à la main.

### Deux étages de composants, jamais confondus

- **Primitives** — le code shadcn/ui copié. Modifiées **uniquement** pour le thème ; jamais pour
  loger une règle métier. Elles vivent dans un dossier dédié, distinct du reste.
- **Composants Vyzio** — construits *au-dessus* des primitives, ils portent le vocabulaire du produit
  (un champ de réglage avec sa provenance et son retour arrière, une ligne de réglage, une section
  repliable, la barre de brouillon d'ADR-41). C'est là que vit la valeur ajoutée, et c'est là que
  s'applique la discipline de code du projet.

Cette frontière est la condition pour que la mise à jour d'une primitive reste sans risque. La
franchir — mettre une règle Vyzio dans une primitive — reproduirait l'enchevêtrement corrigé ici.

### Les tokens ont un seul foyer

Le DESIGN SYSTEM reste la **source** des couleurs, rayons et ombres, et le thème Tailwind en est la
*réalisation*. Aucune valeur littérale de couleur ou de rayon n'est écrite dans un composant : elle
passe par un token. C'est ce qui rend un défaut de contraste corrigeable en un point plutôt qu'écran
par écran.

### Un seul système de style à l'arrivée : `App.css` disparaît

Deux systèmes de style qui cohabitent sans échéance ne sont pas une transition, ce sont trois
systèmes — l'ancien, le nouveau, et la frontière entre les deux qu'il faut arbitrer à chaque écran.
**La migration va donc jusqu'au bout : `App.css` est supprimé, pas réduit.**

Deux règles pendant la reprise :

- **aucune règle nouvelle n'est ajoutée à `App.css`** ; tout écran nouveau ou repris est en Tailwind ;
- **un écran repris emporte la suppression de ses règles**, si bien que le fichier décroît de façon
  monotone. Sa taille est l'indicateur d'avancement du chantier, et sa disparition en est la
  condition de fin.

**Conséquence assumée sur le périmètre** : `App.css` habille les six écrans, pas seulement ceux de
réglages. Aller au bout emporte donc la reprise des écrans de **consultation** — accueil, historique,
profils — qui ne relèvent pas de la refonte de configuration. Le chantier est plus large que son
déclencheur ; c'est le prix d'un socle unique, et le nier reviendrait à planifier la cohabitation
qu'on vient d'écarter.

**Attention à la distinction** : ce qui disparaît, ce sont les **classes globales**. Les tokens, eux,
restent en CSS — c'est le format natif de la configuration de thème, pas un reliquat.

### Le responsive devient systématique

Les six points de rupture ad hoc sont remplacés par l'échelle de la bibliothèque, appliquée depuis le
petit écran vers le grand, conformément au mobile-first posé par ADR-40. Un point de rupture hors
échelle devient une exception à justifier, pas un réflexe.

## Conséquences

- **Trois dépendances entrent** dans un front qui n'en avait aucune côté interface : Tailwind, Radix
  (via les primitives copiées) et l'outillage shadcn. Seule Tailwind est une dépendance de build
  permanente ; les primitives sont du code du dépôt.
- **Le DESIGN SYSTEM est réécrit** autour des tokens et des deux étages de composants. Il cesse de
  décrire quatre composants maison pour décrire un système ; palette et règle de forme y survivent
  inchangées.
- **`App.css` devient un solde à liquider**, dont la décroissance est l'indicateur de progression de
  la refonte et la disparition la condition de fin. Le chantier englobe de ce fait les écrans de
  consultation, au-delà de son déclencheur.
- **Le pattern d'écran ne change pas.** La Clean Architecture du front, le découpage 5 fichiers et la
  pipeline d'erreurs (`src/dashboard/CLAUDE.md`) sont orthogonaux à cette décision : elle porte sur
  la couche de rendu, pas sur l'orchestration. Le dossier des primitives s'ajoute sous `common`, qui
  reste importable de partout.
- **Les tests d'interface gagnent en stabilité** : les composants Radix exposent des rôles ARIA
  corrects, donc les sélecteurs par rôle — déjà la convention des tests Vitest et Playwright du
  projet — deviennent fiables au lieu de dépendre de classes CSS.
- **Le thème sombre est supporté, et il l'est partout.** Les cinq requêtes `prefers-color-scheme`
  actuelles sont un début non systématique ; passer par les tokens le rend systématique par
  construction, puisque chaque couleur employée est un token qui a ses deux valeurs. Un écran qui
  n'aurait pas de version sombre serait donc un écran qui écrit une couleur en dur — c'est-à-dire une
  violation de la règle ci-dessus, détectable comme telle plutôt que constatée à l'œil.
- **Cette décision se livre avec ADR-40 et ADR-41.** Elles partagent un déclencheur et se
  neutralisent séparément : une arborescence propre remplie de formulaires incohérents, ou des
  composants impeccables dans une navigation qui n'a pas de place pour eux, ne règlent rien.
