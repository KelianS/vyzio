# Vyzio, Specifications Fonctionnelles

---

## Role du document

Ce document decrit le **besoin produit** et le **comportement attendu** du systeme du point de vue utilisateur.

Il ne tranche pas les choix de stack, d'algorithmes, de protocoles internes ou d'architecture detaillee. Ces points vivent dans [SAD.md](./SAD.md).

Il decrit la cible, au present : ni date, ni etat de livraison, ni historique (DOCS-16 de [rules/docs.md](rules/docs.md)).

Il garde ce qui vaut pour tout le produit : la vue d'ensemble, les règles transverses, les niveaux de service, le catalogue de capacités, le périmètre, les critères de succès et l'index des cas d'utilisation. Chaque parcours vit dans son cas d'utilisation, un fichier par objectif de l'utilisateur sous [`uc/`](uc/), écrit selon [`uc/TEMPLATE.md`](uc/TEMPLATE.md) ; il cite les règles d'ici par leur identifiant, sans les redire.

---

## Vue d'ensemble

### Promesse produit

Vyzio est une solution de video-surveillance local-first, pensee pour un public non-technicien. Le systeme doit permettre d'ajouter des cameras existantes, surveiller les zones utiles, reconnaitre des personnes connues, notifier les evenements importants et laisser les donnees sous le controle de l'utilisateur.

### Public cible

- foyers qui veulent une surveillance simple sans dependance cloud obligatoire ;
- petits sites professionnels qui privilegient la resilience locale ;
- utilisateurs non-techniciens qui attendent un parcours guide ;
- utilisateurs plus avances qui veulent garder une option self-hosted.

### Modes de mise a disposition

- **Appliance preconfiguree** : experience plug and play, installation minimale, support prioritaire.
- **Version open source self-hosted** : installation autonome pour utilisateurs techniques, sans changer la promesse local-first.

### Objectifs produit

- reduire la friction d'installation et de configuration des cameras ;
- notifier seulement les evenements utiles ;
- permettre un usage autonome sans connexion Internet ;
- garder la maitrise locale des images et des donnees sensibles ;
- fournir une interface comprensible sans culture NVR ou domotique.

---

## Identifiants

Chaque exigence porte un identifiant `<DOMAINE>-NN`, et chaque cas d'utilisation un identifiant `UC-<DOMAINE>-NN`, ses chemins `N1`, `A1`, `E1` ; on les cite par cet identifiant (DOCS-17), jamais recycle (DOCS-18), et une exigence vit ici ou dans un seul cas d'utilisation (DOCS-19).

| Domaine | Ce qu'il couvre |
| --- | --- |
| `UI` | L'interface en général : erreurs, réglages, accueil |
| `CAM` | Les caméras, leur connexion et leurs capacités |
| `LIVE` | La vue en direct |
| `PTZ` | Le pilotage d'une caméra orientable et ses positions |
| `IMG` | Les réglages image |
| `PRIV` | Le mode vie privée |
| `DET` | La détection et la reconnaissance |
| `PROF` | Les profils des personnes connues |
| `NOTIF` | Les notifications et le canal de messagerie |
| `HIST` | L'historique, le stockage et la rétention |
| `SCHED` | La planification de la maison |
| `ACCESS` | L'accès à l'interface, sur place et à distance |
| `SEC` | La sécurité et la confidentialité des données |
| `SYS` | Le moteur de détection et le fonctionnement hors ligne |

---

## Règles transverses

### Interface (`UI`)

- **UI-01** · Une erreur se lit a deux niveaux : une **phrase claire**, sans jargon, qui dit ce qui se passe et, quand il y a quelque chose a faire, quoi faire ; en dessous, le **detail technique complet** : ce qui a ete demande, ce qui a repondu, le code et la raison recus. Le second niveau s'adresse au support, pas a l'utilisateur : une demande d'aide arrive souvent sous forme de photo de l'ecran, sans journaux, et cette photo doit suffire au diagnostic. Un utilisateur averti doit aussi pouvoir le lire et ouvrir un ticket.
- **UI-02** · Le detail technique d'une erreur est, avec les replis ou le protocole se choisit par son nom (le repli **Avance** de la page, qui porte les protocoles de la camera, le repli **Options** de chaque carte de capacite et le formulaire d'ajout d'une capacite, cf. CAM-23), le seul endroit de l'interface ou un nom technique peut apparaitre ; il reste discret et ne remplace jamais la phrase claire.
- **UI-03** · Le detail ne contient jamais de secret : ni mot de passe, ni jeton, ni identifiant de compte camera. Une erreur reste affichee le temps d'etre lue et photographiee : celle qui porte un detail technique, jusqu'a ce que l'utilisateur la ferme.
- **UI-04** · les parcours camera, profils, historique et reglages doivent etre accessibles sans configuration manuelle de fichiers ;
- **UI-05** · l'interface doit employer un vocabulaire comprehensible pour un utilisateur non-specialiste ;
- **UI-06** · le libelle d'une entree de navigation doit dire la nature de l'ecran : **consulter** ou **regler** ; les deux ne se melangent pas dans une meme entree ;
- **UI-07** · **tout reglage doit avoir un emplacement previsible**, deductible du domaine qu'il gouverne, sans que l'utilisateur ait a connaitre l'organisation interne du produit ;
- **UI-08** · l'utilisateur doit savoir **sans explication** si un reglage vaut pour toute l'installation ou pour une seule camera, et retrouver le meme reglage aux deux portees sous la meme forme ;
- **UI-09** · les reglages rares doivent rester **atteignables sans mode a activer** : ils sont mis en profondeur, jamais masques derriere un palier « expert » ;
- **UI-10** · l'interface doit etre **concue pour le telephone d'abord**, le grand ecran developpant la meme structure ; les actions principales doivent rester faisables sur les deux ;
- **UI-11** · modifier un reglage ne doit produire **aucun effet** tant que l'utilisateur n'a pas valide ; avant de valider, il doit voir **ce qu'il a modifie** et pouvoir **renoncer** ;
- **UI-12** · enregistrer un reglage doit **rendre la main immediatement** et ne jamais interrompre la surveillance de sa propre initiative ;
- **UI-13** · l'interruption de la surveillance doit rester un **acte de l'utilisateur** : il choisit quand redemarrer, le declencheur est atteignable depuis n'importe ou (la vue en direct plein ecran le masque jusqu'au retour), et il ne s'affiche que lorsqu'un reglage l'exige reellement ;
- **UI-14** · un reglage enregistre mais pas encore repris par la surveillance doit se voir et **dire lesquels** ; l'ecart est autorise et n'oblige a rien, mais ne doit jamais etre silencieux ;
- **UI-15** · la question de redemarrer ne doit se poser qu'en **quittant les reglages**, jamais en passant d'une page de reglages a une autre ;
- **UI-16** · une **action** — verifier une connexion, supprimer une camera, couper la surveillance — prend effet tout de suite et ne differe jamais ;
- **UI-17** · si la surveillance ne reprend pas les reglages enregistres, l'interface doit le signaler de facon persistante et permettre de reessayer ;
- **UI-18** · **deux reglages de meme nature doivent se presenter de la meme facon** partout dans le produit : meme type de controle, meme alignement, meme place — pour que l'utilisateur apprenne l'interface une fois et non ecran par ecran ;
- **UI-19** · l'aide et les explications doivent rester **disponibles sans occuper la place** des noms et des valeurs de reglages, et rester atteignables au doigt ; en revanche, ce qui annonce un **cout** ou une **consequence irreversible** reste visible sans geste supplementaire ;
- **UI-24** · la barre principale ne porte que la consultation et une seule entree **Reglages** ; un reglage n'y entre jamais ;
- **UI-25** · les reglages forment un arbre a deux niveaux, rubriques puis pages, ranges par domaine fonctionnel, jamais par portee ni par ecran d'origine ;
- **UI-26** · sur telephone, un seul niveau de l'arbre des reglages est visible a la fois : la liste des rubriques, celle des pages, puis la page.

### Cameras (`CAM`)

- **CAM-01** · chaque camera doit avoir un nom, un statut visible et une configuration editable ;
- **CAM-02** · une camera designe **une seule scene** ; un boitier exposant plusieurs objectifs donne autant de cameras, nommables et configurables independamment, mais reconnaissables comme appartenant au meme appareil ;
- **CAM-03** · les reglages d'une camera sont des onglets sous son nom, dans l'ordre ou se regle une nouvelle camera : « Connexion », « Vie privée », « Détection », « Image et pilotage », « Conservation » ; sa page s'ouvre toujours sur « Connexion », qui porte ses capacites puis, dans Avance, son acces, ses protocoles, son nom et son retrait ;
- **CAM-04** · une camera est « À configurer » tant qu'elle n'est pas entree en surveillance (flux video qui n'a jamais fonctionne, puis flux fonctionnel en attente du redemarrage), partout ou son etat s'affiche (liste des cameras, en-tete de sa page, accueil, ou sa vignette mene a sa page sans tenter d'image) ; cet etat dit deja qu'elle ne surveille pas encore, et avant un premier fonctionnement du flux il est son seul etat (hors ligne ou erreur de configuration n'ont pas de sens avant) ; il ne revient jamais une fois la camera en surveillance, et une fois le flux fonctionnel, une panne ulterieure, changement de protocole du flux compris, se lit avec les etats habituels ;
- **CAM-05** · une camera « À configurer » peut deja etre visee par une plage de la planification ou par le choix de cameras d'une personne, qui s'appliquent a son entree en surveillance ; elle n'a pas de vue en direct, et l'historique n'a rien pour elle ; une fois son flux fonctionnel, elle entre en surveillance par le declencheur de redemarrage, qui ne la concerne qu'a partir de la ; d'ici la elle reste « À configurer » (et non « Connectée »), et sa vignette d'accueil mene encore a sa page sans tenter d'image ni ouvrir de vue en direct ; le declencheur « Appliquer les changements » dit ce qui reste a faire ;
- **CAM-06** · ce qui n'est pas encore regle garde ses valeurs par defaut, sans rien signaler : l'utilisateur n'est pas pousse a tout regler et peut commencer vite ; la detection, la conservation et la vie privee se reglent sans flux, et s'appliquent quand la camera entre en surveillance ; seul ce qui demande une capacite verifiee attend le flux, comme toute verification (CAM-08) ;
- **CAM-07** · une perte de flux doit etre detectee et visible sans diagnostic technique avance ;
- **CAM-08** · lorsqu'une camera est hors ligne, l'interface doit le refleter immediatement : le flux live ne doit pas tenter de se charger, et les actions qui requierent une connexion active (controle PTZ, reglages image, test de capacite) doivent etre suspendues avec un message explicite ; les tests de capacite le sont aussi tant que la verification du flux video ne passe pas, ou n'a pas ete refaite depuis un changement de connexion ;
- **CAM-09** · lorsque Vyzio modifie de sa propre initiative un reglage de la camera pour ameliorer les performances du systeme (et non a la demande de l'utilisateur), il doit memoriser la valeur d'origine et pouvoir la restaurer si la fonction est desactivee ou la camera retiree ; une telle modification ne doit jamais degrader la qualite des enregistrements.

### Vie privee (`PRIV`)

- **PRIV-01** · le mode vie privee doit empecher toute ingestion du flux camera par le moteur de detection ; aucun enregistrement, aucune detection, aucune notification ne doit etre genere pour une camera en mode vie privee ;
- **PRIV-02** · le flux RTSP de la camera ne doit pas etre accessible depuis Vyzio ni depuis Frigate pendant la periode de vie privee ;
- **PRIV-03** · le mode vie privee peut etre active manuellement (bascule instantanee) ou via une plage recurrente (jours de la semaine + heures de debut et de fin) planifiee dans la planification de la maison (SCHED-01), qui peut viser plusieurs cameras a la fois ;
- **PRIV-04** · le statut vie privee de chaque camera doit etre clairement visible dans l'interface (icone ou badge distinct de l'etat "hors ligne") ; le badge dit ce que la camera a repondu, jamais ce que la strategie promet : "Coupure materielle confirmee" quand la camera a confirme la coupure, "Camera orientee, enregistrement desactive" quand elle a accepte le mouvement vers sa position Parking, "Enregistrement desactive" quand rien n'est demande a la camera ou que sa reponse n'est pas arrivee ;
- **PRIV-05** · quand la camera ne suit pas (coupure ou mouvement refuse, camera qui ne repond pas, position non enregistree, capacite non verifiee), l'enregistrement reste coupe (ADR-10) et l'interface le dit : le badge nomme ce qui n'a pas eu lieu ("Camera non tournee, enregistrement desactive" pour le parking, "Objectif non coupe, enregistrement desactive" pour la coupure materielle), la vignette le signale avec un lien vers l'ecran vie privee de la camera, et cet ecran affiche une phrase qui dit ce qui s'est passe et quoi faire, avec le detail technique (UI-01) ; de meme a la desactivation, quand la camera ne revient pas sur sa position Surveillance ; quand la demande est interrompue avant la reponse de la camera, l'interface dit que Vyzio ne sait pas ce qu'elle a fait, sans pretendre qu'elle a refuse ;
- **PRIV-06** · la vignette d'une camera en mode vie privee affiche un etat explicite, avec les mots du badge, plutot qu'un echec de chargement ; la vue live ne s'ouvre pas tant que dure le mode vie privee ;
- **PRIV-07** · en cas de conflit entre une bascule manuelle et une plage, la bascule manuelle est prioritaire : une camera coupee a la main, pendant une plage ou non, reste coupee a la fin de la plage, jusqu'a ce que l'utilisateur reprenne la surveillance a la main ; une camera dont la surveillance est reprise a la main pendant une plage n'est pas recoupee par cette plage et tient jusqu'a sa fin (des plages qui se suivent ou se chevauchent comptent comme une seule), puis la plage suivante s'applique ; reprendre la surveillance de toutes les cameras suit la meme regle camera par camera ; cette reprise s'arrete aussi quand une plage qui vise la camera est enregistree, et quand Vyzio redemarre, ou les plages sont reevaluees ; tant qu'elle dure, l'ecran vie privee de la camera dit jusqu'a quand, a l'heure de la maison ;
- **PRIV-08** · l'etat du mode vie privee doit survivre a un redemarrage du systeme (persistance) ;
- **PRIV-09** · la desactivation du mode vie privee (manuelle ou fin de plage) doit restaurer le flux camera sans intervention utilisateur supplementaire ;
- **PRIV-10** · chaque caméra peut avoir une stratégie de mode vie privée indépendante : `software_blur` (« Arrêt logiciel », désactivation Frigate uniquement), `ptz_parking` (mouvement physique + désactivation Frigate), `hardware` (coupure native firmware, ex. Tapo) ;
- **PRIV-11** · `software_blur` est la stratégie par défaut d'une caméra ; il n'existe pas de stratégie « aucune » : le mode vie privée arrête toujours au moins l'enregistrement, la détection et les notifications de Vyzio (PRIV-01), et chaque stratégie ajoute ce que la caméra fait en plus ;
- **PRIV-12** · le mode `ptz_parking` est **toujours cumulatif avec le fallback software** : la caméra pivote vers sa position Parking (preset 2) ET Frigate est désactivé ; la double couche garantit la protection même si le mouvement PTZ échoue ; à la désactivation, la caméra revient sur sa position Surveillance (preset 1) et l'enregistrement reprend, même si ce retour échoue, ce que l'interface dit (PRIV-05) ;
- **PRIV-13** · tant que dure le mode vie privee, aucune image de la camera n'est montree ni enregistree ;
- **PRIV-18** · la page de la caméra propose le mode vie privée et les positions Surveillance et Parking dès l'ajout, sans étape d'ajout dédiée ; seules attendent, la vie privée se réglant sans flux (CAM-06), les stratégies qui demandent une capacité vérifiée (CAM-08 suspend les vérifications tant que le flux ne fonctionne pas), et le parking PTZ, dont les positions s'enregistrent depuis la vue live, qui ne s'ouvre qu'une fois la caméra en surveillance : l'écran vie privée et l'écran de pilotage le disent et mènent à ce qui manque, la connexion tant que le flux ne fonctionne pas, puis le déclencheur de redémarrage ; une orientation à confirmer s'essaie d'abord depuis sa carte (UC-CAM-04), puis ses positions se règlent depuis la vue live.

### Pilotage (`PTZ`)

- **PTZ-02** · les contrôles et les positions n'apparaissent, dans la vue live comme dans la section Pilotage des réglages de la caméra, que si l'orientation fonctionne, prouvée ou confirmée par l'utilisateur (CAM-15, CAM-16) ; tant qu'elle ne fonctionne pas, aucune commande inerte : une ligne renvoie vers la page « Connexion » de la caméra, où sa carte dit pourquoi et comment en sortir (CAM-24) ; une orientation désactivée par l'utilisateur n'y laisse rien ;
- **PTZ-08** · quand la caméra ne répond pas à la lecture de ses positions, l'interface remplace les slots par un message disant qu'elles n'ont pas pu être lues, jamais qu'elles manquent, avec « Réessayer » et le détail technique (UI-01) ; l'écran vie privée le dit de même : une stratégie `ptz_parking` déjà choisie est gardée, et la choisir attend que les positions aient pu être lues.

### Detection (`DET`)

- **DET-01** · la surveillance doit distinguer au minimum les evenements prioritaires des evenements de bruit ;
- **DET-02** · un evenement reconnu doit indiquer la camera, l'heure et l'identite estimee si disponible ;
- **DET-03** · un evenement incertain doit pouvoir etre presente comme tel, sans sur-promettre une certitude.

### Profils (`PROF`)

- **PROF-01** · les profils doivent etre modifiables et supprimables depuis l'interface ;
- **PROF-03** · la politique de notification d'une personne ne regle que les notifications : une personne reglee sur « ne pas me notifier » ne declenche aucune notification, et reste reconnue et nommee dans l'historique ;
- **PROF-04** · une personne peut etre limitee a certaines cameras pour ses notifications : sans choix, elle est notifiee sur toutes les cameras, y compris une camera ajoutee plus tard ; avec un choix, seulement sur les cameras cochees, et cocher toutes les cameras fige la liste ; la reconnaissance et l'historique ne changent pas selon la camera.

### Notifications (`NOTIF`)

- **NOTIF-01** · le produit doit privilegier la pertinence des notifications plutot que la quantite ;
- **NOTIF-02** · le produit doit supporter au moins un canal de notification utilisable par un public non-tech ; plusieurs canaux pourront coexister selon les besoins utilisateur ;
- **NOTIF-03** · chaque notification importante doit contenir un contexte minimum : type d'evenement, camera, heure, apercu si autorise ;
- **NOTIF-04** · si une dependance reseau externe est necessaire pour un canal, ce compromis doit etre explicite et opt-in ;
- **NOTIF-05** · ajouter un canal ne doit pas ajouter un ecran : les canaux se reglent avec la meme grammaire, seule la facon de s'y connecter change ;
- **NOTIF-06** · les reglages doivent etre persistants cote Vyzio et ne pas dependre d'une edition manuelle du runtime ;
- **NOTIF-07** · pendant une plage **sans notification** (SCHED-02), les canaux vises n'envoient rien, tandis que la detection, l'enregistrement et l'historique continuent ; une notification tombee dans la plage est abandonnee, jamais differee a sa fin ; seules les notifications de detection se taisent, jamais les reponses aux commandes (UC-NOTIF-05) ;
- **NOTIF-08** · une meme commande doit se comporter de la meme facon sur tous les canaux ; seule sa presentation s'adapte a ce que le canal sait afficher ;
- **NOTIF-09** · **la configuration ne se fait pas depuis un canal de messagerie** : un fil de discussion ne peut porter ni brouillon, ni provenance d'une valeur, ni retour arriere (cf. UI-11) ; les reglages restent dans l'interface. Une conversation est plafonnee au role **resident** (ACCESS-01) quel que soit celui qui l'a appairee, et ne revele jamais un secret ([ADR-16](adr/0016-access-and-security.md)) ;
- **NOTIF-10** · un canal de messagerie transporte des images fixes et des clips, jamais un flux video continu ;
- **NOTIF-11** · lorsqu'un canal externe revient, les regles de reprise doivent eviter les rafales de notifications inutiles ;
- **NOTIF-15** · une notification de personne part pendant que la personne est encore dans le champ de la camera (NOTIF-12) ;
- **NOTIF-23** · seule une conversation appairee explicitement depuis l'interface doit etre acceptee ; l'appairage doit etre revocable, et un message d'une autre origine doit rester sans reponse ;
- **NOTIF-25** · des qu'une conversation est reliee ou en cours de liaison, l'interface doit dire si le canal **ecoute encore**, et pourquoi il a cesse : une conversation reliee ne prouve rien, elle survit a la panne qui rend le canal muet. Tant qu'aucune ne l'est, une commande reste sans reponse de toute facon.

### Historique (`HIST`)

- **HIST-01** · l'utilisateur doit etre informe si la capacite de stockage devient critique ;
- **HIST-11** · la video d'une detection dont l'enregistrement a ete efface avec une autre ne s'affiche pas en panne : son lecteur dit que la video de ce moment a ete supprimee.

### Planification (`SCHED`)

- **SCHED-01** · tout ce qui est programme dans la maison se planifie, se voit et se modifie a un seul endroit, la **Planification**, une rubrique des reglages ; ajouter un nouveau type de plage n'ajoute ni formulaire ni ecran : l'ecran d'une plage est le meme pour tous les types, seules changent les cibles proposees et l'effet annonce ;
- **SCHED-02** · chaque plage a un **type** qui dit ce qu'elle fait, et deux types ne se confondent jamais : une plage **Vie privee** coupe les cameras visees (aucun enregistrement, aucune detection, aucune notification, PRIV-01) ; une plage **Sans notification** laisse filmer et enregistrer et fait seulement taire l'envoi sur les canaux vises (NOTIF-07). Le type se lit a son nom et a son icone, jamais a la seule couleur, et son effet reste visible pendant qu'on regle la plage ;
- **SCHED-03** · les heures sont celles de la maison, jamais celles de l'appareil qui consulte, et l'ecran le dit.

### Acces (`ACCESS`)

- **ACCESS-01** · Deux roles existent : le **proprietaire**, et le **resident**, qui consulte le direct et l'historique et peut couper une camera, mais ne touche ni aux reglages ni aux secrets. La frontiere est **utiliser / configurer**, jamais « voir / ne pas voir » : un resident voit deja toutes les images. Comment cet acces est protege : [ADR-16](adr/0016-access-and-security.md).
- **ACCESS-02** · l'appairage d'une conversation de messagerie reste independant : il n'ouvre pas l'interface, et une session n'appaire pas une conversation (UC-NOTIF-04) ;
- **ACCESS-03** · l'acces a l'interface et aux donnees doit etre protege.

### Securite et confidentialite (`SEC`)

- **SEC-01** · aucune transmission d'image ou de donnee sensible ne doit etre activee par defaut vers un service tiers ;
- **SEC-02** · aucun compte cloud ne doit etre obligatoire pour le fonctionnement nominal local ;
- **SEC-03** · sur le reseau domestique, l'interface est servie sans chiffrement : sa confidentialite est celle de ce reseau ; depuis l'exterieur, l'acces passe par le reseau overlay chiffre ([ADR-16](adr/0016-access-and-security.md)) ;
- **SEC-04** · **aucun tiers ne doit pouvoir lire les images en transit** : un acces distant qui ferait dechiffrer le flux par un intermediaire est exclu, quel que soit son confort d'usage.

### Systeme (`SYS`)

- **SYS-01** · l'etat du moteur de detection interne doit etre visible sur trois paliers — actif, redemarrage en cours, indisponible — sans jamais nommer le composant technique sous-jacent ; le palier "redemarrage en cours" s'affiche pendant l'application d'une nouvelle configuration (ex. changement de reglages, activation du mode vie privee) et se resout automatiquement des que le moteur redevient joignable, sans action de l'utilisateur ;
- **SYS-02** · le moteur de detection interne doit s'adapter automatiquement au materiel disponible (accelerateur dedie, puis carte graphique, puis processeur en dernier recours), sans configuration manuelle ; en l'absence d'accelerateur dedie ou de carte graphique, la frequence d'analyse est reduite automatiquement selon le nombre de cameras actives, dans une plage bornee (SYS-06) garantissant une detection utile sans saturer le processeur ;
- **SYS-03** · la surveillance locale doit continuer sans Internet ;
- **SYS-04** · une indisponibilite reseau ne doit pas empecher l'enregistrement local des evenements.

---

## Catalogue de capacites, independant de la marque

Les fonctionnalites avancees d'une camera sont des capacites, decouvertes et prouvees par les cas d'utilisation UC-CAM-02 a UC-CAM-05 ; les regles ci-dessous valent pour toutes.

- **CAM-10** · les fonctionnalites avancees (flux video, PTZ, mode vie privee materiel, reglages image, reglages de flux, info systeme) sont des **capacites independantes de la marque** : la marque ne sert qu'a choisir la notice de l'ecran d'ajout (UC-CAM-01), aucune marque n'a de preconfiguration ni de fonctionnalite reservee (voir [ADR-04](adr/0004-the-camera-model.md)) ;
- **CAM-11** · toute camera accede aux capacites que son materiel permet reellement, par la meme detection ; quand la detection ne trouve pas une capacite, le parcours est plus long (declaration et verification manuelle de la capacite) mais jamais bloquant par principe ;
- **CAM-12** · le parcours manuel est presente comme une alternative quand la detection ne trouve pas une capacite, pas comme le parcours par defaut ;
- **CAM-13** · l'utilisateur doit pouvoir declarer manuellement, capacite par capacite, comment y acceder (ex. protocole PTZ : ONVIF ou DVRIP, avec ses parametres de connexion) ; Vyzio doit verifier la capacite par un test reel avant de la proposer activable dans l'interface, jamais sur simple declaration non verifiee ;
- **CAM-14** · si une capacite ne peut pas etre verifiee ou echoue au test, l'interface doit l'indiquer clairement et ne pas la presenter comme disponible ;
- **CAM-15** · une capacite est **verifiee** quand Vyzio en obtient une preuve en lisant la camera, sans jamais la faire bouger ni lui laisser de changement durable (ex. la camera decrit son orientation, renvoie ses reglages image ; une position d'essai que Vyzio enregistre pour la preuve est aussitot effacee) ; qu'un protocole reponde avec son compte ne prouve jamais une capacite, et une camera qui repond sans montrer la capacite la voit en echec, avec cette raison ;
- **CAM-16** · quand la camera ne permet aucune lecture qui la prouve, la capacite est **a confirmer**, jamais verifiee : l'utilisateur l'essaie depuis sa carte et repond a une question simple (UC-CAM-04) ; oui la rend verifiee, confirmee par lui a cette date, et elle le reste aux verifications suivantes tant que son protocole ne change pas ; non la laisse inutilisable, sans la dire en echec (c'est une reponse, pas une panne), et Vyzio retient cette reponse : ni une verification ni une detection ne repose la question, seule une preuve lue sur la camera, ou son propre oui apres un nouvel essai, la remplace ; Vyzio ne decide jamais seul ; l'essai est refuse tant que la camera est en mode vie privee, et suspendu comme toute verification tant que la verification de son flux ne passe pas (CAM-08) ; une capacite a confirmer n'est utilisee nulle part (commandes d'orientation, strategie de vie privee) tant qu'elle n'est pas confirmee ;
- **CAM-17** · les informations de connexion d'une camera se rangent sur **trois niveaux**, chacune a un seul endroit : la **camera** (son nom, son adresse, son compte) ; ses **protocoles**, pour chacun ce qui permet de le joindre (port, et un compte specifique facultatif qui remplace celui de la camera pour ce seul protocole, ex. le compte cloud Tapo) et s'il repond avec ce compte ; ses **capacites**, dont chacune passe par un protocole de la camera et porte ses propres reglages (les flux et leurs roles, inversion gauche-droite) ;
- **CAM-18** · le flux video est une capacite comme les autres : une camera qui ne parle que DVRIP et une camera RTSP suivent le meme parcours, de l'ajout a la surveillance ;
- **CAM-19** · a chaque verification, Vyzio demande une seule fois a la camera si un protocole repond avec son compte (joignable, puis compte accepte), et le dit sur ce protocole ; la detection automatique n'essaie une capacite que sur les protocoles qui repondent ; un choix manuel se fait parmi les protocoles de la camera capables de porter cette capacite, qu'ils repondent ou non (une camera sur batterie endormie doit rester configurable), et une capacite dont le protocole ne repond pas echoue en le disant ;
- **CAM-20** · l'interface montre chaque information de connexion une seule fois, a son niveau, et chaque niveau a ses propres mots d'etat, les memes pour tous ses elements : une capacite, le flux video compris, fonctionne ou non, un protocole est accessible (joignable et compte accepte) ou non ; l'etat de la camera elle-meme reste la ou il la resume (liste des cameras, en-tete de sa page) ;
- **CAM-21** · les mots d'etat d'une capacite, sur sa carte comme sur une ligne de flux : « Fonctionne » (prouvee par une lecture ou confirmee par l'utilisateur, ce que la carte precise avec la date ; pour le flux video, sa derniere verification est passee, jamais un simple port ouvert, la camera n'est pas hors ligne et la detection est assuree comme choisi), « À confirmer » (aucune lecture ne la prouve ; aussi apres « Essayer à nouveau », tant que la question n'a pas de reponse), « Non confirmée » (l'utilisateur a repondu non : inutilisee, sans etre en panne), « En échec » (la derniere verification a echoue, par le protocole ou parce que la camera ne montre pas la capacite ; pour le flux video, aussi quand la camera est hors ligne ou que le flux de detection ne repond pas, la carte disant lequel), « Pas encore vérifié » (le flux video pas verifie depuis un changement de connexion, ou une ligne de flux jamais verifiee), « À configurer » (aucun protocole choisi), « Désactivée » (une orientation coupee par l'utilisateur) ; « Non confirmée » ne concerne que l'orientation et la coupure materielle, « Désactivée » que l'orientation ;
- **CAM-22** · les mots d'etat d'un protocole : « Accessible » (la camera repond sur ce port et accepte le compte), « Accès refusé » (elle repond mais refuse le compte, ou le numero d'appareil en V380), « Injoignable » (rien ne repond sur ce port), « Pas encore vérifié » (jamais interroge par ce protocole), seul mot commun aux deux niveaux, pour le meme fait ;
- **CAM-59** · en V380, quand la camera ne donne pas son numero d'appareil, l'utilisateur peut le saisir sur la ligne de ce protocole ; un numero trouve par Vyzio y est garde ;
- **CAM-23** · les capacites se lisent comme une liste de cartes, le flux video en premier, puisque toutes les autres en dependent ; le choix du protocole d'une capacite et ses reglages sont dans les options de sa carte, et changer de protocole le teste aussitot ; un protocole se verifie sans passer par une capacite, et n'est donc jamais suspendu par un flux en echec ;
- **CAM-24** · une capacite en echec dit comment en sortir : quand son protocole ne repond pas, reveiller la camera ou verifier qu'elle est branchee ; quand il refuse le compte, revoir le compte ; sinon la verifier de nouveau ou passer par un autre protocole ; un flux video qui ne repond pas nomme les deux endroits ou cela se corrige, l'acces (adresse, compte) dans Avance, le protocole et les flux dans les options de sa carte ; apres un non, la carte rappelle ce que l'utilisateur a dit avoir vu ; une orientation jamais utilisee se retire (« Retirer »), une orientation en service se desactive (« Désactiver ») ;
- **CAM-25** · un protocole porte le meme nom partout ou il apparait ; seul le protocole par defaut d'une capacite le precise dans son choix (ex. « RTSP (par défaut) » pour le flux video) ;
- **CAM-26** · une camera est creee sans protocole ni flux video (UC-CAM-01) et ne depend jamais de RTSP : aucune n'est refusee faute de chemin RTSP, c'est la carte du flux video qui le demande quand il le faut ;
- **CAM-56** · sous la carte du flux video, chaque flux de la camera est une ligne : sa qualite, son protocole et son chemin, son role, son etat et sa propre verification ; un flux garde sans servir a le role « Aucun », et un flux se retire comme une capacite ; la carte garde un seul etat, qui dit si l'enregistrement et la detection sont assures ; la verification d'une ligne verifie ce seul flux, sauf pour le flux qui enregistre, dont la verification est celle de la camera, et celle de la carte verifie la camera et tous ses flux ; l'echec du flux qui enregistre est celui de la camera, que la carte explique deja ; retirer un flux demande confirmation, qui dit, pour le flux qui detecte, que la detection passe sur le flux qui enregistre ; changer le role d'un flux, en ajouter ou en retirer prend effet aussitot, comme une action (UI-16), alors que l'adresse, les ports et les comptes suivent le brouillon de la page.

---

## Niveaux de service

Un niveau de service est une promesse a l'utilisateur qui pourrait regresser sans qu'une revue de code le voie ; il fixe une cible mesurable, sur le reseau domestique et avec le materiel de l'appliance (DOCS-20). Les regles et les cas d'utilisation le citent par son identifiant.

| ID | Ce qui est mesure | Cible |
| --- | --- | --- |
| **LIVE-01** | Retard de la video en direct sur la scene | 1,5 s au plus |
| **NOTIF-12** | Delai entre la reconnaissance d'une personne et le depart de sa notification | 10 s au plus avec une photo, 25 s au plus avec un clip |
| **SYS-06** | Frequence d'analyse par camera sans accelerateur dedie ni carte graphique | de 1 a 5 images par seconde |

---

## Perimetre produit

Ce que Vyzio couvre, et ce qu'il ne cherche pas à couvrir. Le contenu d'une version donnée ne vit
pas ici : il vit dans son jalon GitHub ([WORKFLOW](WORKFLOW.md) § Releases, one milestone each).

### Ce que Vyzio couvre

- ajout et gestion de caméras existantes ;
- surveillance locale avec notifications sur événements prioritaires ;
- gestion de profils connus ;
- historique consultable et rétention configurable ;
- interface web unifiée pour les parcours principaux.

### Hors perimetre

- couverture exhaustive de tous les usages experts d'un NVR ;
- exposition de chaque capacité avancée dans une UI Vyzio 100 % custom ;
- automatisations complexes et scénarios très spécialisés ;
- expériences distantes avancées qui compliquent la promesse locale par défaut.

---

## Criteres de succes produit

- un utilisateur non-tech doit pouvoir comprendre la promesse, installer le systeme et recevoir ses premieres notifications sans lire de documentation technique ;
- le systeme doit rester utile meme sans connexion Internet ;
- les notifications doivent etre suffisamment pertinentes pour ne pas degrader la confiance utilisateur ;
- la frontiere entre comportement local par defaut et options distantes doit rester explicite a chaque etape.

---

## Index des cas d'utilisation

| ID | Objectif |
| --- | --- |
| [UC-UI-01](uc/ui-01-voir-l-etat-du-systeme.md) | Voir l'etat du systeme |
| [UC-UI-02](uc/ui-02-modifier-un-reglage.md) | Modifier un reglage et l'appliquer |
| [UC-CAM-01](uc/cam-01-ajouter-une-camera.md) | Ajouter une camera |
| [UC-CAM-02](uc/cam-02-detecter-les-capacites.md) | Detecter automatiquement les protocoles et les capacites |
| [UC-CAM-03](uc/cam-03-declarer-une-capacite.md) | Declarer une capacite ou un protocole a la main |
| [UC-CAM-04](uc/cam-04-confirmer-une-capacite.md) | Confirmer une capacite qu'aucune lecture ne prouve |
| [UC-CAM-05](uc/cam-05-choisir-les-flux.md) | Choisir les flux d'une camera |
| [UC-CAM-06](uc/cam-06-verifier-une-camera.md) | Verifier une camera |
| [UC-CAM-07](uc/cam-07-nommer-une-camera.md) | Nommer une camera |
| [UC-LIVE-01](uc/live-01-regarder-en-direct.md) | Regarder une camera en direct |
| [UC-PTZ-01](uc/ptz-01-orienter-la-camera.md) | Orienter la camera |
| [UC-PTZ-02](uc/ptz-02-gerer-les-positions.md) | Enregistrer et rappeler des positions |
| [UC-IMG-01](uc/img-01-regler-l-image.md) | Regler l'image d'une camera |
| [UC-PRIV-01](uc/priv-01-couper-une-camera.md) | Couper une camera |
| [UC-PRIV-02](uc/priv-02-choisir-la-strategie.md) | Choisir la strategie de vie privee d'une camera |
| [UC-DET-01](uc/det-01-choisir-ce-qui-est-detecte.md) | Choisir ce qui est detecte |
| [UC-DET-02](uc/det-02-corriger-une-reconnaissance.md) | Confirmer ou corriger une reconnaissance |
| [UC-DET-03](uc/det-03-sensibilite.md) | Laisser Vyzio regler la sensibilite, ou la figer |
| [UC-DET-04](uc/det-04-definir-les-zones.md) | Definir les zones utiles d'une camera |
| [UC-PROF-01](uc/prof-01-ajouter-une-personne.md) | Ajouter une personne a reconnaitre |
| [UC-PROF-02](uc/prof-02-regler-les-notifications-d-une-personne.md) | Regler les notifications d'une personne |
| [UC-PROF-03](uc/prof-03-voir-les-apparitions.md) | Voir les dernieres apparitions d'une personne |
| [UC-PROF-04](uc/prof-04-supprimer-un-profil.md) | Supprimer un profil |
| [UC-NOTIF-01](uc/notif-01-recevoir-une-notification.md) | Recevoir une notification d'evenement |
| [UC-NOTIF-02](uc/notif-02-configurer-un-canal.md) | Configurer un canal de notification |
| [UC-NOTIF-03](uc/notif-03-choisir-ce-qui-est-notifie.md) | Choisir ce qui merite une notification |
| [UC-NOTIF-04](uc/notif-04-relier-une-conversation.md) | Relier une conversation de messagerie |
| [UC-NOTIF-05](uc/notif-05-commander-depuis-la-messagerie.md) | Commander Vyzio depuis la messagerie |
| [UC-HIST-01](uc/hist-01-consulter-l-historique.md) | Consulter l'historique |
| [UC-HIST-02](uc/hist-02-regler-la-conservation.md) | Regler la conservation des enregistrements |
| [UC-HIST-03](uc/hist-03-supprimer-une-detection.md) | Supprimer une detection |
| [UC-SCHED-01](uc/sched-01-planifier-une-plage.md) | Planifier une plage |
| [UC-ACCESS-01](uc/access-01-creer-le-mot-de-passe.md) | Creer le mot de passe du proprietaire |
| [UC-ACCESS-02](uc/access-02-rester-connecte.md) | Se connecter et le rester |
| [UC-ACCESS-03](uc/access-03-deconnecter-un-appareil.md) | Deconnecter un appareil |
| [UC-ACCESS-04](uc/access-04-changer-le-mot-de-passe.md) | Changer son mot de passe |
| [UC-ACCESS-05](uc/access-05-retrouver-l-acces.md) | Retrouver l'acces apres un oubli |
| [UC-ACCESS-06](uc/access-06-acceder-depuis-l-exterieur.md) | Acceder a l'interface depuis l'exterieur |
| [UC-SEC-01](uc/sec-01-supprimer-ses-donnees.md) | Supprimer ou exporter ses donnees |
