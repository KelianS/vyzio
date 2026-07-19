# ADR-23 — Surveillance de joignabilité des caméras : polling TCP périodique indépendant de Frigate

> Statut : Accepté

## Contexte

Le statut réseau d'une caméra (`Camera.Status`) n'était mis à jour que sur action explicite de l'utilisateur (`POST /api/cameras/{id}/verify`). En dehors de ces appels, le statut pouvait rester figé pendant des heures, rendant `Camera.Status` peu fiable pour conditionner l'affichage UI.

Deux conséquences directes :

1. **Home page** : `CameraLiveThumbnail` pollingait `latest.jpg` toutes les secondes même pour les caméras hors ligne, générant un flux noir inutile via Frigate.
2. **Page caméra** : les contrôles PTZ et les boutons de probe de capacités restaient actifs alors que la caméra était injoignable, induisant des erreurs confuses pour l'utilisateur.

## Décision

Introduire un `CameraReachabilityPollerService` (BackgroundService, couche Application) qui sonde périodiquement la joignabilité de chaque caméra validée par connexion TCP directe, sans passer par Frigate.

**Comportement :**
- Délai initial de 15 s au démarrage pour laisser le host se stabiliser.
- Intervalle de 60 s entre chaque cycle de sondage.
- Périmètre : caméras dont `ValidationState == "validated"` (les caméras en état `"draft"` ou `"pending_removal"` sont exclues).
- Probe : tentative de connexion TCP sur `Camera.Host:Camera.Port` avec timeout de 3 s.
- Résultat : `"online"` si la connexion aboutit, `"offline"` sinon.
- Mise à jour DB uniquement si le statut change (évite les writes inutiles).
- `LastReachabilityCheckAt` mis à jour à chaque changement de statut.

**Adaptation UI :**

| Zone | Comportement hors ligne |
|---|---|
| Home — `CameraLiveThumbnail` | `offline` initialisé à `!camera.connected`; polling Frigate suspendu si hors ligne |
| Caméra — section PTZ | Message « Caméra hors ligne » ; `PtzControlPanel` non rendu |
| Caméra — section Capacités | Message « Caméra hors ligne » ; boutons probe/configure désactivés |

`connected: boolean` est dérivé du champ `status` dans le mapper frontend (`status === 'online'`) — aucun nouveau champ DTO backend n'est nécessaire.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Polling TCP backend périodique** (retenu) | BackgroundService, sonde TCP 60 s, met à jour `Camera.Status` | Léger, découplé de Frigate, statut disponible pour toute l'UI et les futures alertes | Latence max 60 s avant propagation d'un changement d'état |
| **B — Probe à la demande (frontend poll)** | Le frontend appelle `GET /status` toutes les N secondes par caméra ouverte | Probe toujours fraîche | N appels réseau par caméra visible ; exécute un probe RTSP complet à chaque fois |
| **C — Écouter les événements Frigate** | Statut déduit des événements MQTT Frigate | Zéro probe supplémentaire | Couple la disponibilité réseau caméra à l'état de Frigate — hors périmètre souhaité (caméras non encore appliquées à Frigate seraient invisibles) |

**Option A retenue.**

## Conséquences

- ✅ `Camera.Status` est désormais maintenu automatiquement et peut servir de source fiable pour les futures alertes de déconnexion (Track D backlog)
- ✅ Aucun appel Frigate impliqué — fonctionne même pour les caméras en état `validated` mais pas encore appliquées (`IsEnabled = false`)
- ✅ UI conditionnée sur `connected` sans polling supplémentaire côté frontend — la liste de caméras rafraîchie toutes les N secondes suffit
- ⚠️ Latence max de 60 s entre la perte réseau réelle et la mise à jour UI — acceptable pour le cas d'usage (surveillance, pas temps réel)
- ⚠️ Pour les caméras DVRIP sur batterie (ICSee), un timeout TCP peut indiquer « en veille » plutôt que vraiment hors ligne — le statut `"offline"` est donc une approximation ; la distinction « hors ligne / en veille » est renvoyée à une future évolution du poller
