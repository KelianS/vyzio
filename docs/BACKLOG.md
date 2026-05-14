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

**Taches :**
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
- [ ] Mettre a jour le cadrage et la documentation si necessaire pour converger vers deux etats lisibles cote produit : camera supportee oui / non, RTSP actif oui / non
- [ ] 
oui / non, RTSP actif oui / non
- [ ] Corriger l'ouverture des liens des notices vendor : les liens externes et les assets locaux doivent s'ouvrir hors de la page Vyzio et declencher un telechargement quand c'est pertinent, sans rediriger l'interface principale
- [ ] Permettre de relancer les tests / la verification sur une seule camera ou un seul candidat, sans relancer une decouverte complete, afin de rafraichir les informations apres un changement de configuration
- [ ] Reprendre automatiquement le parcours de verification quand une camera precedemment detectee devient exploitable
- [ ] Ajouter les tests et la documentation utilisateur qui verrouillent les etats supporte oui / non et RTSP actif oui / non

**Criteres d'acceptation :**
- Une camera existante peut etre ajoutee sans edition manuelle de fichiers
- L'utilisateur peut verifier rapidement qu'une camera est joignable, bien nommee et exploitable
- L'indisponibilite d'une camera est visible sans diagnostic technique avance
- Une camera sortie de carton peut etre detectee comme candidate exploitable ou candidate a assister, meme si RTSP n'est pas encore active
- L'utilisateur voit clairement si sa camera est supportee ou non par Vyzio, et si le RTSP est deja actif ou reste a activer
- Les notices vendor n'interrompent pas le parcours Vyzio quand l'utilisateur ouvre un lien ou telecharge un asset associe
- Les etats affiches sont coherents entre backend, UI et documentation
- Le support peut expliquer le comportement sans interpretation implicite du code

### US-P3.5 — Gestion detections et profils

**Taches :**
- [ ] Relier le CTA du hub a une page dediee couvrant detections et profils
- [ ] Permettre la creation, la modification et la suppression de profils depuis l'interface
- [ ] Exposer la configuration des categories de detection utiles et des politiques d'alerte associees
- [ ] Afficher un historique recent par profil et preparer un parcours simple de correction de reconnaissance

**Criteres d'acceptation :**
- Le bouton du hub ouvre un vrai parcours produit et non une impasse
- L'utilisateur peut gerer profils et detections depuis la meme interface
- Les endpoints conserves sont relies a un parcours utilisateur explicite

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
