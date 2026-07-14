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

### 2.2 Attendus fonctionnels

- le systeme doit proposer un parcours guide d'ajout de camera ;
- la detection automatique est souhaitee quand elle est possible, avec une saisie manuelle en secours ;
- la decouverte reseau doit distinguer au minimum une camera confirmee, une camera probable et un equipement non qualifie ;
- chaque candidat detecte doit exposer au minimum un libelle de confiance compréhensible, une explication courte des signaux observes et, si possible, un constructeur ou une famille probable ;
- le niveau de confiance doit rester explicable : Vyzio ne doit pas afficher une precision arbitraire ou un score opaque sans justification lisible ;
- une camera detectee mais non encore exploitable doit rester visible dans un parcours d'assistance plutot que disparaitre silencieusement ;
- une camera confirmee doit etre clairement distinguable d'un simple equipement reseau joignable, afin d'eviter les faux positifs dans le parcours d'onboarding ;
- le produit doit guider l'utilisateur quand RTSP ou ONVIF doivent etre actives, avec une notice adaptee au constructeur detecte quand cette information est disponible ;
- pour les cameras dont le protocole natif n'est pas RTSP, le systeme doit proposer un mode d'integration alternatif transparent pour l'utilisateur, sans exiger de manipulation technique manuelle ;
- le produit doit exposer une liste des constructeurs ou modeles officiellement supportes et l'utiliser pour rassurer l'utilisateur pendant l'onboarding ;
- chaque camera doit avoir un nom, un statut visible et une configuration editable ;
- l'utilisateur doit pouvoir definir plusieurs zones actives par camera ;
- une perte de flux doit etre detectee et visible sans diagnostic technique avance ;
- lorsqu'une camera est hors ligne, l'interface doit le refleter immediatement : le flux live ne doit pas tenter de se charger, et les actions qui requierent une connexion active (controle PTZ, test de capacite) doivent etre suspendues avec un message explicite.

### 2.3 Catalogue de capacites et cameras non repertoriees

> **En tant qu'utilisateur**, je veux que les fonctionnalites avancees (PTZ, mode vie privee materiel, etc.) ne dependent pas de la marque de ma camera mais de ce qu'elle sait reellement faire, afin de ne pas etre prive d'une fonctionnalite uniquement parce que ma marque n'est pas dans la liste officielle.

> **En tant qu'utilisateur dont la camera n'est pas dans la liste des modeles officiellement supportes**, je veux pouvoir suivre un parcours de configuration manuelle plus long pour activer les memes fonctionnalites qu'une camera supportee, afin de profiter pleinement du produit sans devoir changer de materiel.

> **En tant qu'utilisateur**, je veux que Vyzio teste reellement une capacite avant de me la proposer (ex. sonder le PTZ), afin de ne jamais me laisser activer une option qui ne fonctionnera pas sur ma camera.

**Regles fonctionnelles :**

- les fonctionnalites avancees (flux video, PTZ, mode vie privee materiel, reglages image, info systeme a venir) sont des **capacites independantes de la marque** ; une marque "officiellement supportee" est une marque pour laquelle Vyzio sait deja quelles capacites sont disponibles et comment les activer (preconfiguration), pas une marque qui beneficie de fonctionnalites reservees ;
- une camera non repertoriee doit pouvoir acceder aux memes capacites qu'une camera supportee, a condition que son materiel le permette reellement ; le parcours est plus long (declaration et verification manuelle des capacites) mais jamais bloquant par principe ;
- pour une camera non repertoriee, l'utilisateur doit pouvoir declarer manuellement, capacite par capacite, comment y acceder (ex. protocole PTZ : ONVIF ou DVRIP, avec ses parametres de connexion) ; Vyzio doit verifier la capacite par un test reel avant de la proposer activable dans l'interface — jamais sur simple declaration non verifiee ;
- si une capacite ne peut pas etre verifiee ou echoue au test, l'interface doit l'indiquer clairement et ne pas la presenter comme disponible ;
- le statut "officiellement supporte" reste affiche et utilise pour rassurer l'utilisateur (cf. 2.2) ; le parcours manuel est presente comme une alternative pour les cameras absentes de cette liste, pas comme le parcours par defaut.

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

> **En tant qu'utilisateur**, je veux etre guide pour configurer Telegram, tester l'envoi et comprendre les compromis du canal choisi.

> **En tant qu'utilisateur**, je veux choisir quelles categories d'evenements meritent une alerte et quel niveau de bruit appliquer selon le contexte.

> **En tant qu'utilisateur**, je veux choisir les informations affichees dans le message, afin de recevoir un contenu utile sans surcharge.

### 5.2 Attendus fonctionnels

- le produit doit supporter au moins un canal de notification utilisable par un public non-tech ;
- plusieurs canaux pourront coexister selon les besoins utilisateur ;
- chaque notification importante doit contenir un contexte minimum : type d'evenement, camera, heure, apercu si autorise ;
- l'utilisateur doit pouvoir regler des plages horaires et un niveau minimal d'alerte ;
- si une dependance reseau externe est necessaire pour un canal, ce compromis doit etre explicite et opt-in ;
- la configuration des canaux retenus doit etre lisible, modifiable et testable depuis l'interface Vyzio ;
- le premier parcours guide doit couvrir Telegram de bout en bout : saisie des identifiants, verification, etat configure / non configure, test d'envoi ;
- le produit doit permettre de regler au minimum les destinations actives, les categories d'evenements notifiees, le niveau minimal d'alerte et les plages horaires associees ;
- le produit doit permettre de choisir un format de message simple, avec au minimum camera, heure, type d'evenement, identite si connue et apercu si autorise ;
- les reglages doivent etre persistants cote Vyzio et ne pas dependre d'une edition manuelle du runtime ;
- les capacites et limites d'un canal doivent etre explicites dans l'interface avant activation.

### 5.3 Regles hors ligne

- la surveillance locale doit continuer sans Internet ;
- une indisponibilite reseau ne doit pas empecher l'enregistrement local des evenements ;
- lorsqu'un canal externe revient, les regles de reprise doivent eviter les rafales d'alertes inutiles.

---

## 6. Historique, stockage et retention

### 6.1 User stories

> **En tant qu'utilisateur**, je veux consulter l'historique recent des evenements, afin de comprendre ce qu'il s'est passe.

> **En tant qu'utilisateur**, je veux choisir combien de temps mes enregistrements sont conserves, afin de gerer mon espace disque.

> **En tant qu'utilisateur**, je veux pouvoir recuperer un clip pertinent, afin de le conserver ou le partager si necessaire.

### 6.2 Attendus fonctionnels

- l'utilisateur doit pouvoir consulter un historique filtre par camera, personne ou type d'evenement ;
- les clips associes a un evenement doivent etre consultables quand ils existent ;
- la retention doit etre configurable ;
- le systeme doit supprimer automatiquement les donnees arrivees au terme de retention ;
- l'utilisateur doit etre informe si la capacite de stockage devient critique.

---

## 7. Dashboard et experience d'usage

### 7.1 User stories

> **En tant qu'utilisateur**, je veux voir rapidement si mon systeme fonctionne correctement.

> **En tant qu'utilisateur**, je veux retrouver les derniers evenements sans passer par plusieurs menus.

> **En tant qu'utilisateur**, je veux gerer mes cameras, mes profils et mes notifications depuis la meme interface.

> **En tant qu'utilisateur**, je veux pouvoir utiliser le systeme depuis un navigateur sur telephone ou ordinateur.

### 7.2 Attendus fonctionnels

- l'accueil doit rendre visible l'etat global du systeme et les alertes recentes ;
- les parcours camera, profils, historique et reglages doivent etre accessibles sans configuration manuelle de fichiers ;
- l'interface doit employer un vocabulaire comprehensible pour un utilisateur non-specialiste ;
- les actions principales doivent rester faisables sur mobile et desktop.

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
- la disponibilité des presets est indépendante du protocole de la caméra : Vyzio gère les positions par un mécanisme de homing + comptage de pas pour les caméras qui ne supportent pas les presets natifs (voir SAD ADR-25).

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
