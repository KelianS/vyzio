# Vyzio — Specifications Fonctionnelles

> Mai 2026 — document vivant

---

## Role du document

Ce document decrit le **besoin produit** et le **comportement attendu** du systeme du point de vue utilisateur.

Il ne tranche pas les choix de stack, d'algorithmes, de protocoles internes ou d'architecture detaillee. Ces points vivent dans [SAD.md](./SAD.md).

---

## 1. Vue d'ensemble

### 1.1 Promesse produit

Vyzio est une solution de video-surveillance local-first, pensee pour un public non-technicien. Le systeme doit permettre d'ajouter des cameras existantes, surveiller les zones utiles, reconnaitre des personnes connues, signaler les evenements importants et laisser les donnees sous le controle de l'utilisateur.

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

---

## 2. Parcours camera

### 2.1 User stories

> **En tant qu'utilisateur**, je veux que Vyzio m'aide a connecter mes cameras sans devoir connaitre leur configuration reseau.

> **En tant qu'utilisateur**, je veux nommer clairement chaque camera, afin de comprendre immediatement l'origine d'une alerte.

> **En tant qu'utilisateur**, je veux definir des zones utiles sur l'image, afin d'ignorer les zones non pertinentes.

> **En tant qu'utilisateur**, je veux etre informe si une camera devient indisponible, afin de savoir que la surveillance n'est plus fiable.

> **En tant qu'utilisateur**, je veux verifier rapidement le flux d'une camera depuis l'interface, afin de confirmer que tout fonctionne.

> **En tant qu'utilisateur**, je veux que Vyzio reconnaisse le type probable de ma camera et m'explique quoi activer, afin de finir l'integration sans connaissance technique du constructeur.

> **En tant qu'utilisateur**, je veux savoir si mon modele fait partie des cameras officiellement supportees, afin d'avoir un niveau de confiance clair sur le parcours propose.

> **En tant qu'utilisateur**, je veux pouvoir integrer une camera qui ne supporte pas le RTSP nativement (ex. camera sur batterie ICSee/XMEye), afin de ne pas etre bloque par les limitations du protocole du fabricant.

> **En tant qu'utilisateur**, je veux qu'un boitier a plusieurs objectifs apparaisse comme plusieurs cameras que je nomme separement, afin de retrouver chaque angle de vue par son nom dans mes alertes.

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
- le produit doit exposer une liste des constructeurs ou modeles officiellement supportes et l'utiliser pour rassurer l'utilisateur pendant l'onboarding ;
- chaque camera doit avoir un nom, un statut visible et une configuration editable ;
- l'utilisateur doit pouvoir definir plusieurs zones actives par camera ;
- une perte de flux doit etre detectee et visible sans diagnostic technique avance ;
- lorsqu'une camera est hors ligne, l'interface doit le refleter immediatement : le flux live ne doit pas tenter de se charger, et les actions qui requierent une connexion active (controle PTZ, test de capacite) doivent etre suspendues avec un message explicite ;
- une camera designe **une seule scene** ; un boitier exposant plusieurs objectifs donne autant de cameras, nommables et configurables independamment, mais reconnaissables comme appartenant au meme appareil ;
- lorsqu'une camera expose plusieurs flux de la meme scene, le produit doit les presenter avec leur resolution quand elle est connue, et laisser l'utilisateur choisir celui qui sert a l'analyse ;
- ce choix doit etre accompagne d'une explication de ce qu'il change concretement (fluidite du systeme d'un cote, finesse de l'image analysee — donc reconnaissance des visages, vignette et images d'alerte — de l'autre) ; il n'est jamais impose silencieusement ;
- par defaut, c'est le flux le plus leger qui est analyse : le moteur de detection reduit l'image de toute facon, donc analyser un flux tres detaille coute des ressources sans rien apporter ; ce defaut doit etre annonce comme tel dans l'interface, et le flux detaille doit rester accessible en un geste pour qui veut privilegier la reconnaissance des visages ;
- le choix du flux d'analyse ne doit jamais degrader les enregistrements, qui restent faits sur le flux de meilleure qualite.

### 2.3 Catalogue de capacites et cameras non repertoriees

> **En tant qu'utilisateur**, je veux que les fonctionnalites avancees (PTZ, mode vie privee materiel, etc.) ne dependent pas de la marque de ma camera mais de ce qu'elle sait reellement faire, afin de ne pas etre prive d'une fonctionnalite uniquement parce que ma marque n'est pas dans la liste officielle.

> **En tant qu'utilisateur dont la camera n'est pas dans la liste des modeles officiellement supportes**, je veux pouvoir suivre un parcours de configuration manuelle plus long pour activer les memes fonctionnalites qu'une camera supportee, afin de profiter pleinement du produit sans devoir changer de materiel.

> **En tant qu'utilisateur**, je veux que Vyzio teste reellement une capacite avant de me la proposer (ex. sonder le PTZ), afin de ne jamais me laisser activer une option qui ne fonctionnera pas sur ma camera.

**Regles fonctionnelles :**

- les fonctionnalites avancees (flux video, PTZ, mode vie privee materiel, reglages image, reglages de flux, info systeme a venir) sont des **capacites independantes de la marque** ; une marque "officiellement supportee" est une marque pour laquelle Vyzio sait deja quelles capacites sont disponibles et comment les activer (preconfiguration), pas une marque qui beneficie de fonctionnalites reservees ;
- une camera non repertoriee doit pouvoir acceder aux memes capacites qu'une camera supportee, a condition que son materiel le permette reellement ; le parcours est plus long (declaration et verification manuelle des capacites) mais jamais bloquant par principe ;
- pour une camera non repertoriee, l'utilisateur doit pouvoir declarer manuellement, capacite par capacite, comment y acceder (ex. protocole PTZ : ONVIF ou DVRIP, avec ses parametres de connexion) ; Vyzio doit verifier la capacite par un test reel avant de la proposer activable dans l'interface — jamais sur simple declaration non verifiee ;
- si une capacite ne peut pas etre verifiee ou echoue au test, l'interface doit l'indiquer clairement et ne pas la presenter comme disponible ;
- le statut "officiellement supporte" reste affiche et utilise pour rassurer l'utilisateur (cf. 2.2) ; le parcours manuel est presente comme une alternative pour les cameras absentes de cette liste, pas comme le parcours par defaut ;
- lorsque Vyzio modifie de sa propre initiative un reglage de la camera pour ameliorer les performances du systeme (et non a la demande de l'utilisateur), il doit memoriser la valeur d'origine et pouvoir la restaurer si la fonction est desactivee ou la camera retiree ; une telle modification ne doit jamais degrader la qualite des enregistrements.

---

## 3. Detection et reconnaissance

### 3.1 User stories

> **En tant qu'utilisateur**, je veux etre alerte lorsqu'une personne connue est detectee, afin de savoir qui arrive.

> **En tant qu'utilisateur**, je veux etre alerte lorsqu'un visage inconnu apparait, afin de pouvoir reagir vite.

> **En tant qu'utilisateur**, je veux choisir quels types de detection doivent generer des evenements utiles, afin d'adapter le systeme a mon contexte (personnes, animaux, vehicules, etc.).

> **En tant qu'utilisateur**, je veux eviter les alertes inutiles, afin que le systeme reste credibile au quotidien.

> **En tant qu'utilisateur**, je veux pouvoir confirmer ou corriger une reconnaissance, afin d'ameliorer la qualite du systeme dans le temps.

### 3.2 Regles fonctionnelles

- la surveillance doit distinguer au minimum les evenements prioritaires des evenements de bruit ;
- l'utilisateur doit pouvoir configurer les types de detection Frigate pris en compte dans le flux produit ;
- la configuration doit permettre au minimum d'activer ou desactiver des categories comme les personnes, animaux ou vehicules selon les capacites fournies par Frigate ;
- un evenement reconnu doit indiquer la camera, l'heure et l'identite estimee si disponible ;
- un evenement incertain doit pouvoir etre presente comme tel, sans sur-promettre une certitude ;
- l'utilisateur doit pouvoir corriger une reconnaissance depuis un parcours simple ;
- le produit doit privilegier la pertinence des alertes plutot que la quantite.

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

> **En tant qu'utilisateur**, je veux choisir le comportement d'alerte associe a une personne, afin d'adapter le systeme a mon foyer.

> **En tant qu'utilisateur**, je veux voir la derniere apparition d'une personne connue, afin de garder un historique simple.

> **En tant qu'utilisateur**, je veux supprimer un profil et ses donnees associees, afin de rester maitre de mes donnees.

### 4.2 Attendus fonctionnels

- un profil doit contenir au minimum un nom, des donnees de reference suffisantes et une politique d'alerte ;
- les profils doivent etre modifiables et supprimables depuis l'interface ;
- l'historique recent d'une personne connue doit etre consultable ;
- la suppression d'un profil doit supprimer ses donnees liees selon la politique produit definie.

---

## 5. Notifications

### 5.1 User stories

> **En tant qu'utilisateur**, je veux recevoir une notification utile sur mon telephone quand un evenement important se produit.

> **En tant qu'utilisateur**, je veux pouvoir voir rapidement le contexte de l'evenement sans devoir fouiller dans l'interface.

> **En tant qu'utilisateur**, je veux regler les horaires et le niveau de bruit des alertes, afin d'eviter la fatigue de notification.

> **En tant qu'utilisateur**, je veux continuer a etre informe meme si je n'ai pas l'interface ouverte.

> **En tant qu'utilisateur**, je veux configurer mes destinations de notification depuis l'interface, afin de ne jamais modifier un fichier a la main.

> **En tant qu'utilisateur**, je veux etre guide pour configurer un canal, tester l'envoi et comprendre les compromis du canal choisi.

> **En tant qu'utilisateur**, je veux choisir quelles categories d'evenements meritent une alerte et quel niveau de bruit appliquer selon le contexte.

> **En tant qu'utilisateur**, je veux choisir les informations affichees dans le message, afin de recevoir un contenu utile sans surcharge.

> **En tant qu'utilisateur hors de chez moi**, je veux repondre a une alerte par une action — voir la camera, couper la surveillance, verifier l'etat — sans avoir a joindre l'interface.

> **En tant qu'utilisateur**, je veux retrouver les memes commandes quel que soit le canal de messagerie que j'utilise, afin de ne pas reapprendre le produit en changeant de canal.

### 5.2 Attendus fonctionnels

- le produit doit supporter au moins un canal de notification utilisable par un public non-tech ;
- plusieurs canaux pourront coexister selon les besoins utilisateur ;
- chaque notification importante doit contenir un contexte minimum : type d'evenement, camera, heure, apercu si autorise ;
- l'utilisateur doit pouvoir regler des plages horaires et un niveau minimal d'alerte ;
- si une dependance reseau externe est necessaire pour un canal, ce compromis doit etre explicite et opt-in ;
- la configuration des canaux retenus doit etre lisible, modifiable et testable depuis l'interface Vyzio ;
- chaque canal propose doit etre couvert de bout en bout : saisie de ce qu'il demande, verification, etat configure / non configure, test d'envoi ;
- ajouter un canal ne doit pas ajouter un ecran : les canaux se reglent avec la meme grammaire, seule la facon de s'y connecter change ;
- le produit doit permettre de regler au minimum les destinations actives, les categories d'evenements notifiees, le niveau minimal d'alerte et les plages horaires associees ;
- le produit doit permettre de choisir un format de message simple, avec au minimum camera, heure, type d'evenement, identite si connue et apercu si autorise ;
- les reglages doivent etre persistants cote Vyzio et ne pas dependre d'une edition manuelle du runtime ;
- les capacites et limites d'un canal doivent etre explicites dans l'interface avant activation.

### 5.3 Regles hors ligne

- la surveillance locale doit continuer sans Internet ;
- une indisponibilite reseau ne doit pas empecher l'enregistrement local des evenements ;
- lorsqu'un canal externe revient, les regles de reprise doivent eviter les rafales d'alertes inutiles.

### 5.4 Commandes depuis le canal de messagerie

- le canal de messagerie doit fonctionner **dans les deux sens** : recevoir des alertes, et accepter des commandes ;
- les commandes doivent couvrir l'usage courant a distance — etat du systeme, apercu d'une camera, dernieres detections, mode vie privee, positions PTZ, interruption et reprise de la surveillance — de sorte qu'un acces reseau au produit reste **optionnel** ;
- une meme commande doit se comporter de la meme facon sur tous les canaux ; seule sa presentation s'adapte a ce que le canal sait afficher ;
- **la configuration ne se fait pas depuis un canal de messagerie** : un fil de discussion ne peut porter ni brouillon, ni provenance d'une valeur, ni retour arriere (cf. §7.2) ; les reglages restent dans l'interface ;
- seule une conversation appairee explicitement depuis l'interface doit etre acceptee ; l'appairage doit etre revocable, et un message d'une autre origine doit rester sans reponse ;
- une action aux consequences visibles — couper la surveillance, lever le mode vie privee — doit demander une confirmation explicite avant de prendre effet ;
- un canal de messagerie transporte des images fixes et des clips, jamais un flux video continu ;
- l'utilisateur doit pouvoir consulter la trace des commandes recues et de leur issue.

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

- l'accueil doit rendre visible l'etat global du systeme et les alertes recentes ;
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

---

## 8. Securite et confidentialite

### 8.1 User stories

> **En tant qu'utilisateur**, je veux que mes images ne quittent pas mon reseau sans mon accord explicite.

> **En tant qu'utilisateur**, je veux proteger l'acces a mon systeme, afin qu'un tiers local ne puisse pas consulter mes donnees.

> **En tant qu'utilisateur**, je veux pouvoir supprimer ou exporter mes donnees, afin de garder le controle.

### 8.2 Regles produit

- aucune transmission d'image ou de donnee sensible ne doit etre activee par defaut vers un service tiers ;
- aucun compte cloud ne doit etre obligatoire pour le fonctionnement nominal local ;
- l'acces a l'interface et aux donnees doit etre protege ;
- les fonctions d'acces distant doivent etre explicites, optionnelles et desactivables ;
- l'utilisateur doit pouvoir supprimer ses donnees produit dans un parcours comprensible.

---

## 9. Mode vie privee

### 9.1 User stories

> **En tant qu'utilisateur**, je veux couper une camera instantanement, afin d'etre certain qu'aucune image de moi ou de mon foyer n'est capturee ni enregistree.

> **En tant qu'utilisateur**, je veux planifier l'arret automatique d'une camera sur des plages horaires recurrentes (ex. tous les soirs de 22h a 6h), afin de ne pas avoir a y penser chaque jour.

> **En tant qu'utilisateur**, je veux voir clairement quelle camera est en mode vie privee, afin de savoir a tout moment ce qui surveille et ce qui ne surveille pas.

> **En tant qu'utilisateur**, je veux que la camera soit vraiment eteinte et pas uniquement silencieuse, afin d'avoir la certitude qu'aucun flux n'est accessible, ni par Frigate, ni par Vyzio, ni par personne d'autre sur le reseau.

> **En tant qu'utilisateur**, je veux basculer plusieurs cameras en mode vie privee simultanement (ex. "tout eteindre d'un coup"), afin de ne pas devoir repeter l'action camera par camera.

> **En tant qu'utilisateur**, je veux que mon choix soit maintenu apres un redemarrage du systeme, afin de ne pas devoir reconfigurer la vie privee a chaque fois.

### 9.2 Regles fonctionnelles

- le mode vie privee doit empecher toute ingestion du flux camera par le moteur de detection ; aucun enregistrement, aucune detection, aucune notification ne doit etre genere pour une camera en mode vie privee ;
- le flux RTSP de la camera ne doit pas etre accessible depuis Vyzio ni depuis Frigate pendant la periode de vie privee ;
- le mode vie privee peut etre active manuellement (bascule instantanee) ou via une planification recurrente (jours de la semaine + plage horaire) ;
- le statut vie privee de chaque camera doit etre clairement visible dans l'interface (icone ou badge distinct de l'etat "hors ligne") ; le libelle du badge doit reflechir la strategie active ("Cache objectif", "Camera orientee — enregistrement desactive", "Enregistrement desactive") ;
- la vue live d'une camera en mode vie privee doit afficher un etat explicite ("Camera en pause — vie privee") plutot qu'un echec de chargement ;
- une planification ne doit pas pouvoir etre creee sans plage horaire valide (heure de debut < heure de fin ou gestion explicite du passage minuit) ;
- en cas de conflit entre une activation manuelle et une planification, l'activation manuelle est prioritaire : la planification ne peut pas reactivation automatiquement une camera desactivee manuellement ; l'utilisateur doit reactiver manuellement pour revenir au pilotage automatique ;
- l'etat du mode vie privee doit survivre a un redemarrage du systeme (persistance) ;
- la desactivation du mode vie privee (manuelle ou fin de planification) doit restaurer le flux camera sans intervention utilisateur supplementaire ;
- l'interface doit permettre d'activer ou de desactiver le mode vie privee sur plusieurs cameras simultanement (selection multiple ou action globale "tout couper / tout reactiver"), sans reload Frigate separe par camera — un seul rechargement pour l'ensemble de la selection.

### 9.3 Stratégie de coupure par caméra (PTZ parking)

> **En tant qu'utilisateur avec une caméra PTZ**, je veux qu'elle pivote physiquement à l'activation du mode vie privée, afin d'avoir un signal visuel et physique que la caméra ne capture plus ma pièce.

> **En tant qu'utilisateur**, je veux choisir la stratégie de mode vie privée pour chaque caméra (logiciel, parking PTZ, ou cache matériel si disponible), afin d'adapter le niveau de protection aux capacités de chaque modèle.

> **En tant qu'utilisateur avec une caméra PTZ**, je veux définir la position de surveillance depuis l'interface en orientant la caméra manuellement puis en cliquant "Enregistrer", afin que Vyzio sache toujours où la ramener après le mode vie privée.

> **En tant qu'utilisateur**, je veux pouvoir contrôler ma caméra PTZ directement depuis la vue live, sans passer par un menu de configuration, afin de réorienter la caméra facilement au quotidien.

> **En tant qu'utilisateur**, je veux gérer plusieurs positions nommées pour ma caméra PTZ — au minimum une position de surveillance et une position de parking — afin de personnaliser les zones couvertes sans devoir repositionner la caméra manuellement à chaque usage.

**Règles fonctionnelles :**

- chaque caméra peut avoir une stratégie de mode vie privée indépendante : `"software"` (désactivation Frigate uniquement), `"ptz_parking"` (mouvement physique + désactivation Frigate), `"hardware"` (coupure native firmware, ex. Tapo) ;
- l'option `ptz_parking` n'est proposée que si la caméra supporte le PTZ — cette capacité doit être détectée automatiquement à l'onboarding et configurable manuellement ;
- le mode `ptz_parking` est **toujours cumulatif avec le fallback software** : la caméra pivote vers la butée mécanique ET Frigate est désactivé ; la double couche garantit la protection même si le mouvement PTZ échoue ;
- l'utilisateur doit pouvoir définir la position de surveillance (preset "home") via des contrôles PTZ live dans l'interface — une fois orientée, il clique "Définir comme position de surveillance" ;
- les contrôles PTZ doivent être accessibles depuis la vue live de la caméra (pas seulement depuis les paramètres) — c'est le parcours d'usage quotidien ;
- si une caméra PTZ est détectée à l'onboarding, le parcours d'ajout doit proposer une étape de configuration du mode vie privée et de la position de surveillance avant de terminer ;
- lorsque l'utilisateur sélectionne la stratégie `ptz_parking`, l'interface doit afficher un avertissement explicite précisant que le flux vidéo reste techniquement accessible sur le réseau local — seul Vyzio est désactivé et la caméra pivote vers une zone neutre ; cet avertissement est un pré-requis non négociable avant d'enregistrer le choix ;
- la gestion des positions PTZ expose au minimum 4 slots : **preset 1** (Surveillance — ramener la caméra vers la zone surveillée nominale), **preset 2** (Parking vie privée — position de stationnement lors de l'activation du mode vie privée), **presets 3 et 4** personnalisables par l'utilisateur ; les presets 1 et 2 ont des labels fixes, les presets 3 et 4 ont un label libre ;
- la disponibilité des presets est indépendante du protocole de la caméra : Vyzio gère les positions par un mécanisme de homing + comptage de pas pour les caméras qui ne supportent pas les presets natifs (voir [ADR-25](adr/0025-gestion-des-positions-ptz-presets-natifs-branch-a-vs.md)).

### 9.4 Miniatures de positions PTZ

> **En tant qu'utilisateur**, je veux voir une miniature de la vue caméra associée à chaque position PTZ enregistrée, afin d'identifier visuellement la zone couverte sans devoir y naviguer.

**Règles fonctionnelles :**

- chaque preset PTZ configuré doit afficher une miniature de la vue caméra à la position enregistrée ;
- la miniature est capturée automatiquement après chaque déplacement GoTo vers un preset, une fois la caméra arrivée à destination ;
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

## 11. Perimetre MVP

### 11.1 Inclus dans le MVP

- ajout et gestion de cameras existantes ;
- surveillance locale avec alertes sur evenements prioritaires ;
- gestion de profils connus ;
- historique consultable et retention configurable ;
- interface web unifiee pour les parcours principaux.

### 11.2 Hors MVP initial

- couverture exhaustive de tous les usages experts d'un NVR ;
- exposition de chaque capacite avancee dans une UI Vyzio 100 % custom ;
- automatisations complexes et scenarios tres specialises ;
- experiences distantes avancees qui compliquent la promesse locale par defaut.

---

## 12. Criteres de succes produit

- un utilisateur non-tech doit pouvoir comprendre la promesse, installer le systeme et recevoir ses premieres alertes sans lire de documentation technique ;
- le systeme doit rester utile meme sans connexion Internet ;
- les alertes doivent etre suffisamment pertinentes pour ne pas degrader la confiance utilisateur ;
- la frontiere entre comportement local par defaut et options distantes doit rester explicite a chaque etape.
