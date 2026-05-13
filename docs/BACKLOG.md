# Vyzio — Backlog de reprise

> Mai 2026 — plan de remise a plat avant reprise du developpement
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

## Workflow obligatoire

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

Ce backlog ne fait qu'appliquer cet ordre; il n'en est pas la source de verite.

---

## Principes de reprise

1. **Pas de nouvelle feature tant que la phase P0 n'est pas validee.**
2. **Frigate reste le moteur central** pour la video, la detection et les enrichissements deja bien couverts.
3. **Le depot ne contient plus de service Python de reconnaissance faciale** dans le chemin nominal ni comme scaffold vide.
4. **Le code existant peut etre simplifie ou supprime** s'il ne sert pas clairement la trajectoire retenue.
5. **Chaque etape doit avoir une validation executable** ou une preuve documentaire explicite.

---

## Etat de depart

### Constats

- Le depot a ete demarre trop vite par rapport au cadrage.
- Une partie du code et des scaffolds a ete creee avant stabilisation du plan.
- Le runtime par defaut a ete nettoye pour sortir les composants non retenus.
- Le backlog precedent a ete abandonne car il poussait a implementer avant d'avoir verrouille la reprise.

### Objectif operationnel

Reprendre le projet en 4 phases, avec une **phase P0 bloquante** de nettoyage, verification et revalidation du plan.

---

## P1 — Fondations runtime

> But : obtenir une base d'execution minimale, fiable et conforme au positionnement Frigate-first.

### US-P1.1 — Compose minimal et coherent

**Taches :**
- [x] Stabiliser `docker-compose.yml` autour des seuls services retenus par defaut
- [x] Clarifier volumes, ports, reseaux et dependances
- [x] Documenter le boot local de developpement

**Criteres d'acceptation :**
- `docker compose up` demarre la base retenue sans service parasite
- Le role de chaque service est comprensible au premier coup d'oeil

### US-P1.2 — Configuration Frigate maitrisee

**Taches :**
- [x] Valider un `frigate.yml` minimal compatible avec la version cible
- [x] Documenter ce qui est gere par Vyzio et ce qui reste purement Frigate
- [x] Verifier l'integration d'un flux de test sans bricolage excessif

**Criteres d'acceptation :**
- Frigate demarre avec une configuration valide
- Les hypotheses de configuration sont explicites

### US-P1.3 — Persistance Vyzio minimale

**Taches :**
- [x] Garder uniquement les entites et tables utiles au MVP reel (profils produit, mapping identites Frigate, evenements, notifications, sessions)
- [x] Confirmer le provider par defaut et la strategie de migration
- [x] Verifier que le demarrage API applique les migrations sans logique parasite

**Criteres d'acceptation :**
- La persistence minimale est testable et comprise
- Le schema ne simule pas encore des features non construites (notamment un pipeline biometrie propre a Vyzio)

---

## P2 — Integration Vyzio vers Frigate

> But : construire la premiere vraie couture produit sans ouvrir trop tot les couches secondaires.

### US-P2.1 — Contrat d'entree Frigate

**Taches :**
- [x] Definir les evenements Frigate reellement consommes par Vyzio
- [x] Creer un modele d'entree limite au MVP
- [x] Integrer un filtrage configurable des labels Frigate retenus par l'utilisateur
- [x] Ajouter des tests de deserialisation et d'adaptation

**Criteres d'acceptation :**
- Le contrat utile est explicite
- Le code n'est pas couple a des payloads implicites disperses

### US-P2.2 — FrigateAdapter minimal

**Taches :**
- [x] Consommer les evenements Frigate via une seule couche d'adaptation, avec MQTT pour le temps reel et REST uniquement pour les ressources complementaires necessaires
- [x] Convertir les signaux Frigate en evenements Vyzio comprehensibles
- [x] Appliquer le filtre de labels configure sans hardcoder `person` comme seule categorie utile
- [x] Journaliser proprement les erreurs d'integration

**Criteres d'acceptation :**
- Une detection Frigate pertinente devient observable cote Vyzio
- Le couplage a Frigate reste localise

### US-P2.3 — Contrat interne Vyzio

**Taches :**
- [x] Definir les evenements internes necessaires au MVP sans repliquer le pipeline IA de Frigate
- [x] Eviter de modeliser des canaux non utilises a court terme
- [x] Documenter le contrat dans un document dedie si necessaire

**Criteres d'acceptation :**
- Les evenements internes sont limites et stables
- Le contrat est reutilisable par API, notifications et UI, en partant d'evenements Frigate deja enrichis

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
- [ ] Qualifier les candidats de decouverte (`camera_confirmee`, `camera_probable`, `equipement_non_qualifie`) pour eviter le bruit des objets connectes
- [ ] Ajouter un diagnostic de decouverte reseau expliquant les CIDR testes, protocoles joignables et raisons d'echec visibles pour le support
- [ ] Ajouter un probe HTTPS et un probe ONVIF unicast sur les IP candidates pour couvrir les cameras d'origine hors RTSP actif
- [ ] Introduire un catalogue de vendors avec notices d'activation RTSP/ONVIF et recommandations de configuration par constructeur detecte
- [ ] Exposer dans l'interface la liste des cameras officiellement supportees et le niveau de support associe
- [ ] Prioriser une assistance constructeur initiale pour TP-Link Tapo puis pour une famille generique "no-name / OEM"
- [ ] Reprendre automatiquement le parcours de verification quand une camera precedemment detectee devient exploitable

**Criteres d'acceptation :**
- Une camera existante peut etre ajoutee sans edition manuelle de fichiers
- L'utilisateur peut verifier rapidement qu'une camera est joignable, bien nommee et exploitable
- L'indisponibilite d'une camera est visible sans diagnostic technique avance
- Une camera sortie de carton peut etre detectee comme candidate exploitable ou candidate a assister, meme si RTSP n'est pas encore active
- L'utilisateur voit clairement si sa camera est officiellement supportee, probablement compatible ou non encore qualifiee

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
