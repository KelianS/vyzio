# ADR-41 — Cycle d'édition des réglages : brouillon explicite, et enregistrer vaut appliquer

> Statut : Accepté — volet « enregistrer vaut appliquer » remplacé par
> [ADR-44](0044-redemarrage-de-la-surveillance-acte-explicite-groupe-et-differe.md).
>
> Les sections « Deux temps, pas trois » et « Enregistrer rend la main tout de suite ; la mise en
> service se poursuit derrière » ne font plus foi. Tout le reste — le brouillon, son unité par page,
> la confirmation de sortie, le coût déclaré, l'échec persistant — reste en vigueur.

## Contexte

Trois états se superposent aujourd'hui sans vocabulaire commun : la **modification locale**,
l'**enregistrement côté Vyzio**, et l'**application au moteur de détection**. Le troisième existe
parce que Vyzio écrit la configuration du moteur immédiatement, mais que le moteur ne la relit qu'au
redémarrage ; un marqueur de configuration en attente
(`IFrigateConfigApplier.HasPendingChanges`) alimente un bandeau « configuration à appliquer »
([ADR-38](0038-modele-de-flux-camera-un-flux-une-qualite-roles-detect-record-separes.md)).

**Ce troisième état n'a jamais été un état utilisateur.** C'est la trace d'un détail
d'implémentation qui a fui jusque dans l'interface, ce que le principe #2 interdit précisément.
L'utilisateur, lui, doit se demander deux fois s'il a fini.

Chaque écran traite par ailleurs le cycle à sa façon : la fiche de connexion a un bouton
« Enregistrer », la rétention livrée par
[ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md) enregistre à
la sortie du champ sans bouton, et « Appliquer » vit dans la barre latérale, loin du réglage modifié.
Sur un écran déjà dense, le bouton d'action apparaît au fil du contenu, souvent hors de la zone
visible.

Deux manques, enfin : l'utilisateur ne voit jamais **ce qu'il a modifié** avant d'enregistrer, et ne
peut pas **annuler**.

## Options comparées

1. **Brouillon explicite, et un seul geste pour enregistrer et appliquer.** Modifier ne produit aucun
   effet ; une barre d'actions persistante annonce le nombre de modifications, permet d'annuler, et
   un unique **Enregistrer** persiste, génère la configuration et redémarre le moteur si nécessaire.
2. **Enregistrement immédiat partout**, sans bouton, prolongeant ADR-39 : chaque champ part à la
   sortie, le retour arrière par champ tient lieu d'annulation, et un bandeau « configuration à
   appliquer » reste ancré en bas d'écran. Plus léger, et bien adapté au mobile où un bouton en bas
   de page est hors écran. Écarté : il conserve les trois états — donc le pire du problème — et ne
   répond pas au manque le plus cité, savoir ce qui a été modifié. Il rend aussi chaque frappe
   coûteuse dès que le réglage touche le moteur.
3. **Conserver enregistrer et appliquer séparés**, en uniformisant seulement leur présentation.
   Écarté : cela revient à mieux exposer un état qui n'a pas de sens pour l'utilisateur. Le
   regroupement des changements, seule justification réelle de la séparation, est assuré par le
   brouillon lui-même.

## Décision

**Option 1.**

### Deux temps, pas trois

Modifier des valeurs **n'a aucun effet** : tout reste local. **Enregistrer** persiste, génère la
configuration et redémarre le moteur quand c'est nécessaire — c'est un seul geste et un seul mot.
« Enregistré mais pas appliqué » disparaît du vocabulaire.

Le brouillon reprend le rôle utile que la séparation jouait en douce : **grouper plusieurs
changements en un seul redémarrage**. Il le fait mieux, parce que le regroupement devient visible au
lieu d'être un effet de bord.

### Enregistrer rend la main tout de suite ; la mise en service se poursuit derrière

**Enregistrer** est composé de deux temps qui n'ont ni la même durée ni la même portée :

- la **persistance** est locale à la page, immédiate, et c'est elle seule qui conditionne le retour du
  brouillon à l'état propre. Dès qu'elle réussit, la page est libérée ;
- la **mise en service** — génération de configuration et redémarrage du moteur — dure des dizaines
  de secondes, et concerne **toute l'installation**, pas la page qui l'a déclenchée.

Faire attendre l'utilisateur pendant le redémarrage reviendrait à lui facturer un délai qui n'est pas
le sien : il a fini de régler. **Aucune page n'est donc bloquée par une mise en service en cours**, ni
celle qui l'a déclenchée, ni une autre.

L'avancement est porté par le **statut global du moteur de détection**, qui existe déjà et distingue
actif / redémarrage en cours / indisponible
([ADR-33](0033-statut-du-moteur-de-detection-expose-au-hub.md)). C'est le bon foyer : le redémarrage
est un fait d'installation, il n'appartient à aucun écran.

**Enregistrer pendant un redémarrage est autorisé et n'empile rien.** La configuration générée est
l'état complet voulu, jamais un incrément : une mise en service demandée pendant une autre se
**fusionne** avec elle, et une seule reprise supplémentaire suffit à converger. Refuser
l'enregistrement, ou faire la queue redémarrage par redémarrage, punirait l'utilisateur pour un
détail d'ordonnancement qu'il n'a pas à connaître.

### Le troisième état ne disparaît pas : il devient un état d'échec

Le redémarrage peut échouer, ou le moteur être injoignable. La vérité Vyzio et la vérité moteur
divergent alors, et il faut le dire : les réglages restent enregistrés — c'est la référence — et un
signal **persistant** annonce que le moteur ne les a pas repris, avec un moyen de réessayer.

Le chemin nominal a deux temps ; seul le chemin dégradé en montre un troisième, et il porte alors le
vocabulaire d'une **panne**, pas celui d'une étape restante.

### Le brouillon déclare son coût

Tous les réglages ne redémarrent pas le moteur : notifications, profils et positions PTZ ne touchent
pas sa configuration. Un bouton qui annoncerait toujours un redémarrage mentirait une fois sur deux.

C'est donc **le brouillon** qui annonce la conséquence, calculée sur son contenu réel : il indique
combien de réglages sont modifiés, lesquels, et **si l'enregistrement interrompra brièvement la
détection**. L'utilisateur sait ce qu'il s'apprête à faire avant de le faire, ce qui répond du même
geste au reproche « on ne voit pas ce qui a été modifié ».

### Le brouillon est par page, et une page modifiée ne se quitte pas en silence

Un brouillon qui traverse la navigation serait invisible depuis l'endroit où il agit, impossible à
suivre et facile à perdre — le défaut reproché à un mode global. La page est donc l'unité : elle
délimite ce qu'on regroupe, et quitter une page modifiée demande confirmation.

### Un seul cycle, partout

Aucun écran de réglages n'y déroge, y compris ceux qui enregistrent aujourd'hui à la sortie du champ.
La barre d'actions occupe une position **fixe et identique** partout, et non une place variable dans
le flux du contenu — c'est ce qui la rend trouvable sur mobile.

Le **retour arrière par champ** posé par ADR-39 est conservé et composé avec ce cycle : annuler une
surcharge devient une modification de brouillon comme une autre, soumise au même enregistrement. La
provenance d'une valeur (suivie ou propre) et son état d'édition (enregistrée ou en brouillon) sont
deux informations distinctes qui doivent rester lisibles séparément.

## Conséquences

- **L'exception d'ADR-39 est supprimée.** L'enregistrement à la sortie du champ était le seul de son
  espèce ; il rejoint le cycle commun. Le retour arrière ↺ et la provenance des valeurs, eux,
  survivent inchangés.
- **Chaque écran de réglages porte un état de brouillon.** C'est le coût principal de cette décision,
  et la raison pour laquelle elle se livre avec
  [ADR-42](0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md) : le brouillon
  est une primitive partagée du socle, jamais réimplémentée écran par écran.
- **Le backend doit savoir dire si un changement exige un redémarrage.** Le marqueur booléen
  « configuration en attente » ne suffit plus : l'interface a besoin de la réponse **avant**
  d'enregistrer, pour l'annoncer. C'est une propriété du réglage, pas de son écran.
- **Enregistrer devient une opération composite** — persistance, génération de configuration,
  redémarrage — dont l'échec partiel est un cas nominal à traiter, pas une exception. Sa réponse doit
  parvenir à l'interface **dès la persistance acquise**, sans attendre le redémarrage, sans quoi la
  page resterait bloquée pour une raison qui ne la concerne pas.
- **La mise en service doit être fusionnante et rejouable.** Une demande émise pendant un redémarrage
  en cours ne s'empile pas : elle se résout en une seule reprise supplémentaire. C'est ce qui rend
  possible d'enregistrer sur plusieurs pages à la suite sans les sérialiser.
- **Le bandeau « configuration à appliquer » disparaît du parcours normal.** Son mécanisme sous-jacent
  reste utile pour détecter la divergence après un échec, mais il n'est plus une étape offerte à
  l'utilisateur.
- **Le vocabulaire est fixé** dans le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md), foyer unique des mots
  d'interface : un seul verbe pour valider, un seul pour annuler, sur tous les écrans.
