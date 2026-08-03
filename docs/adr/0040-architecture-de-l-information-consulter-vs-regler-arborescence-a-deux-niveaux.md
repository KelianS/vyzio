# ADR-40 — Architecture de l'information : séparer consulter et régler, arborescence de réglages à deux niveaux

> Statut : Accepté

## Contexte

La barre de navigation compte six entrées de même rang qui mélangent trois natures d'écran sans
que rien ne les distingue : **consulter** (Accueil, Historique), **configurer** (Caméras, Profils,
Alertes) et **s'échapper vers l'outil technique** (Expert). Le libellé ne dit pas dans laquelle on
entre — « Alertes » est un écran de réglages dont le nom promet une liste d'événements, que
l'utilisateur trouvera en réalité sous « Historique ».

Deux défauts structurels en découlent.

**Il n'existe aucun endroit dont la fonction soit « régler l'installation ».** Quand
[ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md) a produit le
premier réglage à cette portée, il n'y avait pas de case où le mettre : il a atterri dans la barre
latérale de l'écran Caméras, entre « Saisie manuelle » et la liste des candidats découverts.
Renommer l'écran « Paramètres » n'a fait que déplacer l'incohérence — c'est désormais une page
« Paramètres » dont la fonction principale est d'ajouter des caméras.

**La navigation n'a qu'un seul niveau, donc aucune place libre.** Tout réglage nouveau doit s'inviter
dans un écran existant, quel que soit son rapport avec lui. Le nombre de réglages va croître
fortement — modèle d'inférence, seuil d'alerte stockage, seuil d'alerte CPU sont déjà au backlog — et
à structure constante chaque ajout aggrave mécaniquement le désordre.

S'y ajoute que l'écran « Expert » expose l'interface Frigate en iframe plein écran, avec son nom dans
les messages d'erreur, depuis la barre de navigation principale. C'est en contradiction directe avec
le principe produit #2 (*Frigate invisible et temporaire*), et ce n'est pas une dette
d'implémentation : c'est un écran assumé.

La contrainte de conception est le paradoxe central du produit : une configuration **extrêmement
simple pour un utilisateur non-technicien** (principe #1) sans renoncer aux **réglages de niche** qui
couvrent les besoins réels et évitent la friction d'un système opaque (principe #4). Les deux échecs
symétriques sont une interface qui cache tout et frustre, et une interface qui montre tout et
ressemble à un NVR.

Étude préalable et inventaire chiffré :
[`investigations/socle-configuration-navigation.md`](../investigations/socle-configuration-navigation.md).

## Options comparées

### Sur la structure de navigation

1. **Séparer consulter et régler, avec une arborescence de réglages à deux niveaux.** La barre
   principale ne porte que la consultation et l'action quotidienne ; une entrée unique « Réglages »
   ouvre une liste de rubriques, chaque rubrique une page. C'est le modèle des réglages d'iOS et
   d'Android, et celui de Frigate.
2. **La caméra au centre.** L'entité principale reste la caméra ; les réglages d'installation
   deviennent une entrée « Toutes les caméras » en tête de la liste. Écarté : c'est la structure
   actuelle mieux nommée. Les réglages qui ne sont pas *par caméra* — notifications, stockage,
   ressources système, modèle d'inférence — n'ont toujours pas de domicile ; les ranger sous
   « Toutes les caméras » serait faux, les laisser dehors reproduit la dispersion. Traite le symptôme,
   pas la cause.
3. **Navigation par intention** (« Surveiller », « Être prévenu », « Retrouver »). Séduisant pour la
   première prise en main et le plus proche du principe #1, mais écarté : les intentions ne se
   subdivisent pas proprement. La conservation sert *Retrouver* et coûte du disque à *Mon
   installation* ; « changer le mot de passe d'une caméra » ne relève d'aucune. Chaque réglage
   nouveau rouvrirait le débat — exactement ce que cette décision cherche à supprimer. Et
   l'utilisateur qui revient cherche un objet (« ma caméra du jardin »), pas une intention.

### Sur la manière de tenir le paradoxe simple / niche

4. **Une section « Avancé » repliée en bas de chaque page.** La progressivité est locale, toujours au
   même endroit, sans état à mémoriser.
5. **Deux paliers explicites** (interrupteur *Simple / Avancé* global). Écarté : l'état est global
   mais invisible depuis la page où il agit ; l'utilisateur cherche un réglage qui « a disparu », et
   le produit doit alors expliquer son propre mode d'emploi.
6. **Rien**, tout à plat, ordonné par fréquence. Écarté : tenable tant que les pages sont courtes, et
   elles ne le resteront pas — c'est l'hypothèse même qui motive cet ADR.

## Décision

**Options 1 et 4.**

### La barre principale porte la consultation, pas le réglage

Elle contient ce qu'on regarde et ce qu'on fait tous les jours, plus **une** entrée de réglages. Un
écran qui sert à regarder n'est jamais un écran qui sert à régler, et réciproquement ; c'est la règle
qui arbitre toute entrée future.

### Les réglages forment un arbre à deux niveaux

Le premier niveau est une liste de **rubriques**, le second les **pages** de chaque rubrique. Un
réglage nouveau se range dans une rubrique existante ou en crée une : la question « il va où ? » a
désormais une réponse mécanique, ce qui était l'objet principal de cette décision.

Les rubriques sont organisées **par domaine fonctionnel** (ce que le réglage gouverne), jamais par
portée (installation ou caméra) ni par écran d'origine. La portée est traitée juste en dessous.

```
Accueil · Historique                              Réglages
                                                   ├── Caméras ─────────┬── (découverte / ajout)
                                                   │                    └── <caméra> ──┬── Détection
                                                   │                                   ├── Conservation
                                                   │                                   ├── Vie privée
                                                   │                                   ├── Image & PTZ
                                                   │                                   └── Connexion
                                                   ├── Détection ───────┬── Objets suivis, sensibilité
                                                   │                    └── Personnes connues (profils)
                                                   ├── Conservation ────── Durées d'installation
                                                   ├── Notifications ───── Canaux, format, horaires
                                                   └── Système ─────────┬── Stockage, ressources
                                                                        └── Avancé (dont interface technique)
```

La barre principale liste les écrans de consultation existants ; elle s'ouvre à d'autres si le besoin
apparaît, mais **jamais à un réglage** — c'est la contrainte que pose cette décision.

Les rubriques *Détection* et *Conservation* portent les valeurs d'installation ; leurs jumelles sous
une caméra portent les surcharges. C'est la lecture littérale du modèle d'ADR-39.

### La portée est une position dans l'arbre

[ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md) a posé qu'un
réglage a une valeur d'installation qu'une caméra peut surcharger. La navigation rend ce modèle
visible plutôt que de le laisser deviner : **une rubrique de réglages d'installation et la page
correspondante d'une caméra ont la même forme et le même contenu, à un cran de profondeur d'écart.**
Régler une caméra, c'est ouvrir le même écran un niveau plus bas.

C'est ce qui donne enfin un domicile au réglage introduit par ADR-39, et c'est ce qui rend l'ajout du
prochain réglage surchargeable sans décision d'architecture.

### Les caméras sont une rubrique, pas un écran à part

La découverte, l'ajout et la fiche d'une caméra vivent dans la rubrique Caméras. Découvrir et régler
restent deux tâches distinctes à l'intérieur de la rubrique — les confondre est le défaut d'origine.

### Les profils sont rangés au plus près de la détection

Ce sont des objets métier, pas des valeurs, et les ranger sous « Réglages » est discutable. Ils y
vont quand même, **au plus près des réglages de détection de personnes et de visages** dont ils sont
le prolongement direct : un profil ne sert qu'à nommer ce que la détection a trouvé. Les séparer
obligerait l'utilisateur à comprendre pourquoi « qui est reconnu » et « ce qu'on reconnaît » vivent à
deux endroits.

### L'interface Frigate devient un recours, plus une destination

Elle quitte la barre principale pour la section avancée des réglages système. Elle reste atteignable
— la retirer priverait d'un recours réel en cas de problème — mais cesse d'être un parcours de
premier rang, ce qui aligne la navigation sur le principe #2.

### Le niche est mis en profondeur, pas caché

Chaque page présente d'abord le courant ; le reste vit dans une **section « Avancé » repliée en bas
de page**. C'est aussi ce qui définit où atterrit un réglage rare, donc ce qui empêche les pages de
regrossir.

**La profondeur est le seul mécanisme de progressivité retenu.** Rien n'est retiré à l'utilisateur
avancé et aucun réglage n'est conditionné à un mode : c'est l'ordre de rencontre qui change, pas la
disponibilité. Un réglage qu'on ne peut atteindre sans avoir compris un mode contredirait le principe
#4 autant que l'absence du réglage.

### La structure naît du petit écran

Le [SAD](../SAD.md) §2.2 compte déjà une UI grand public **mobile-first** dans la valeur ajoutée de
Vyzio ; c'est SPECS §7.2 qui est en
retrait, avec un attendu limité à des actions « faisables sur mobile et desktop ». L'écart se répare
donc du côté des SPECS, pas en révisant l'ambition.

L'arborescence est conçue pour le mobile d'abord : liste → sous-liste → page, **un seul niveau
visible à la fois**, et le grand écran développe cette structure au lieu qu'elle s'y replie. C'est ce
qui rend la décision tenable pour la cible réelle du produit, et cela change l'attendu des SPECS
§7.2, aujourd'hui limité à des actions « faisables sur mobile et desktop ».

### Une page est nommée une seule fois

Un arbre pose un nom à chaque palier, et chaque palier est tenté de le redire : l'onglet « Vie
privée », puis le cadre « Vie privée », puis la section héritée du même nom — trois titres
identiques pour un unique réglage, et une page qui paraît plus profonde qu'elle n'est.

Le nom appartient donc à **ce qui mène à la page**, jamais à la page elle-même : la coquille des
réglages le rend à partir de la rubrique ouverte, la fiche caméra le remplace par le nom de la
caméra. Une page ne pose plus de cadre titré autour d'elle-même ; elle n'ouvre une section titrée
que si elle traite réellement **plusieurs sujets**, et cette section nomme alors autre chose que la
page.

Corollaire : un titre de section qui répète celui de la page est le signe qu'il fallait une page de
plus, pas un cadre de plus.

Le petit écran est le cas qui tranche, et il tranche dans les deux sens : le menu des rubriques s'y
efface, donc la page **doit** être nommée quelque part ; et deux fils d'ariane empilés y coûtent
tout de suite une hauteur d'écran, donc elle ne peut l'être qu'une fois.

## Conséquences

- **Les libellés de navigation disent la nature de l'écran.** « Alertes », qui nommait un écran de
  réglages, ne peut pas subsister tel quel ; le vocabulaire retenu est fixé avec le
  [DESIGN SYSTEM](../DESIGN%20SYSTEM.md), foyer unique du vocabulaire d'interface.
- **Le routage passe à deux niveaux** et devient la source de vérité de la sélection. L'union
  `CameraSelection`, qui sert aujourd'hui à la fois de sélection d'objet et de routage d'écran, perd
  sa seconde fonction — c'est elle qui a rendu si facile d'ajouter les réglages généraux au mauvais
  endroit, et donc elle qui masquait le problème.
- **`Cameras.Component.tsx` est démonté** en découverte, onboarding, fiche caméra et réglages. Ses
  1278 lignes sont la forme prise par l'absence de structure, pas une dette indépendante.
- **La transition est incrémentale, pas un big-bang.** La coquille — barre, arborescence, routage —
  est posée d'abord avec les écrans existants branchés dessous sans régression fonctionnelle ;
  chaque écran est ensuite repris pour son compte.
- **Une entrée de navigation nouvelle devient une décision.** La barre principale est fermée par
  construction : la place d'un réglage est dans l'arbre, jamais dans la barre. C'est la contrainte
  qui donne sa valeur à cet ADR, et la contourner reviendrait à retrouver l'état corrigé ici.
- **Le cycle d'édition et le socle de composants sont traités séparément** —
  [ADR-41](0041-cycle-d-edition-des-reglages-brouillon-explicite-enregistrer-vaut-appliquer.md) et
  [ADR-42](0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md) — mais les trois
  décisions partagent le même déclencheur et se livrent ensemble : une arborescence propre remplie de
  formulaires incohérents ne résoudrait rien.
- **SPECS §7.2 est réécrit** en conception mobile-first, et gagne l'attendu que la portée d'un réglage
  soit lisible sans explication.
