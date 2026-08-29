# ADR-53 — La documentation utilisateur vit dans l'interface : trois niveaux d'aide

> Statut : Accepté

## Contexte

Le workflow imposait jusqu'ici une sixième étape : toute feature livrable est documentée dans
`docs/user/`, un mode d'emploi par feature, en dehors du produit. Huit fichiers y sont écrits, environ
570 lignes.

Trois constats les condamnent.

**Personne ne les ouvre.** Ni l'utilisateur du produit — c'est le propriétaire du dépôt lui-même qui le
constate sur sa propre installation — ni celui qui corrige un défaut d'installation : quand le parcours
Discord s'est révélé incompréhensible, c'est l'écran qui a été repris, pas le markdown, qui décrivait
pourtant les mêmes étapes.

**Ils paraphrasent l'interface.** Rien n'empêche un document séparé de raconter la navigation
(« Réglages › Notifications, cliquez sur Ajouter un canal »), de décrire un bouton grisé que l'écran
explique déjà, ou de mentionner une option que l'utilisateur ne voit jamais parce qu'elle est absente
de son canal. Une page qui a de la place en prend.

**Ils dupliquent, donc ils divergent.** Le parcours d'installation d'un canal existe aujourd'hui à deux
endroits : la checklist affichée dans l'écran et le mode d'emploi. La règle suprême zéro-duplication est
violée par le processus lui-même, et la version qui vieillit est toujours celle qu'on ne relit pas.

Le problème de fond n'est donc pas *où ranger* le mode d'emploi, mais **quand l'utilisateur en a
besoin** : au moment où il hésite, devant le réglage qui le fait hésiter. Un document séparé est
structurellement au mauvais endroit et au mauvais moment.

## Options comparées

1. **Garder `docs/user/` et le tenir à jour avec discipline.** Écartée : c'est l'état actuel, et la
   discipline n'a pas suffi — la duplication est apparue dans la même PR que la règle qui l'interdit.
   Une règle que le processus rend difficile à tenir n'est pas une règle, c'est un vœu.
2. **Tout replier dans l'infobulle des réglages** (le niveau `help` d'[ADR-43](0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)).
   Écartée : un popover ne porte ni parcours en plusieurs étapes, ni liste de conditions, ni lien.
   Y déverser les modes d'emploi produirait un contenu à la fois noyé et illisible — pire que le
   statu quo.
3. **Trois niveaux d'aide dans l'interface, `docs/user/` supprimé.** Retenue.
4. **Un site de documentation en ligne.** Écartée : un produit local-first dont l'aide dépend d'une
   connexion et d'un hébergement contredit le principe #3, et rien ne garantit que la version en ligne
   corresponde à l'installation qu'on a sous les yeux.

## Décision

**Option 3.** L'aide n'est plus un document *à côté* du produit : elle est une propriété de l'écran, à
trois profondeurs, chacune ouverte seulement si la précédente n'a pas suffi.

### Les trois niveaux

| Niveau | Support | Porté par | Répond à |
|---|---|---|---|
| 1 | visible, sans un geste — libellé et `consequence` | un réglage | « qu'est-ce que je décide ici, et qu'est-ce que ça coûte ? » |
| 2 | infobulle derrière un déclencheur explicite — `help` | un réglage | « à quoi sert ce champ ? » |
| 3 | panneau replié « En savoir plus » | une **section ou un écran** | « comment je fais ? », « pourquoi ça n'a pas marché ? » |

Les niveaux 1 et 2 existent déjà et ne changent pas : ils sont l'anatomie de la ligne de réglage
fixée par [ADR-43](0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md). Un
**coût** reste toujours au niveau 1 : le cacher derrière un geste est un piège, pas de la sobriété.

Le niveau 3 est la nouveauté, et il est le seul destinataire de ce que contenait `docs/user/`. Il est
**replié par défaut** — l'écran nominal reste aussi dense qu'aujourd'hui — et il s'ouvre à l'endroit
exact où la question se pose, jamais dans un ailleurs qu'il faudrait aller chercher. Le mode d'emploi
d'installation d'un canal, déjà rendu dans son écran, en est la première occurrence.

### Le critère qui départage les niveaux 2 et 3

Le niveau 2 parle du **champ** ; le niveau 3 parle de la **tâche**. Comme ce critère se discute, il
porte une limite vérifiable : **une infobulle tient en deux phrases.** Ce qui déborde ne réclame pas
un popover plus grand — c'est le signe qu'on explique une tâche, et cela descend au niveau 3, en
laissant au niveau 2 la phrase qui suffit.

Sans cette limite, tout le contenu d'un mode d'emploi finirait empilé dans des infobulles : la dérive
est plus probable que l'oubli, parce qu'écrire dans l'infobulle est le geste le plus facile.

### Ce qui reste hors du produit

Deux contenus ne peuvent pas vivre dans l'interface, et ce sont les seuls :

- **ce qu'on lit avant d'avoir le produit** — à quoi il sert, à qui il convient : [`README.md`](../../README.md) ;
- **l'installation du produit lui-même** — docker, variables d'environnement : on ne documente pas
  dans une interface qui n'a pas encore démarré : [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

Entre les deux, plus rien. **`docs/user/` est écarté**, et l'étape 6 du workflow change de foyer :
une feature livrable est documentée **dans l'écran qui la porte**.

## Conséquences

- **Le tri prime la migration.** Replier `docs/user/` ne consiste pas à déplacer 570 lignes : ce qui
  paraphrase l'interface — navigation, boutons grisés, options absentes — est **supprimé**, pas
  déménagé. Environ un tiers survit. C'est le gain réel : un panneau attaché à une section n'a de
  place que pour ce que l'écran ne montre pas déjà.
- **Écran par écran, jamais en une fois.** Chaque fichier de `docs/user/` disparaît quand la feature
  correspondante est reprise, et pas avant ; aucun moment où les deux formes coexistent en se
  contredisant. Les canaux de notification sont le premier cas, étant le seul écran qui porte
  aujourd'hui les deux.
- **On perd la lecture linéaire et la recherche plein texte.** Assumé : pour un public non
  technicien, on ne cherche pas un mot-clé dans un manuel, on retourne à l'écran où on l'a vu
  (principe produit #1).
- **Une aide inatteignable doit vivre ailleurs.** Un écran qu'on ne peut pas ouvrir — premier
  démarrage, panne d'installation — ne peut pas porter sa propre aide : ces parcours gardent leur
  texte sur place, dans l'état d'erreur ou l'écran d'accueil qui les remplace.
- **Le diagnostic n'est pas un chapitre.** « Pourquoi ça ne marche pas » ne devient pas une section de
  niveau 3 par défaut : un message d'erreur porte son remède, et un état se lit là où il se produit
  (principe #4). Le niveau 3 n'accueille que ce qu'aucun état ne peut montrer.
- **Un volet d'[ADR-43](0043-grammaire-des-reglages-un-reglage-se-declare-il-ne-se-dessine-pas.md)
  est remplacé** : « une explication qui ne tient pas dans une info-bulle relève de la documentation
  utilisateur » devient « … relève du panneau `En savoir plus` de sa section ». Le reste d'ADR-43 —
  le nom qui se suffit, le déclencheur explicite, le coût toujours visible — est inchangé et reste le
  foyer de l'anatomie d'un réglage.
- **Le design system gagne un composant et une règle** : le panneau « En savoir plus » et le budget de
  deux phrases, dont le foyer est [`DESIGN SYSTEM.md`](../DESIGN%20SYSTEM.md) § Aide.
