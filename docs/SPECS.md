# Vyzio — Specifications Fonctionnelles

> Mai 2026 — document vivant

---

## Role du document

Ce document decrit le **besoin produit** et le **comportement attendu** du systeme du point de vue utilisateur.

Il ne tranche pas les choix de stack, d'algorithmes, de protocoles internes ou d'architecture detaillee. Ces points vivent dans [SAD.md](./SAD.md).

---

## 1. Vue d'ensemble

### 1.1 Promesse produit

Vyzio est une solution de video-surveillance local-first, pensee pour un public non-technicien. Le systeme doit permettre d'ajouter des cameras existantes, surveiller les zones utiles, reconnaitre des personnes connues, notifier les evenements importants et laisser les donnees sous le controle de l'utilisateur.

### 1.2 Public cible

- foyers qui veulent une surveillance simple sans dependance cloud obligatoire ;
- petits sites professionnels qui privilegient la resilience locale ;
- utilisateurs non-techniciens qui attendent un parcours guide ;
- utilisateurs plus avances qui veulent garder une option self-hosted.

### 1.3 Modes de mise a disposition

- **Appliance preconfiguree** : experience plug and play, installation minimale, support prioritaire.
- **Version open source self-hosted** : installation autonome pour utilisateurs techniques, sans changer la promesse local-first.

### 1.4 Objectifs produit

- reduire la friction d'installation et de configuration des cameras ;
- notifier seulement les evenements utiles ;
- permettre un usage autonome sans connexion Internet ;
- garder la maitrise locale des images et des donnees sensibles ;
- fournir une interface comprensible sans culture NVR ou domotique.

### 1.5 Erreurs lisibles et diagnosticables

Une erreur se lit a deux niveaux :

- une **phrase claire**, sans jargon, qui dit ce qui se passe et, quand il y a quelque chose a faire, quoi faire ;
- en dessous, le **detail technique complet** : ce qui a ete demande, ce qui a repondu, le code et la raison recus.

Le second niveau s'adresse au support, pas a l'utilisateur : une demande d'aide arrive souvent sous forme de photo de l'ecran, sans journaux, et cette photo doit suffire au diagnostic. Un utilisateur averti doit aussi pouvoir le lire et ouvrir un ticket. Ce sont, avec les replis ou le protocole se choisit par son nom (le repli **Avance** de la page, qui porte les protocoles de la camera, le repli **Options** de chaque carte de capacite et le formulaire d'ajout d'une capacite, cf. 2.3), les seuls endroits de l'interface ou un nom technique peut apparaitre ; il reste discret et ne remplace jamais la phrase claire.

Le detail ne contient jamais de secret : ni mot de passe, ni jeton, ni identifiant de compte camera. Une erreur reste affichee le temps d'etre lue et photographiee.

---

## 2. Parcours camera

### 2.1 User stories

> **En tant qu'utilisateur**, je veux que Vyzio m'aide a connecter mes cameras sans devoir connaitre leur configuration reseau.

> **En tant qu'utilisateur**, je veux nommer clairement chaque camera, afin de comprendre immediatement l'origine d'une notification.

> **En tant qu'utilisateur**, je veux definir des zones utiles sur l'image, afin d'ignorer les zones non pertinentes.

> **En tant qu'utilisateur**, je veux etre informe si une camera devient indisponible, afin de savoir que la surveillance n'est plus fiable.

> **En tant qu'utilisateur**, je veux verifier rapidement le flux d'une camera depuis l'interface, afin de confirmer que tout fonctionne.

> **En tant qu'utilisateur**, je veux que Vyzio reconnaisse le type probable de ma camera et m'explique quoi activer, afin de finir l'integration sans connaissance technique du constructeur.

> **En tant qu'utilisateur**, je veux savoir si mon modele fait partie des cameras officiellement supportees, afin d'avoir un niveau de confiance clair sur le parcours propose.

> **En tant qu'utilisateur**, je veux pouvoir integrer une camera qui ne supporte pas le RTSP nativement (ex. camera sur batterie ICSee/XMEye), afin de ne pas etre bloque par les limitations du protocole du fabricant.

> **En tant qu'utilisateur**, je veux qu'un boitier a plusieurs objectifs apparaisse comme plusieurs cameras que je nomme separement, afin de retrouver chaque angle de vue par son nom dans mes notifications.

> **En tant qu'utilisateur**, je veux choisir sur quel flux de ma camera l'analyse est faite, en voyant la resolution de chaque flux et ce que le choix change, afin d'arbitrer moi-meme entre fluidite du systeme et reconnaissance des visages.

### 2.2 Attendus fonctionnels

- le systeme doit proposer un parcours guide d'ajout de camera ;
- la detection automatique est souhaitee quand elle est possible, avec une saisie manuelle en secours ;
- la decouverte reseau doit distinguer au minimum une camera confirmee, une camera probable et un equipement non qualifie ;
- chaque candidat detecte doit exposer au minimum un libelle de confiance compréhensible, une explication courte des signaux observes et, si possible, un constructeur ou une famille probable ;
- le niveau de confiance doit rester explicable : Vyzio ne doit pas afficher une precision arbitraire ou un score opaque sans justification lisible ;
- une camera detectee mais non encore exploitable doit rester visible dans un parcours d'assistance plutot que disparaitre silencieusement ;
- une camera confirmee doit etre clairement distinguable d'un simple equipement reseau joignable, afin d'eviter les faux positifs dans le parcours d'onboarding ;
- lorsque Vyzio ne parvient pas a reconnaitre automatiquement le constructeur d'un equipement detecte, l'utilisateur doit pouvoir selectionner manuellement une marque connue durant l'onboarding afin de pre-remplir les capacites et le protocole de communication associes, sans devoir declarer chaque capacite une par une (cf. 2.3 pour la declaration capacite par capacite quand la marque elle-meme n'est pas connue) ;
- le produit doit guider l'utilisateur quand RTSP ou ONVIF doivent etre actives, avec une notice adaptee au constructeur detecte quand cette information est disponible ;
- pour les cameras dont le protocole natif n'est pas RTSP, le systeme doit proposer un mode d'integration alternatif transparent pour l'utilisateur, sans exiger de manipulation technique manuelle ;
- un candidat de la decouverte est presente comme pret des que son flux video est joignable par l'un des protocoles qui savent le porter (RTSP ou un protocole proprietaire), et son ajout part de ce protocole sans que l'utilisateur ait a le choisir ; il reste a preparer seulement quand aucun ne le permet ;
- le produit doit exposer une liste des constructeurs ou modeles officiellement supportes et l'utiliser pour rassurer l'utilisateur pendant l'onboarding ;
- chaque camera doit avoir un nom, un statut visible et une configuration editable ;
- l'utilisateur doit pouvoir definir plusieurs zones actives par camera ;
- une perte de flux doit etre detectee et visible sans diagnostic technique avance ;
- lorsqu'une camera est hors ligne, l'interface doit le refleter immediatement : le flux live ne doit pas tenter de se charger, et les actions qui requierent une connexion active (controle PTZ, test de capacite) doivent etre suspendues avec un message explicite ;
- une camera designe **une seule scene** ; un boitier exposant plusieurs objectifs donne autant de cameras, nommables et configurables independamment, mais reconnaissables comme appartenant au meme appareil ;
- lorsqu'une camera expose plusieurs flux de la meme scene, le produit doit les presenter chacun avec sa resolution quand elle est connue, son role (enregistrement, detection, les deux, ou aucun) et son propre etat, et laisser l'utilisateur choisir, sur le flux lui-meme, celui qui sert a l'analyse et celui qui enregistre ;
- ce choix doit etre accompagne d'une explication de ce qu'il change concretement (fluidite du systeme d'un cote, finesse de l'image analysee, donc reconnaissance des visages, vignette et images des notifications, de l'autre ; finesse des enregistrements pour le flux qui enregistre) ; il n'est jamais impose silencieusement ;
- par defaut, c'est le flux le plus leger qui est analyse et le plus detaille qui enregistre : le moteur de detection reduit l'image de toute facon, donc analyser un flux tres detaille coute des ressources sans rien apporter ; ce defaut doit etre annonce comme tel dans l'interface, et le flux detaille doit rester accessible en un geste pour qui veut privilegier la reconnaissance des visages ;
- il y a toujours exactement un flux qui enregistre : ce flux ne peut etre ni retire, ni prive de ce role tant qu'un autre flux ne l'a pas pris ; donner un role a un flux le retire au flux qui l'avait ;
- quand plus aucun flux n'a le role de detection (retire ou prive de ce role), l'analyse se fait sur le flux qui enregistre, et la carte du flux video le dit ; un flux de detection en echec ne deplace pas l'analyse de lui-meme : la carte dit que la detection ne fonctionne plus et laisse le choix a l'utilisateur ;
- le choix du flux d'analyse ne doit jamais degrader les enregistrements.

### 2.3 Catalogue de capacites et cameras non repertoriees

> **En tant qu'utilisateur**, je veux que les fonctionnalites avancees (PTZ, mode vie privee materiel, etc.) ne dependent pas de la marque de ma camera mais de ce qu'elle sait reellement faire, afin de ne pas etre prive d'une fonctionnalite uniquement parce que ma marque n'est pas dans la liste officielle.

> **En tant qu'utilisateur dont la camera n'est pas dans la liste des modeles officiellement supportes**, je veux pouvoir suivre un parcours de configuration manuelle plus long pour activer les memes fonctionnalites qu'une camera supportee, afin de profiter pleinement du produit sans devoir changer de materiel.

> **En tant qu'utilisateur**, je veux que Vyzio teste reellement une capacite avant de me la proposer (ex. sonder le PTZ), afin de ne jamais me laisser activer une option qui ne fonctionnera pas sur ma camera.

**Regles fonctionnelles :**

- les fonctionnalites avancees (flux video, PTZ, mode vie privee materiel, reglages image, reglages de flux, info systeme a venir) sont des **capacites independantes de la marque** ; une marque "officiellement supportee" est une marque pour laquelle Vyzio sait deja quelles capacites sont disponibles et comment les activer (preconfiguration), pas une marque qui beneficie de fonctionnalites reservees ;
- une camera non repertoriee doit pouvoir acceder aux memes capacites qu'une camera supportee, a condition que son materiel le permette reellement ; le parcours est plus long (declaration et verification manuelle des capacites) mais jamais bloquant par principe ;
- pour une camera non repertoriee, l'utilisateur doit pouvoir declarer manuellement, capacite par capacite, comment y acceder (ex. protocole PTZ : ONVIF ou DVRIP, avec ses parametres de connexion) ; Vyzio doit verifier la capacite par un test reel avant de la proposer activable dans l'interface — jamais sur simple declaration non verifiee ;
- si une capacite ne peut pas etre verifiee ou echoue au test, l'interface doit l'indiquer clairement et ne pas la presenter comme disponible ;
- une capacite est **verifiee** quand Vyzio en obtient une preuve en lisant la camera, sans jamais la faire bouger ni lui laisser de changement durable (ex. la camera decrit son orientation, renvoie ses reglages image ; une position d'essai que Vyzio enregistre pour la preuve est aussitot effacee) ; qu'un protocole reponde avec son compte ne prouve jamais une capacite, et une camera qui repond sans montrer la capacite la voit en echec, avec cette raison ;
- quand la camera ne permet aucune lecture qui la prouve, la capacite est **a confirmer**, jamais verifiee : l'utilisateur l'essaie depuis sa carte (Vyzio annonce ce qui va se passer, puis fait tourner la camera un peu et la ramene, ou la coupe quelques secondes), puis repond a une question simple (« La caméra a bougé ? ») ; oui la rend verifiee, confirmee par lui a cette date, et elle le reste aux verifications suivantes tant que son protocole ne change pas ; non la laisse inutilisable, et Vyzio retient cette reponse : ni une verification ni une detection ne repose la question, seule une preuve lue sur la camera, ou son propre oui apres un nouvel essai, la remplace ; sa carte dit comment en sortir : l'essayer a nouveau, volontairement, ce qui repose la question, ou passer par un autre protocole, ou la retirer (ajoutee de nouveau a la main, elle repart a confirmer) ; Vyzio ne decide jamais seul ; l'essai est refuse tant que la camera est en mode vie privee, et suspendu comme toute verification tant que son flux echoue (2.2) ; une capacite a confirmer n'est utilisee nulle part (commandes d'orientation, strategie de vie privee) tant qu'elle n'est pas confirmee ;
- la detection automatique garde, pour chaque capacite, le premier protocole qui la prouve, a defaut le premier ou elle est a confirmer ; une capacite a laquelle l'utilisateur a repondu non n'est remplacee que par une preuve ; sur une camera non reconnue, elle ne garde qu'une capacite prouvee, et l'utilisateur ajoute lui-meme celle qu'il sait presente ;
- les informations de connexion d'une camera se rangent sur **trois niveaux**, chacune a un seul endroit : la **camera** (son nom, son adresse, son compte) ; ses **protocoles**, pour chacun ce qui permet de le joindre (port, et un compte specifique facultatif qui remplace celui de la camera pour ce seul protocole, ex. le compte cloud Tapo) et s'il repond avec ce compte ; ses **capacites**, dont chacune passe par un protocole de la camera et porte ses propres reglages (les flux et leurs roles, inversion gauche-droite) ;
- le flux video est une capacite comme les autres : une camera qui ne parle que DVRIP et une camera RTSP suivent le meme parcours, de l'ajout a la surveillance ;
- sous la carte du flux video, chaque flux de la camera est une ligne : sa qualite, son protocole et son chemin, son role, son etat et sa propre verification ; un flux garde sans servir a le role « Aucun », et un flux se retire comme une capacite ; la carte garde un seul etat, qui dit si l'enregistrement et la detection sont assures ;
- l'utilisateur ajoute un flux, verifie aussitot, parmi ceux que la camera dit servir a ce moment, lus par qualite et non par chemin, ou en RTSP en saisissant son chemin ; le chemin d'un flux est son identite et ne change jamais : un chemin errone se corrige en ajoutant le bon flux ;
- les flux sont trouves une fois, puis la liste appartient a l'utilisateur : un flux retire ne revient pas de lui-meme ; changer le protocole du flux video remplace tous les flux, ce que le choix du protocole dit avant de s'appliquer, et en RTSP un flux a toujours un chemin, saisi par l'utilisateur quand la camera ne liste pas ses flux ou ne repond pas (voir [ADR-65](adr/0065-each-video-stream-is-a-checked-object-with-a-role-under-the-stream-binding.md)) ;
- a chaque verification, Vyzio demande une seule fois a la camera si un protocole repond avec son compte (joignable, puis compte accepte), et le dit sur ce protocole ; la detection automatique n'essaie une capacite que sur les protocoles qui repondent ; un choix manuel se fait parmi les protocoles de la camera capables de porter cette capacite, qu'ils repondent ou non (une camera sur batterie endormie doit rester configurable), et une capacite dont le protocole ne repond pas echoue en le disant ;
- l'interface montre chaque information de connexion une seule fois, a son niveau ;
- une fois la camera ajoutee, l'utilisateur peut lui ajouter une capacite (a la suite des capacites, verifiee aussitot) et un protocole (son port, le port habituel par defaut, et un compte specifique facultatif, verifie aussitot) ; il peut retirer un protocole qu'aucune capacite n'utilise, et Vyzio dit simplement pourquoi il refuse sinon ; une capacite qui a deja sa carte change de protocole depuis les options de cette carte ; pour passer par un protocole que la camera n'a pas encore, l'utilisateur l'ajoute d'abord (« Ajouter un protocole ») : aucun choix de capacite n'en cree un en silence, et la ou aucun protocole de la camera ne convient, Vyzio le dit simplement et renvoie d'abord vers « Détecter automatiquement », puis vers cet ajout ;
- « Détecter automatiquement », visible sous les capacites sans rien ouvrir, traite les deux niveaux dans l'ordre : il cherche les protocoles habituels de la camera et garde ceux qui repondent, puis choisit le flux video s'il manque et les capacites ; « Rechercher les protocoles », dans Avance, cherche les protocoles de la meme facon sans toucher a aucune capacite : il ajoute les protocoles habituels qui repondent et verifie a nouveau ceux que la camera a deja, qu'il garde tous ;
- un protocole porte le meme nom partout ou il apparait ; seul le protocole par defaut d'une capacite le precise dans son choix (ex. « RTSP (par défaut) » pour le flux video) ;
- une camera sans flux video choisi le recoit de « Détecter automatiquement » : Vyzio essaie RTSP puis DVRIP, parmi les protocoles qui repondent, et garde le premier dont le flux est verifie, ou a defaut le premier qui repond, avec la raison de l'echec ; la detection reste donc possible tant que le flux n'est pas choisi ;
- le statut "officiellement supporte" reste affiche et utilise pour rassurer l'utilisateur (cf. 2.2) ; le parcours manuel est presente comme une alternative pour les cameras absentes de cette liste, pas comme le parcours par defaut ;
- lorsque Vyzio modifie de sa propre initiative un reglage de la camera pour ameliorer les performances du systeme (et non a la demande de l'utilisateur), il doit memoriser la valeur d'origine et pouvoir la restaurer si la fonction est desactivee ou la camera retiree ; une telle modification ne doit jamais degrader la qualite des enregistrements.

---

## 3. Detection et reconnaissance

### 3.1 User stories

> **En tant qu'utilisateur**, je veux etre notifie lorsqu'une personne connue est detectee, afin de savoir qui arrive.

> **En tant qu'utilisateur**, je veux etre notifie lorsqu'un visage inconnu apparait, afin de pouvoir reagir vite.

> **En tant qu'utilisateur**, je veux choisir quels types de detection doivent generer des evenements utiles, afin d'adapter le systeme a mon contexte (personnes, animaux, vehicules, etc.).

> **En tant qu'utilisateur**, je veux eviter les notifications inutiles, afin que le systeme reste credibile au quotidien.

> **En tant qu'utilisateur**, je veux pouvoir confirmer ou corriger une reconnaissance, afin d'ameliorer la qualite du systeme dans le temps.

### 3.2 Regles fonctionnelles

- la surveillance doit distinguer au minimum les evenements prioritaires des evenements de bruit ;
- l'utilisateur doit pouvoir configurer les types de detection Frigate pris en compte dans le flux produit ;
- la configuration doit permettre au minimum d'activer ou desactiver des categories comme les personnes, animaux ou vehicules selon les capacites fournies par Frigate ;
- un evenement reconnu doit indiquer la camera, l'heure et l'identite estimee si disponible ;
- un evenement incertain doit pouvoir etre presente comme tel, sans sur-promettre une certitude ;
- l'utilisateur doit pouvoir corriger une reconnaissance depuis un parcours simple ;
- le produit doit privilegier la pertinence des notifications plutot que la quantite.

**Sensibilite de detection — auto-reglage :**

> **En tant qu'utilisateur**, je veux que Vyzio se regle tout seul sur une scene agitee (feuillage, route passante), afin de ne pas avoir a comprendre ce qu'est un « reglage de mouvement » pour que le systeme reste fluide.

> **En tant qu'utilisateur**, je veux savoir pourquoi une camera a ete rendue moins sensible et pouvoir figer ce reglage, afin de garder la main si le choix automatique ne me convient pas.

- la sensibilite de detection s'ajuste automatiquement, par camera, en fonction de l'agitation reellement observee sur la scene ; l'utilisateur n'a aucun reglage technique a fournir ;
- la sensibilite s'exprime en trois niveaux comprehensibles (elevee / moyenne / reduite) — jamais en valeur technique ni en vocabulaire Frigate ;
- le niveau courant et sa raison doivent etre lisibles par l'utilisateur, qui doit pouvoir **figer** le niveau d'une camera pour desactiver l'ajustement automatique sur celle-ci ;
- l'ajustement automatique poursuit un objectif de fluidite, jamais de qualite de detection : il ne doit jamais descendre en dessous du niveau le plus bas prevu, et ce compromis doit etre assume explicitement ;
- l'ajustement ne doit provoquer aucune interruption visible du service (pas de coupure du flux ni des enregistrements).

---

## 4. Gestion des profils

### 4.1 User stories

> **En tant qu'utilisateur**, je veux ajouter une personne a reconnaitre a partir d'une ou plusieurs photos.

> **En tant qu'utilisateur**, je veux choisir le comportement de notification associe a une personne, afin d'adapter le systeme a mon foyer.

> **En tant qu'utilisateur**, je veux n'etre notifie du passage d'une personne de mon foyer que sur certaines cameras, afin de ne pas etre derange la ou sa presence est normale.

> **En tant qu'utilisateur**, je veux voir la derniere apparition d'une personne connue, afin de garder un historique simple.

> **En tant qu'utilisateur**, je veux supprimer un profil et ses donnees associees, afin de rester maitre de mes donnees.

### 4.2 Attendus fonctionnels

- un profil doit contenir au minimum un nom, des donnees de reference suffisantes et une politique de notification ;
- les profils doivent etre modifiables et supprimables depuis l'interface ;
- l'historique recent d'une personne connue doit etre consultable ;
- la politique de notification d'une personne ne regle que les notifications : une personne reglee sur « ne pas me notifier » ne declenche aucune notification, et reste reconnue et nommee dans l'historique ;
- une personne peut etre limitee a certaines cameras pour ses notifications : sans choix, elle est notifiee sur toutes les cameras, y compris une camera ajoutee plus tard ; avec un choix, seulement sur les cameras cochees, et cocher toutes les cameras fige la liste ; la reconnaissance et l'historique ne changent pas selon la camera ;
- la suppression d'un profil doit supprimer ses donnees liees selon la politique produit definie.

---

## 5. Notifications

### 5.1 User stories

> **En tant qu'utilisateur**, je veux recevoir une notification utile sur mon telephone quand un evenement important se produit.

> **En tant qu'utilisateur**, je veux pouvoir voir rapidement le contexte de l'evenement sans devoir fouiller dans l'interface.

> **En tant qu'utilisateur**, je veux regler les horaires et le niveau de bruit des notifications, afin de ne pas en etre submerge.

> **En tant qu'utilisateur**, je veux continuer a etre informe meme si je n'ai pas l'interface ouverte.

> **En tant qu'utilisateur**, je veux configurer mes destinations de notification depuis l'interface, afin de ne jamais modifier un fichier a la main.

> **En tant qu'utilisateur**, je veux etre guide pour configurer un canal, tester l'envoi et comprendre les compromis du canal choisi.

> **En tant qu'utilisateur**, je veux choisir quelles categories d'evenements meritent une notification et quel niveau de bruit appliquer selon le contexte.

> **En tant qu'utilisateur**, je veux choisir les informations affichees dans le message, afin de recevoir un contenu utile sans surcharge.

> **En tant qu'utilisateur hors de chez moi**, je veux repondre a une notification par une action (voir la camera, couper la surveillance, verifier l'etat) sans avoir a joindre l'interface.

> **En tant qu'utilisateur**, je veux retrouver les memes commandes quel que soit le canal de messagerie que j'utilise, afin de ne pas reapprendre le produit en changeant de canal.

### 5.2 Attendus fonctionnels

- le produit doit supporter au moins un canal de notification utilisable par un public non-tech ;
- plusieurs canaux pourront coexister selon les besoins utilisateur ;
- chaque notification importante doit contenir un contexte minimum : type d'evenement, camera, heure, apercu si autorise ;
- l'utilisateur doit pouvoir regler une certitude minimale de notification, et planifier des plages **sans notification** dans la planification de la maison (§7.3) : pendant une telle plage, les canaux vises n'envoient rien, tandis que la detection, l'enregistrement et l'historique continuent ; une notification tombee dans la plage est abandonnee, jamais differee a sa fin ; seules les notifications de detection se taisent, jamais les reponses aux commandes (§5.4) ;
- si une dependance reseau externe est necessaire pour un canal, ce compromis doit etre explicite et opt-in ;
- la configuration des canaux retenus doit etre lisible, modifiable et testable depuis l'interface Vyzio ;
- chaque canal propose doit etre couvert de bout en bout : saisie de ce qu'il demande, verification, etat configure / non configure, test d'envoi ;
- ajouter un canal ne doit pas ajouter un ecran : les canaux se reglent avec la meme grammaire, seule la facon de s'y connecter change ;
- le produit doit permettre de regler au minimum les destinations actives, les categories d'evenements notifiees, la certitude minimale et les plages sans notification ;
- le produit doit permettre de choisir un format de message simple, avec au minimum camera, heure, type d'evenement, identite si connue et apercu si autorise ;
- les reglages doivent etre persistants cote Vyzio et ne pas dependre d'une edition manuelle du runtime ;
- les capacites et limites d'un canal doivent etre explicites dans l'interface avant activation.

### 5.3 Regles hors ligne

- la surveillance locale doit continuer sans Internet ;
- une indisponibilite reseau ne doit pas empecher l'enregistrement local des evenements ;
- lorsqu'un canal externe revient, les regles de reprise doivent eviter les rafales de notifications inutiles.

### 5.4 Commandes depuis le canal de messagerie

- le canal de messagerie doit fonctionner **dans les deux sens** : recevoir des notifications, et accepter des commandes ;
- les commandes doivent couvrir l'usage courant a distance — etat du systeme, apercu d'une camera, dernieres detections, mode vie privee, positions PTZ, interruption et reprise de la surveillance — de sorte qu'un acces reseau au produit reste **optionnel** ;
- une meme commande doit se comporter de la meme facon sur tous les canaux ; seule sa presentation s'adapte a ce que le canal sait afficher ;
- **la configuration ne se fait pas depuis un canal de messagerie** : un fil de discussion ne peut porter ni brouillon, ni provenance d'une valeur, ni retour arriere (cf. §7.2) ; les reglages restent dans l'interface. Une conversation est plafonnee au role **resident** quel que soit celui qui l'a appairee, et ne revele jamais un secret ([ADR-54](adr/0054-interface-access-guarded-by-an-owner-account-server-session-in-a-cookie.md)) ;
- seule une conversation appairee explicitement depuis l'interface doit etre acceptee ; l'appairage doit etre revocable, et un message d'une autre origine doit rester sans reponse ;
- le code qui relie une conversation doit etre a duree de vie courte **et** cesser de valoir apres quelques essais infructueux : un code court que l'on peut deviner sans fin ne protege rien ;
- une action aux consequences visibles — couper la surveillance, lever le mode vie privee — doit demander une confirmation explicite avant de prendre effet ;
- un canal qui ne sait pas recevoir reste un canal de notification a part entiere ; l'interface doit le dire avant l'activation, et ne jamais laisser croire qu'on pourra lui parler ;
- un canal de messagerie transporte des images fixes et des clips, jamais un flux video continu ;
- l'utilisateur doit pouvoir consulter la trace des commandes recues et de leur issue ;
- des qu'une conversation est reliee ou en cours de liaison, l'interface doit dire si le canal **ecoute encore**, et pourquoi il a cesse : une conversation reliee ne prouve rien, elle survit a la panne qui rend le canal muet. Tant qu'aucune ne l'est, une commande reste sans reponse de toute facon.

---

## 6. Historique, stockage et retention

### 6.1 User stories

> **En tant qu'utilisateur**, je veux consulter l'historique recent des evenements, afin de comprendre ce qu'il s'est passe.

> **En tant qu'utilisateur**, je veux choisir combien de temps mes enregistrements sont conserves, afin de gerer mon espace disque.

> **En tant qu'utilisateur**, je veux pouvoir recuperer un clip pertinent, afin de le conserver ou le partager si necessaire.

### 6.2 Attendus fonctionnels

- l'utilisateur doit pouvoir consulter un historique filtre par camera, personne ou type d'evenement ;
- les clips associes a un evenement doivent etre consultables quand ils existent ;
- la retention doit etre configurable, sur trois natures d'enregistrement distinctes : la video complete, les portions ou l'image bouge, et les clips rattaches a une detection ; chacune a sa propre duree, et une duree nulle signifie que rien n'est conserve pour cette nature ;
- une duree de retention doit valoir pour toute l'installation par defaut, et rester surchargeable camera par camera ; une camera qui ne surcharge rien suit l'installation, et l'interface doit rendre visible lequel des deux s'applique ;
- l'enregistrement de la video complete doit rester un choix explicite, et l'ordre de grandeur de sa consommation disque doit etre annonce avant activation ;
- une camera dont aucune nature n'est conservee ne doit rien enregistrer du tout ;
- le systeme doit supprimer automatiquement les donnees arrivees au terme de retention ;
- l'utilisateur doit etre informe si la capacite de stockage devient critique.

---

## 7. Dashboard et experience d'usage

### 7.1 User stories

> **En tant qu'utilisateur**, je veux voir rapidement si mon systeme fonctionne correctement.

> **En tant qu'utilisateur**, je veux retrouver les derniers evenements sans passer par plusieurs menus.

> **En tant qu'utilisateur**, je veux gerer mes cameras, mes profils et mes notifications depuis la meme interface.

> **En tant qu'utilisateur**, je veux pouvoir utiliser le systeme depuis un navigateur sur telephone ou ordinateur.

> **En tant qu'utilisateur non-technicien**, je veux trouver un reglage sans savoir comment le produit est construit.

> **En tant qu'utilisateur exigeant**, je veux acceder aux reglages fins sans qu'ils encombrent le parcours courant.

> **En tant qu'utilisateur**, je veux savoir ce que j'ai modifie avant de valider, et pouvoir renoncer.

> **En tant qu'utilisateur**, je veux choisir moi-meme le moment ou ma surveillance s'interrompt.

> **En tant qu'utilisateur en deplacement**, je veux acceder a l'interface complete depuis l'exterieur de chez moi, sans configurer ma box ni exposer mes cameras sur Internet.

> **En tant qu'utilisateur soucieux de ma vie privee**, je veux que mes images ne transitent jamais en clair chez un tiers pour que je puisse les consulter a distance.

### 7.2 Attendus fonctionnels

- l'accueil doit rendre visible l'etat global du systeme et les notifications recentes ;
- tant qu'aucune camera n'est ajoutee, l'accueil, ouvert apres la creation du mot de passe (8.3), annonce la mise en service en trois etapes, ajouter une camera, choisir ce qui merite une notification, recevoir les notifications, et mene directement a l'ajout d'une camera et au reglage des notifications ; aucune etape ne demande de fichier a ecrire ;
- les parcours camera, profils, historique et reglages doivent etre accessibles sans configuration manuelle de fichiers ;
- l'interface doit employer un vocabulaire comprehensible pour un utilisateur non-specialiste ;
- le libelle d'une entree de navigation doit dire la nature de l'ecran : **consulter** ou **regler** ; les deux ne se melangent pas dans une meme entree ;
- **tout reglage doit avoir un emplacement previsible**, deductible du domaine qu'il gouverne, sans que l'utilisateur ait a connaitre l'organisation interne du produit ;
- l'utilisateur doit savoir **sans explication** si un reglage vaut pour toute l'installation ou pour une seule camera, et retrouver le meme reglage aux deux portees sous la meme forme ;
- les reglages rares doivent rester **atteignables sans mode a activer** : ils sont mis en profondeur, jamais masques derriere un palier « expert » ;
- l'interface doit etre **concue pour le telephone d'abord**, le grand ecran developpant la meme structure ; les actions principales doivent rester faisables sur les deux ;
- modifier un reglage ne doit produire **aucun effet** tant que l'utilisateur n'a pas valide ; avant de valider, il doit voir **ce qu'il a modifie** et pouvoir **renoncer** ;
- enregistrer un reglage doit **rendre la main immediatement** et ne jamais interrompre la surveillance de sa propre initiative ;
- l'interruption de la surveillance doit rester un **acte de l'utilisateur** : il choisit quand redemarrer, le declencheur est atteignable depuis n'importe ou, et il ne s'affiche que lorsqu'un reglage l'exige reellement ;
- un reglage enregistre mais pas encore repris par la surveillance doit se voir et **dire lesquels** ; l'ecart est autorise et n'oblige a rien, mais ne doit jamais etre silencieux ;
- la question de redemarrer ne doit se poser qu'en **quittant les reglages**, jamais en passant d'une page de reglages a une autre ;
- une **action** — verifier une connexion, supprimer une camera, couper la surveillance — prend effet tout de suite et ne differe jamais ;
- si la surveillance ne reprend pas les reglages enregistres, l'interface doit le signaler de facon persistante et permettre de reessayer ;
- **deux reglages de meme nature doivent se presenter de la meme facon** partout dans le produit : meme type de controle, meme alignement, meme place — pour que l'utilisateur apprenne l'interface une fois et non ecran par ecran ;
- l'aide et les explications doivent rester **disponibles sans occuper la place** des noms et des valeurs de reglages, et rester atteignables au doigt ; en revanche, ce qui annonce un **cout** ou une **consequence irreversible** reste visible sans geste supplementaire ;
- l'etat du moteur de detection interne doit etre visible sur trois paliers — actif, redemarrage en cours, indisponible — sans jamais nommer le composant technique sous-jacent ; le palier "redemarrage en cours" s'affiche pendant l'application d'une nouvelle configuration (ex. changement de reglages, activation du mode vie privee) et se resout automatiquement des que le moteur redevient joignable, sans action de l'utilisateur ;
- l'acces depuis l'exterieur du domicile doit exister sans exiger de configuration du routeur, et doit fonctionner meme lorsque l'operateur ne fournit pas d'adresse publique dediee ;
- **aucun tiers ne doit pouvoir lire les images en transit** : un acces distant qui ferait dechiffrer le flux par un intermediaire est exclu, quel que soit son confort d'usage ;
- l'acces distant ne doit rendre joignable **que le produit** : les cameras et les composants internes ne doivent jamais devenir atteignables depuis l'exterieur ;
- l'acces distant doit rester **optionnel, gratuit dans son parcours nominal et retirable** ; le produit doit rester entier sans lui, et l'usage local ne doit jamais dependre de sa disponibilite ;
- si l'acces distant repose sur un service tiers, l'interface doit guider l'utilisateur pas a pas, l'annoncer explicitement, et indiquer que sa disponibilite ne depend pas de Vyzio ;
- l'acces distant doit se presenter comme un reglage d'installation ordinaire : etat visible, activation et retrait depuis l'interface, sans manipulation de fichier ;
- le moteur de detection interne doit s'adapter automatiquement au materiel disponible (accelerateur dedie, puis carte graphique, puis processeur en dernier recours), sans configuration manuelle ; en l'absence d'accelerateur dedie ou de carte graphique, la frequence d'analyse est reduite automatiquement selon le nombre de cameras actives, dans une plage bornee garantissant une detection utile sans saturer le processeur.

### 7.3 Planification de la maison

> **En tant qu'utilisateur**, je veux voir et regler a un seul endroit tout ce qui se passe a heure fixe dans la maison, afin de ne pas le recreer camera par camera ni canal par canal.

- tout ce qui est programme dans la maison se planifie, se voit et se modifie a un seul endroit, la **Planification**, une rubrique des reglages ; ajouter un nouveau type de plage n'ajoute ni formulaire ni ecran : l'ecran d'une plage est le meme pour tous les types, seules changent les cibles proposees et l'effet annonce ;
- la semaine s'y lit d'un coup d'oeil, comme un calendrier : un jour par ligne, du lundi au dimanche, chacun sur ses 24 heures, chaque plage posee a ses heures, concue pour le telephone d'abord ; le moment present y est marque, a l'heure de la maison ; une plage peut passer minuit (22h a 6h) : elle appartient au jour ou elle commence et se termine le lendemain, ce que l'ecran de la plage dit en clair, et la semaine la montre se prolonger sur le lendemain, pour qu'on ne manque pas une coupure en cours en lisant un seul jour ; toucher une plage l'ouvre ;
- une plage vide (debut = fin), sans jour, sans cible ou mal formee est refusee avec une phrase qui dit quoi changer, jamais comme une erreur du serveur ;
- chaque plage a un **type** qui dit ce qu'elle fait, et deux types ne se confondent jamais : une plage **Vie privee** coupe les cameras visees (aucun enregistrement, aucune detection, aucune notification, §9.2) ; une plage **Sans notification** laisse filmer et enregistrer et fait seulement taire l'envoi sur les canaux vises (§5.2). Le type se lit a son nom et a son icone, jamais a la seule couleur, et son effet reste visible pendant qu'on regle la plage ;
- une plage vise plusieurs choses a la fois, plusieurs cameras ou plusieurs canaux, qu'elle nomme ; viser toutes les cameras revient a cocher celles qui existent, une camera ajoutee ensuite n'est pas visee d'office ; une plage dont toutes les cibles ont disparu reste visible, sans effet, et le dit ;
- une camera ou un canal dit combien de plages s'appliquent a lui, avec le chemin vers la Planification ; la bascule manuelle (couper une camera maintenant) reste sur la camera et garde sa priorite (§9.2) : la planification ne fait que programmer ;
- les heures sont celles de la maison, jamais celles de l'appareil qui consulte, et l'ecran le dit ;
- une plage se modifie avec le meme cycle qu'un reglage (§7.2) : rien ne change avant d'avoir enregistre, et l'on peut renoncer.

---

## 8. Securite et confidentialite

### 8.1 User stories

> **En tant qu'utilisateur**, je veux que mes images ne quittent pas mon reseau sans mon accord explicite.

> **En tant qu'utilisateur**, je veux proteger l'acces a mon systeme, afin qu'un tiers local ne puisse pas consulter mes donnees.

> **En tant qu'utilisateur**, je veux que mon telephone reste connecte, afin de ne pas ressaisir un mot de passe chaque fois que je jette un oeil a mes cameras.

> **En tant qu'utilisateur**, je veux pouvoir deconnecter un appareil perdu, afin qu'il cesse d'acceder a mes images.

> **En tant qu'utilisateur**, je veux pouvoir changer mon mot de passe, afin de reprendre son acces a qui l'aurait appris.

> **En tant qu'utilisateur**, je veux pouvoir revenir dans mon installation apres avoir oublie mon mot de passe, sans perdre mes cameras ni mon historique.

> **En tant qu'utilisateur**, je veux pouvoir supprimer ou exporter mes donnees, afin de garder le controle.

### 8.2 Regles produit

- aucune transmission d'image ou de donnee sensible ne doit etre activee par defaut vers un service tiers ;
- aucun compte cloud ne doit etre obligatoire pour le fonctionnement nominal local ;
- l'acces a l'interface et aux donnees doit etre protege ;
- les fonctions d'acces distant doivent etre explicites, optionnelles et desactivables ;
- l'utilisateur doit pouvoir supprimer ses donnees produit dans un parcours comprensible.

### 8.3 Acces a l'interface

Comment cet acces est protege : [ADR-54](adr/0054-interface-access-guarded-by-an-owner-account-server-session-in-a-cookie.md).

- une installation neuve **s'ouvre sur la creation du mot de passe** du proprietaire : c'est la premiere etape, avant l'ajout d'une camera, et elle ne se saute pas ;
- une fois connecte, l'utilisateur le reste : rouvrir l'interface depuis le meme appareil ne redemande rien pendant plusieurs semaines ;
- se deconnecter est possible depuis l'interface, et **deconnecter tous les appareils** l'est aussi — c'est le geste attendu quand un telephone est perdu ;
- une session terminee ramene a l'ecran de connexion en le disant, jamais sur un ecran vide ou une erreur technique ;
- **changer son mot de passe** se fait dans l'interface : l'ancien est redemande, et le changement referme toutes les sessions ouvertes ailleurs ;
- un mot de passe oublie se remet a zero **depuis la machine qui heberge Vyzio**, sans compte cloud ni envoi de courriel. La remise a zero *retire* le mot de passe : l'installation reouvre sur l'ecran de choix pendant une demi-heure, sans rien perdre de ses cameras ni de son historique, puis se reverrouille si personne n'en choisit un ;
- l'appairage d'une conversation de messagerie reste independant : il n'ouvre pas l'interface, et une session n'appaire pas une conversation (§5.4).

Deux roles existent, et un seul est livre pour l'instant — le **proprietaire**. Le second, **resident**, est prevu : il consulte le direct et l'historique et peut couper une camera, mais ne touche ni aux reglages ni aux secrets. La frontiere est **utiliser / configurer**, jamais « voir / ne pas voir » : un resident voit deja toutes les images.

---

## 9. Mode vie privee

### 9.1 User stories

> **En tant qu'utilisateur**, je veux couper une camera instantanement, afin d'etre certain qu'aucune image de moi ou de mon foyer n'est capturee ni enregistree.

> **En tant qu'utilisateur**, je veux planifier l'arret automatique d'une ou de plusieurs cameras a la fois sur des plages horaires recurrentes (ex. les cameras interieures tous les soirs de 22h a 6h), afin de ne pas avoir a y penser chaque jour.

> **En tant qu'utilisateur**, je veux voir clairement quelle camera est en mode vie privee, afin de savoir a tout moment ce qui surveille et ce qui ne surveille pas.

> **En tant qu'utilisateur**, je veux que la camera soit vraiment eteinte et pas uniquement silencieuse, afin d'avoir la certitude qu'aucun flux n'est accessible, ni par Frigate, ni par Vyzio, ni par personne d'autre sur le reseau.

> **En tant qu'utilisateur**, je veux basculer plusieurs cameras en mode vie privee simultanement (ex. "tout eteindre d'un coup"), afin de ne pas devoir repeter l'action camera par camera.

> **En tant qu'utilisateur**, je veux que mon choix soit maintenu apres un redemarrage du systeme, afin de ne pas devoir reconfigurer la vie privee a chaque fois.

### 9.2 Regles fonctionnelles

- le mode vie privee doit empecher toute ingestion du flux camera par le moteur de detection ; aucun enregistrement, aucune detection, aucune notification ne doit etre genere pour une camera en mode vie privee ;
- le flux RTSP de la camera ne doit pas etre accessible depuis Vyzio ni depuis Frigate pendant la periode de vie privee ;
- le mode vie privee peut etre active manuellement (bascule instantanee) ou via une plage recurrente (jours de la semaine + heures de debut et de fin) planifiee dans la planification de la maison (§7.3), qui peut viser plusieurs cameras a la fois ;
- le statut vie privee de chaque camera doit etre clairement visible dans l'interface (icone ou badge distinct de l'etat "hors ligne") ; le badge dit ce que la camera a repondu, jamais ce que la strategie promet : "Coupure materielle confirmee" quand la camera a confirme la coupure, "Camera orientee, enregistrement desactive" quand elle a accepte le mouvement vers sa position Parking, "Enregistrement desactive" quand rien n'est demande a la camera ou que sa reponse n'est pas arrivee ;
- quand la camera ne suit pas (coupure ou mouvement refuse, camera qui ne repond pas, position non enregistree, capacite non verifiee), l'enregistrement reste coupe (ADR-20) et l'interface le dit : le badge nomme ce qui n'a pas eu lieu ("Camera non tournee, enregistrement desactive" pour le parking, "Objectif non coupe, enregistrement desactive" pour la coupure materielle), la vignette le signale avec un lien vers l'ecran vie privee de la camera, et cet ecran affiche une phrase qui dit ce qui s'est passe et quoi faire, avec le detail technique (§1.5) ; de meme a la desactivation, quand la camera ne revient pas sur sa position Surveillance ; quand la demande est interrompue avant la reponse de la camera, l'interface dit que Vyzio ne sait pas ce qu'elle a fait, sans pretendre qu'elle a refuse ;
- la vignette d'une camera en mode vie privee affiche un etat explicite, avec les mots du badge, plutot qu'un echec de chargement ; la vue live ne s'ouvre pas tant que dure le mode vie privee ;
- en cas de conflit entre une activation manuelle et une plage, l'activation manuelle est prioritaire : une plage ne peut pas reactiver automatiquement une camera desactivee manuellement ; l'utilisateur doit reactiver manuellement pour revenir au pilotage automatique ;
- l'etat du mode vie privee doit survivre a un redemarrage du systeme (persistance) ;
- la desactivation du mode vie privee (manuelle ou fin de plage) doit restaurer le flux camera sans intervention utilisateur supplementaire ;
- l'interface doit permettre d'activer ou de desactiver le mode vie privee sur plusieurs cameras simultanement (selection multiple ou action globale "tout couper / tout reactiver"), sans reload Frigate separe par camera — un seul rechargement pour l'ensemble de la selection.

### 9.3 Stratégie de coupure par caméra (PTZ parking)

> **En tant qu'utilisateur avec une caméra PTZ**, je veux qu'elle pivote physiquement à l'activation du mode vie privée, afin d'avoir un signal visuel et physique que la caméra ne capture plus ma pièce.

> **En tant qu'utilisateur**, je veux choisir la stratégie de mode vie privée pour chaque caméra (logiciel, parking PTZ, ou cache matériel si disponible), afin d'adapter le niveau de protection aux capacités de chaque modèle.

> **En tant qu'utilisateur avec une caméra PTZ**, je veux définir la position de surveillance depuis l'interface en orientant la caméra manuellement puis en cliquant "Enregistrer", afin que Vyzio sache toujours où la ramener après le mode vie privée.

> **En tant qu'utilisateur**, je veux gérer plusieurs positions nommées pour ma caméra PTZ — au minimum une position de surveillance et une position de parking — afin de personnaliser les zones couvertes sans devoir repositionner la caméra manuellement à chaque usage.

**Règles fonctionnelles :**

- chaque caméra peut avoir une stratégie de mode vie privée indépendante : `software_blur` (« Arrêt logiciel », désactivation Frigate uniquement), `ptz_parking` (mouvement physique + désactivation Frigate), `hardware` (coupure native firmware, ex. Tapo) ;
- `software_blur` est la stratégie par défaut d'une caméra ; il n'existe pas de stratégie « aucune » : le mode vie privée arrête toujours au moins l'enregistrement, la détection et les notifications de Vyzio (§9.2), et chaque stratégie ajoute ce que la caméra fait en plus ;
- l'option `ptz_parking` ne peut être choisie que si l'orientation de la caméra est vérifiée et activée (capacité détectée automatiquement à l'onboarding et configurable manuellement) et une fois les positions Surveillance (preset 1) et Parking (preset 2) enregistrées ; l'option `hardware` ne peut être choisie que si la coupure matérielle de la caméra est vérifiée (§2.3) ; une stratégie qui ne peut pas encore être choisie reste dans la liste, grisée, avec la raison et l'endroit où y remédier (enregistrer les positions, vérifier ou essayer la capacité), jamais retirée ([DESIGN SYSTEM](DESIGN%20SYSTEM.md) § Settings screens) ;
- l'écran vie privée ne dit que ce que fait la stratégie choisie ; quand celle-ci ne peut plus agir (positions ou capacité manquantes), il dit ce qui manque et ce qui reste garanti en attendant, sans promettre son effet ;
- le mode `ptz_parking` est **toujours cumulatif avec le fallback software** : la caméra pivote vers sa position Parking (preset 2) ET Frigate est désactivé ; la double couche garantit la protection même si le mouvement PTZ échoue ; à la désactivation, la caméra revient sur sa position Surveillance (preset 1) et l'enregistrement reprend, même si ce retour échoue, ce que l'interface dit (§9.2) ;
- l'utilisateur doit pouvoir définir la position de surveillance (preset "home") via des contrôles PTZ live dans l'interface — une fois orientée, il clique "Définir comme position de surveillance" ;
- si une caméra PTZ est détectée à l'onboarding, le parcours d'ajout doit proposer une étape de configuration du mode vie privée et des positions Surveillance et Parking avant de terminer ; une orientation à confirmer n'ouvre pas cette étape : l'utilisateur l'essaie d'abord depuis sa carte (§2.3), puis règle ses positions depuis la vue live ;
- lorsque l'utilisateur sélectionne la stratégie `ptz_parking`, l'interface doit afficher un avertissement explicite précisant que le flux vidéo reste techniquement accessible sur le réseau local — seul Vyzio est désactivé et la caméra pivote vers sa position Parking ; cet avertissement est un pré-requis non négociable avant d'enregistrer le choix ;
- la gestion des positions PTZ expose au minimum 4 slots : **preset 1** (Surveillance — ramener la caméra vers la zone surveillée nominale), **preset 2** (Parking vie privée — position de stationnement lors de l'activation du mode vie privée), **presets 3 et 4** personnalisables par l'utilisateur ; les presets 1 et 2 ont des labels fixes, les presets 3 et 4 ont un label libre ;
- la disponibilité des presets est indépendante du protocole de la caméra : Vyzio gère les positions par un mécanisme de homing + mesure du temps de mouvement pour les caméras qui ne supportent pas les presets natifs (voir [ADR-59](adr/0059-ptz-positions-resolved-above-the-protocol-providers-only-move.md) et [ADR-60](adr/0060-ptz-positions-are-counted-in-motion-time-on-a-session-held-for-each-move.md)) ;
- la capacité Orientation de la caméra dit, dans ses options, où sont gardées ses positions : par la caméra elle-même, ou par Vyzio quand la caméra ne sait pas les garder ; dans ce second cas, elle dit que les positions sont moins fiables et qu'il faut calibrer la caméra après chaque démarrage de Vyzio, depuis la vue live.

### 9.4 Miniatures de positions PTZ

> **En tant qu'utilisateur**, je veux voir une miniature de la vue caméra associée à chaque position PTZ enregistrée, afin d'identifier visuellement la zone couverte sans devoir y naviguer.

**Règles fonctionnelles :**

- chaque preset PTZ configuré doit afficher une miniature de la vue caméra à la position enregistrée ;
- la miniature est capturée automatiquement après chaque déplacement GoTo vers un preset demandé depuis l'interface, une fois la caméra arrivée à destination ; les déplacements du mode vie privée n'en prennent aucune ;
- la miniature est persistée côté serveur et survit à un rechargement de l'interface ;
- la première miniature n'est disponible qu'après le premier GoTo — aucun placeholder générique n'est affiché avant ;
- la capture est déclenchée après le retour de la commande GoTo (attendre un délai court pour laisser la caméra atteindre physiquement sa position) ;
- la miniature est mise à jour à chaque nouveau GoTo, quelle que soit la vue depuis laquelle l'utilisateur navigue (fiche caméra ou modale live).

---

## 10. Reglages image avances

> **En tant qu'utilisateur**, je veux ajuster la luminosite, le contraste et la vision nocturne (IR) de mes cameras directement depuis Vyzio, afin de ne pas devoir ouvrir l'application du constructeur pour un simple reglage image.

> **En tant qu'utilisateur**, je veux que ce reglage soit une capacite testee comme les autres (PTZ, vie privee materielle), afin de ne pas me proposer un controle qui ne fonctionnera pas sur ma camera.

**Regles fonctionnelles :**

- les reglages image (luminosite, contraste, saturation, nettete, mode vision nocturne infrarouge) sont une **capacite** au sens de la §2.3 : independante de la marque, testee reellement avant d'etre proposee, jamais activee sur simple declaration ;
- les valeurs affichees et modifiables sont lues et ecrites en direct sur la camera — Vyzio ne stocke pas de copie locale des reglages, la camera reste la source de verite ;
- si la camera est hors ligne, le panneau de reglages image doit etre suspendu avec un message explicite (meme regle que PTZ, cf. §2.2) ;
- une camera dont la capacite reglages image n'est pas verifiee ne doit pas afficher le panneau de controle, quelle que soit sa marque ;
- le mode vision nocturne expose au minimum trois etats comprehensibles pour un non-technicien : automatique, force actif, force inactif.

---

## 11. Pilotage PTZ

> **En tant qu'utilisateur**, je veux pouvoir contrôler ma caméra PTZ directement depuis la vue live, sans passer par un menu de configuration, afin de réorienter la caméra facilement au quotidien.

**Règles fonctionnelles :**

- les contrôles PTZ doivent être accessibles depuis la vue live de la caméra (pas seulement depuis les paramètres) : c'est le parcours d'usage quotidien ;
- si la caméra est hors ligne, les contrôles sont suspendus avec un message explicite (cf. §2.2) ;
- les contrôles et les positions n'apparaissent, dans la vue live comme dans la section Pilotage des réglages de la caméra, que si l'orientation fonctionne, prouvée ou confirmée par l'utilisateur (§2.3) ; tant qu'elle ne fonctionne pas, aucune commande inerte : une ligne renvoie vers la page « Connexion » de la caméra, où sa carte dit pourquoi et comment en sortir ([DESIGN SYSTEM](DESIGN%20SYSTEM.md) § Capability cards) ;
- certaines caméras tournent à l'envers de la flèche pressée (leur firmware inverse le sens horizontal) : l'utilisateur peut inverser gauche et droite sur la capacité PTZ de la caméra ; Vyzio ne devine pas ce sens, et le réglage ne change ni le haut et le bas, ni les positions enregistrées ;
- les positions enregistrées et leurs miniatures sont décrites en §9.3 et §9.4.

---

## 12. Perimetre MVP

### 12.1 Inclus dans le MVP

- ajout et gestion de cameras existantes ;
- surveillance locale avec notifications sur evenements prioritaires ;
- gestion de profils connus ;
- historique consultable et retention configurable ;
- interface web unifiee pour les parcours principaux.

### 12.2 Hors MVP initial

- couverture exhaustive de tous les usages experts d'un NVR ;
- exposition de chaque capacite avancee dans une UI Vyzio 100 % custom ;
- automatisations complexes et scenarios tres specialises ;
- experiences distantes avancees qui compliquent la promesse locale par defaut.

---

## 13. Criteres de succes produit

- un utilisateur non-tech doit pouvoir comprendre la promesse, installer le systeme et recevoir ses premieres notifications sans lire de documentation technique ;
- le systeme doit rester utile meme sans connexion Internet ;
- les notifications doivent etre suffisamment pertinentes pour ne pas degrader la confiance utilisateur ;
- la frontiere entre comportement local par defaut et options distantes doit rester explicite a chaque etape.
