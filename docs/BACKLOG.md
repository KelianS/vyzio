# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

## Feuille de route

### A — Onboarding & capacités

Itérations courtes, buildables indépendamment. Priorité décroissante.

1. **Probe silencieux à l'onboarding** — à l'ajout d'une caméra reconnue (`VendorFamily` non null), lancer le probe de tous les bindings preset en arrière-plan (sans étape UI). La section Capacités est déjà remplie à la première ouverture de la fiche. Actuellement : probe toujours manuel via "Tester la connexion".

2. **Tapo PTZ — activation automatique après probe réussi** — après un probe PTZ positif, mettre à jour `Camera.PtzSupported = true` pour que le panneau PTZ apparaisse dans le live feed sans action supplémentaire. Limitation documentée dans `docs/user/PRIVACY_MODE.md` et `vendors/tplink_tapo.md`.

3. **Auto-détection ONVIF PTZ à l'ajout** — pour les caméras sans `VendorFamily` connue, sonder le port 8899 + `GetCapabilities` ONVIF au moment de l'ajout ; si PTZ détecté, créer le binding `Ptz/Onvif` directement. Actuellement : checkbox manuelle dans la fiche caméra.

4. **Étape "Position de surveillance" à l'onboarding PTZ** — si PTZ détecté à l'ajout (point 3), proposer une étape dédiée pour orienter la caméra avant de terminer l'onboarding. Dépend de 3.

5. **`GET /api/cameras` — capacités vérifiées dans la réponse liste** — intégrer les bindings `Verified = true` dans la réponse pour éviter un second appel au chargement du hub. Actuellement : `Camera.PtzSupported` booléen legacy reste la seule indication côté liste.

---

### B — V380 Pro : PTZ précis

1. **Bouton Home masqué** — `GotoPreset(1)` retourne HTTP 400 sur V380 ; le bouton est visible mais sans effet. Fix : ajouter `SupportsGoToPresetAsync` sur `IPtzCapabilityProvider` (ou détecter au probe) et masquer le bouton si non supporté. Quick win, non bloquant.

2. **Protocole propriétaire port 8800** — port ouvert, répond en 205ms (`9c ff ff ff` = -100 LE = rejet de notre format). Magic bytes différents du DVRIP classique (`ff000000`). Objectif : login + ContinuousMove + Stop pour un contrôle PTZ sans la limitation 3s ONVIF. Scripts dans `tools/camera-probe/probe_8800.py`. **Estimation : 2-3j.** Peut démarrer indépendamment.

---

### C — Réveil caméras DVRIP sur batterie

Investigation close. Direction retenue : WoL + inspection de paquet.

- TCP knock, UDP DVRIP 0x0590, WS-Discovery et WoL magic packet échoués (aucun port ouvert en veille). Le chipset WiFi répond aux pings ICMP (~510ms) au niveau NIC sans réveiller le processeur. Le mécanisme de réveil est un WoWLAN pattern filter dans le NIC, déclenché par l'app ICSee via son canal cloud. **À faire** : capturer le trafic ICSee lors d'un réveil pour identifier le pattern UDP/broadcast, puis l'implémenter. Confirmer par inspection réseau avant de coder.

---

### D — Notifications & alertes

Indépendant des autres pistes.

1. **Événements système** — caméra offline, batterie faible, démarrage Vyzio, mise à jour. Configurable par caméra et par type d'événement.
2. **Canal Discord** — notifications vers serveurs/canaux Discord (webhook). Même infrastructure que 1.
3. **Canal WhatsApp** — notifications et commandes rapides via WhatsApp. Deux options d'intégration à évaluer : API Cloud officielle Meta (nécessite un numéro dédié et approbation Meta) ou Baileys/WWebJS via une session WhatsApp existante (plus simple à mettre en place, non officiel). Même périmètre de commandes que le chatbot Discord (piste F2) — l'infrastructure de dispatch de notifications doit être canal-agnostique pour servir les deux.

---

### E — Intégrations domotique

1. **Home Assistant** — capteurs d'ouverture, détection de mouvement, présence, scénarios d'automatisation. Périmètre et direction à définir dans les SPECS avant de coder.
2. **Optimisation Frigate** — ajustement dynamique des paramètres de détection et d'enregistrement (CPU/RAM/GPU, nombre de caméras, résolution, FPS) pour maintenir l'équilibre qualité/performance.

---

### F — Accès distant

Deux approches non mutuellement exclusives — à trancher dans les SPECS avant de coder.

1. **Tunnel réseau (Netbird ou équivalent)** — expose Vyzio sur un réseau privé virtuel sans ouvrir de port public. L'utilisateur accède à l'interface web depuis l'extérieur exactement comme en local. Zéro surface d'attaque supplémentaire. Nécessite un agent Netbird sur l'hôte Vyzio et un compte sur le relais (self-hostable). Option la plus transparente pour les fonctionnalités existantes.

2. **Commandes chatbot depuis le canal de discussion** — bot Discord (ou autre) qui répond à des commandes rapides : activer/désactiver le mode vie privée, vérifier le statut des caméras, déclencher un snapshot. S'appuie sur l'infrastructure D (notifications) — le même canal devient bidirectionnel. Périmètre de commandes à définir ; ne remplace pas l'interface web pour les actions complexes.

> Les deux options peuvent coexister : Netbird pour l'accès complet à l'interface, chatbot pour les actions courantes sans ouvrir un navigateur.

---

### G — Tests end-to-end

- **Playwright** — couverture de chaque user story des SPECS. Peut démarrer en parallèle de n'importe quelle autre piste.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
