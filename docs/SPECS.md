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

### 2.2 Attendus fonctionnels

- le systeme doit proposer un parcours guide d'ajout de camera ;
- la detection automatique est souhaitee quand elle est possible, avec une saisie manuelle en secours ;
- la decouverte reseau doit distinguer au minimum une camera confirmee, une camera probable et un equipement non qualifie ;
- chaque candidat detecte doit exposer au minimum un libelle de confiance compréhensible, une explication courte des signaux observes et, si possible, un constructeur ou une famille probable ;
- le niveau de confiance doit rester explicable : Vyzio ne doit pas afficher une precision arbitraire ou un score opaque sans justification lisible ;
- une camera detectee mais non encore exploitable doit rester visible dans un parcours d'assistance plutot que disparaitre silencieusement ;
- une camera confirmee doit etre clairement distinguable d'un simple equipement reseau joignable, afin d'eviter les faux positifs dans le parcours d'onboarding ;
- le produit doit guider l'utilisateur quand RTSP ou ONVIF doivent etre actives, avec une notice adaptee au constructeur detecte quand cette information est disponible ;
- le produit doit exposer une liste des constructeurs ou modeles officiellement supportes et l'utiliser pour rassurer l'utilisateur pendant l'onboarding ;
- chaque camera doit avoir un nom, un statut visible et une configuration editable ;
- l'utilisateur doit pouvoir definir plusieurs zones actives par camera ;
- une perte de flux doit etre detectee et visible sans diagnostic technique avance.

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

### 5.2 Attendus fonctionnels

- le produit doit supporter au moins un canal de notification utilisable par un public non-tech ;
- plusieurs canaux pourront coexister selon les besoins utilisateur ;
- chaque notification importante doit contenir un contexte minimum : type d'evenement, camera, heure, apercu si autorise ;
- l'utilisateur doit pouvoir regler des plages horaires et un niveau minimal d'alerte ;
- si une dependance reseau externe est necessaire pour un canal, ce compromis doit etre explicite et opt-in.

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

## 9. Perimetre MVP

### 9.1 Inclus dans le MVP

- ajout et gestion de cameras existantes ;
- surveillance locale avec alertes sur evenements prioritaires ;
- gestion de profils connus ;
- historique consultable et retention configurable ;
- interface web unifiee pour les parcours principaux.

### 9.2 Hors MVP initial

- couverture exhaustive de tous les usages experts d'un NVR ;
- exposition de chaque capacite avancee dans une UI Vyzio 100 % custom ;
- automatisations complexes et scenarios tres specialises ;
- experiences distantes avancees qui compliquent la promesse locale par defaut.

---

## 10. Criteres de succes produit

- un utilisateur non-tech doit pouvoir comprendre la promesse, installer le systeme et recevoir ses premieres alertes sans lire de documentation technique ;
- le systeme doit rester utile meme sans connexion Internet ;
- les alertes doivent etre suffisamment pertinentes pour ne pas degrader la confiance utilisateur ;
- la frontiere entre comportement local par defaut et options distantes doit rester explicite a chaque etape.
