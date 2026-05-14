# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

## P3 — Experience produit MVP

> But : livrer la valeur Vyzio la ou Frigate seul ne suffit pas pour un public non-tech.

### US-P3.1 — API metier minimale

**Taches :**
- [x] Exposer uniquement les parcours MVP prioritaires
- [x] Separer lecture/ecriture de facon simple et testable

**Criteres d'acceptation :**
- L'API sert un parcours produit identifiable

### US-P3.2 — Notifications utiles

**Taches :**
- [x] Implementer Telegram comme premier canal retenu par la strategie produit
- [x] Limiter le scope aux notifications a forte valeur
- [x] Ajouter les regles minimales de reduction du bruit

**Criteres d'acceptation :**
- Une detection prioritaire genere une notification intelligible
- Le premier parcours notif fonctionne sans imposer tunnel, URL signee ou configuration avancee

### US-P3.3 — Hub Vyzio simplifie

**Taches :**
- [x] Definir l'UI minimale necessaire pour un utilisateur non-tech
- [x] Eviter de reconstruire l'integralite des ecrans Frigate
- [x] Conserver un acces avance vers Frigate hors parcours nominal

**Criteres d'acceptation :**
- Le parcours MVP fonctionne sans imposer l'UI Frigate comme interface principale

### US-P3.4 — Parcours camera guide

**Taches livrees :**
- [x] Cadrer l'architecture cible du parcours camera et documenter le SAD
- [x] Ajouter une page de gestion des cameras depuis le hub
- [x] Introduire un referentiel camera cote Vyzio pour piloter l'UI et la generation de configuration
- [x] Exposer une lecture du statut camera independante des evenements de detection
- [x] Construire le parcours manuel complet: saisie, verification du flux, nommage, edition minimale
- [x] Generer la section cameras de la configuration Frigate depuis les cameras valides
- [x] Relancer ou recharger Frigate de facon maitrisee apres application de la configuration
- [x] Proposer une decouverte reseau assistee avec saisie manuelle en secours
- [x] Rendre visible le statut de chaque camera, la perte de flux et les actions de correction simples
- [x] Filtrer les cameras deja configurees hors des candidats de decouverte
- [x] Qualifier les candidats de base (`camera_confirmee`, `camera_probable`, `equipement_non_qualifie`) et exposer les raisons de qualification a l'UI
- [x] Introduire une premiere assistance constructeur exploitable pendant l'onboarding
- [x] Mettre a jour le cadrage et la documentation si necessaire pour converger vers deux etats lisibles cote produit : camera supportee oui / non, RTSP actif oui / non
- [x] Aligner le contrat backend et les libelles residuels avec cette simplification produit, sans reouvrir un chantier large sur l'interface
- [x] Corriger l'ouverture des liens des notices vendor : les liens externes et les assets locaux doivent s'ouvrir hors de la page Vyzio et declencher un telechargement quand c'est pertinent, sans rediriger l'interface principale
- [x] Ajouter les tests et la documentation utilisateur qui verrouillent les etats supporte oui / non et RTSP actif oui / non
- [x] Permettre de relancer les tests / la verification sur une seule camera ou un seul candidat, sans relancer une decouverte complete, afin de rafraichir les informations apres un changement de configuration

**Criteres d'acceptation :**
- Une camera existante peut etre ajoutee sans edition manuelle de fichiers
- L'utilisateur peut verifier rapidement qu'une camera est joignable, bien nommee et exploitable
- L'indisponibilite d'une camera est visible sans diagnostic technique avance
- Une camera sortie de carton peut etre detectee comme candidate exploitable ou candidate a assister, meme si RTSP n'est pas encore active
- L'utilisateur voit clairement si sa camera est supportee ou non par Vyzio, et si le RTSP est deja actif ou reste a activer
- Les notices vendor n'interrompent pas le parcours Vyzio quand l'utilisateur ouvre un lien ou telecharge un asset associe
- L'utilisateur peut relancer une verification ciblee apres modification d'une camera, sans repasser par une decouverte complete
- Les etats affiches sont coherents entre backend, UI et documentation
- Le support peut expliquer le comportement sans interpretation implicite du code

### US-P3.5 — Gestion configuration des notification via UI

> But : permettre a l'utilisateur de configurer les canaux de notification via l'interface, l'aider a configurer Telegram et les autres canaux. Permettre de choisir les categories de detection a notifier et les politiques d'alerte associees. Permettre de choisir le format des messages et les informations a inclure.

**Taches :**
- [x] Completer le cadrage SPECS/SAD pour expliciter le parcours UI de configuration des notifications, le modele de destinations et les regles produit a exposer
- [x] Definir le modele metier de configuration des notifications cote Vyzio : destinations, statuts de configuration, regles de diffusion, format de message, resultat des tests d'envoi
- [x] Introduire une persistence dediee a cette configuration dans Vyzio, sans dependre uniquement des options runtime injectees au demarrage
- [x] Definir la strategie de stockage des secrets canal (ex. token Telegram) et la separation entre donnees sensibles, statut produit et historique d'envoi
- [x] Exposer une API de lecture/ecriture pour la configuration des notifications, avec contrats stables pour l'UI
- [x] Exposer une action de test ciblee par destination pour verifier un canal configure sans attendre une vraie detection
- [x] Construire le premier parcours UI guide pour Telegram : etat configure / non configure, saisie assistee, aide de configuration, test d'envoi, retour d'erreur comprehensible
- [x] Etendre le pipeline de notification pour resoudre les destinations actives et les regles applicables depuis la configuration persistante, et non depuis un seul switch Telegram statique
- [x] Introduire un modele de capacites par canal pour afficher clairement ce que chaque destination supporte (image, dependance tierce, prerequis reseau, confidentialite)
- [x] Permettre de configurer au minimum les categories / types d'evenements notifies, le niveau minimal d'alerte et les plages horaires associees
- [ ] Permettre de configurer le format du message envoye, avec activation minimale des champs camera, heure, type d'evenement, identite et apercu
- [x] Ajouter les validations backend/frontend, tests unitaires/integration et documentation utilisateur necessaires pour verrouiller le parcours de configuration et le test d'envoi

**Criteres d'acceptation :**
- L'utilisateur peut configurer Telegram depuis l'interface sans modifier de fichier ni redemarrer manuellement le produit
- L'utilisateur voit clairement si une destination est configuree, testee avec succes, en erreur ou inactive
- Une notification de test peut etre envoyee a la demande pour valider la configuration d'un canal
- L'utilisateur peut regler depuis l'interface les destinations actives, les categories d'evenements, le niveau minimal d'alerte et les plages horaires minimales retenues
- Le format du message reste comprehensible, configurable dans les limites du MVP et coherent entre backend, UI et documentation
- Les compromis d'un canal tiers comme Telegram sont affiches explicitement avant activation
- Le pipeline d'envoi applique la configuration persistante courante sans exiger une edition manuelle du runtime


### US-P3.6 — Gestion detections et profils

**Taches :**
- [ ] Relier le CTA du hub a une page dediee couvrant detections et profils
- [ ] Permettre la creation, la modification et la suppression de profils depuis l'interface
- [ ] Exposer la configuration des categories de detection utiles et des politiques d'alerte associees
- [ ] Afficher un historique recent par profil et preparer un parcours simple de correction de reconnaissance

**Criteres d'acceptation :**
- Le bouton du hub ouvre un vrai parcours produit et non une impasse
- L'utilisateur peut gerer profils et detections depuis la meme interface
- Les endpoints conserves sont relies a un parcours utilisateur explicite

### US-P3.7 — UI uniformisee, coherent et guidant
> But : mettre de la cohérence entre les pages, les noms, comportements, actions de navigation toujours au même endroit ... La vue principale devra aussi être repensé pour guider l'utilisateur vers les actions de configuration ou la vue d'utilisation du système (feed live camera, notifications, statuts ...)

**Taches :**
TODO

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
