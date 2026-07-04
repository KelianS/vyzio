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

1. **Tapo PTZ — activation automatique après probe réussi** — après un probe PTZ positif, mettre à jour `Camera.PtzSupported = true` pour que le panneau PTZ apparaisse dans le live feed sans action supplémentaire. Limitation documentée dans `docs/user/PRIVACY_MODE.md` et `vendors/tplink_tapo.md`.

2. **Auto-détection ONVIF PTZ à l'ajout** — pour les caméras sans `VendorFamily` connue, sonder le port 8899 + `GetCapabilities` ONVIF au moment de l'ajout ; si PTZ détecté, créer le binding `Ptz/Onvif` directement. Actuellement : checkbox manuelle dans la fiche caméra.

3. **Étape "Position de surveillance" à l'onboarding PTZ** — si PTZ détecté à l'ajout (point 2), proposer une étape dédiée pour orienter la caméra avant de terminer l'onboarding. Dépend de 2.

4. **`GET /api/cameras` — capacités vérifiées dans la réponse liste** — intégrer les bindings `Verified = true` dans la réponse pour éviter un second appel au chargement du hub. Actuellement : `Camera.PtzSupported` booléen legacy reste la seule indication côté liste.

5. **Refacto système de capacités — priorité protocole, nettoyage legacy, UI éditable** — trois problèmes liés :

   - **Priorité protocole** : aucun ordre de préférence n'est défini quand plusieurs protocoles sont candidats pour la même capacité (ex. une caméra inconnue qui répond à ONVIF et V380). Définir une priorité globale par `(CameraCapability, CapabilityProtocol)` — ex. pour `Ptz` : V380 > Onvif > Dvrip > TapoKlap. La détection auto sonde les protocoles dans cet ordre et retient le premier qui passe. La caméra certifiée (`VendorFamily` connu) conserve le preset comme protocole de référence mais passe quand même par la priorité si plusieurs protocoles sont disponibles.

   - **Suppression du code legacy** : `BackfillCameraCapabilityBindingsUseCase` et toutes les correspondances hardcodées (`V380Pro → Onvif`, `Icsee → Dvrip`, etc.) sont du legacy de migration — à supprimer. Le système de bindings est maintenant la source de vérité ; les caméras qui n'ont pas encore de binding passent par le probe, pas par un backfill. Vérifier qu'aucune autre référence à l'ancien modèle ne subsiste (champ `PtzSupported` sur `Camera`, logique conditionnelle sur `VendorFamily` dans les use cases).

   - **UI : capacités éditables après configuration** — le `PUT /api/cameras/{id}/capabilities/{capability}` existe mais n'est pas accessible depuis l'interface une fois la capacité configurée. L'UI doit permettre de changer le protocole d'un binding existant (ex. passer de ONVIF à V380 manuellement) et de désactiver une capacité (supprimer le binding). Le panneau capacités d'une caméra doit afficher un état "reconfigurable" pour chaque capability vérifiée.

---

### B — PTZ : positions configurables

1. **Position de parking vie privée configurable** — actuellement, l'activation du mode vie privée PTZ déplace la caméra vers la butée mécanique bas-gauche pendant 8 secondes (hardcodé). L'utilisateur devrait pouvoir définir une position dédiée "zone neutre" (ex. face au mur) sauvegardée comme preset 2, et le provider devrait aller à ce preset à l'activation. Symétrique au "Définir la position de surveillance" (preset 1) déjà en place.

2. Ajouter le support de plusieurs positions 'preset' pour toutes les cameras PTZ, avec un minimum de 4 presets (1 = position de surveillance, 2 = position de vie privée, 3 et 4 = positions personnalisées). L'utilisateur peut configurer ces presets dans l'interface web. Le provider doit gérer la mémorisation et le rappel de ces presets.
---

3. Configuration avancée des caméras : luminosité, constrate, IR etc. Tout ce qui est disponible via les protocoles connus et a venir (ONVIF, DVRIP, Tapo, v380, etc.). L'objectif est de centraliser la configuration avancée dans l'interface web Vyzio, plutôt que de passer par les applications propriétaires. Le provider doit exposer ces options et permettre leur modification via l'interface web.

### C — V380 Pro : PTZ précis

1. **Protocole propriétaire port 8800** — port ouvert, répond en 205ms (`9c ff ff ff` = -100 LE = rejet de notre format). Magic bytes différents du DVRIP classique (`ff000000`). Objectif : login + ContinuousMove + Stop pour un contrôle PTZ sans la limitation 3s ONVIF. Scripts dans `tools/camera-probe/probe_8800.py`. **Estimation : 2-3j.** Peut démarrer indépendamment.


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
