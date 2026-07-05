# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog a deux zones distinctes, a ne pas melanger :

- **Idées** : capture brute, sans friction. Une idée qui vient a l'esprit se note ici en une ligne, sans avoir a choisir une categorie, une priorite ou a rediger un contexte complet. Rien n'engage a l'implementer.
- **Backlog d'exécution** : direction deja decidee, alignee avec les SPECS et le SAD. Tant que ces documents ne sont pas alignes sur un sujet, l'item reste en Idées — le backlog d'execution ne sert pas a brainstormer la strategie.

Promotion d'une idée vers l'execution : une fois la direction tranchee (et les SPECS/SAD mis a jour si necessaire), on deplace la ligne d'Idées vers la section thematique concernee de l'execution, en la detaillant.

Item traite : une fois qu'un item d'execution devient une issue GitHub, on le retire de ce fichier pour que le backlog reste court.

---

## 💡 Idées

> Zone de capture libre. Un ajout = une ligne. Pas de tri, pas de priorite, pas de contexte obligatoire.

- Frigate : trouver un moyen de modifier la config sans reboot le conteneur, surtout pour appliquer le mode vie privée, trop lent.
- Status de Frigate dans l'UI, pour savoir si le service est actif et affiché un message propre pendant le redémarrage (application de config, mode vie privée etc).
- Nettoyage des migrations de DB : app pas encore publique, donc pas de risque de casser des installations existantes. Supprimer les migrations inutiles, fusionner les migrations redondantes, renommer les tables et colonnes pour qu'elles soient plus claires.
- Configuration avancée caméra (luminosité, contraste, IR...) centralisée dans Vyzio plutôt que dans les apps constructeur.
- Notifications d'événements système (caméra offline, batterie faible, boot Vyzio, mise à jour) — configurable par caméra et par type.
- Canal Discord pour les notifications (webhook).
- Canal WhatsApp pour notifications et commandes rapides (API Cloud Meta ou Baileys/WWebJS).
- Commandes chatbot (Discord ou autre) pour actions rapides : activer/désactiver le mode vie privée, statut des caméras, snapshot — bidirectionnel avec le canal de notifications.
- Accès à Vyzio depuis l'extérieur — pistes à comparer : tunnel réseau (Netbird), commandes via chatbot, relais SaaS façon app constructeur.
- Intégration Home Assistant (capteurs d'ouverture, détection de mouvement, présence, scénarios d'automatisation).
- Optimisation dynamique de Frigate selon les ressources dispo (CPU/RAM/GPU) et la charge (nb caméras, résolution, FPS).
- Tests end-to-end Playwright pour chaque user story des SPECS.

---

## 🎯 Backlog d'exécution

Chaque theme a un tag stable (pas d'ordre impose entre thematiques). Un theme termine disparait simplement, sans decaler les autres.

### `onboarding` — Onboarding & capacités

Itérations courtes, buildables indépendamment. Priorité décroissante.

1. **Tapo PTZ — activation automatique après probe réussi** — après un probe PTZ positif, mettre à jour `Camera.PtzSupported = true` pour que le panneau PTZ apparaisse dans le live feed sans action supplémentaire. Limitation documentée dans `docs/user/PRIVACY_MODE.md` et `vendors/tplink_tapo.md`.

2. **Auto-détection ONVIF PTZ à l'ajout** — pour les caméras sans `VendorFamily` connue, sonder le port 8899 + `GetCapabilities` ONVIF au moment de l'ajout ; si PTZ détecté, créer le binding `Ptz/Onvif` directement. Actuellement : checkbox manuelle dans la fiche caméra.

3. **Étape "Position de surveillance" à l'onboarding PTZ** — si PTZ détecté à l'ajout (item 2), proposer une étape dédiée pour orienter la caméra avant de terminer l'onboarding. Dépend de l'item 2.

4. **`GET /api/cameras` — capacités vérifiées dans la réponse liste** — intégrer les bindings `Verified = true` dans la réponse pour éviter un second appel au chargement du hub. Actuellement : `Camera.PtzSupported` booléen legacy reste la seule indication côté liste.

5. **Priorité protocole pour la détection de capacités** — dépend du refacto `arch-protocol` (unification des enums). À traiter après. Ordre envisagé pour `Ptz` : V380 > TapoKlap > Onvif > Dvrip.

6. **Suppression du code legacy de capacités** — `BackfillCameraCapabilityBindingsUseCase` et correspondances hardcodées — à supprimer dans le cadre du refacto `arch-protocol` (item 2).

7. **UI : capacités éditables après configuration** — le `PUT /api/cameras/{id}/capabilities/{capability}` existe mais n'est pas accessible depuis l'interface une fois la capacité configurée. L'UI doit permettre de changer le protocole d'un binding existant (ex. passer de ONVIF à V380 manuellement) et de désactiver une capacité (supprimer le binding). Le panneau capacités d'une caméra doit afficher un état "reconfigurable" pour chaque capability vérifiée.

8. **Support des caméras multi-flux RTSP** — voir issue [#18](https://github.com/KelianS/vyzio/issues/18). Certaines caméras (ex. V380 avec 3 objectifs) exposent plusieurs flux RTSP simultanés ; le modèle actuel suppose un flux unique par caméra.

---

### `arch-protocol` — Refacto architecture protocoles / capacités

Direction décidée, alignée avec la session de design du 2026-07-05.

#### Cible architecturale

```
SupportedProtocol  { Onvif, V380, Dvrip, TapoKlap, Rtsp }
  → unique enum réseau, utilisée partout (camera.SupportedProtocols ET capability bindings)

Capability         { Stream, Ptz, HardwarePrivacy }
  → features caméra uniquement

CameraCapabilityBinding { capability: Capability, protocol: SupportedProtocol }
  ex. { stream → Rtsp }, { ptz → V380 }, { hardware_privacy → TapoKlap }

Camera {
  SupportedProtocols : SupportedProtocol[]   ← détectés à la probe, persistés en DB
  CapabilityBindings : CameraCapabilityBinding[]
  PrivacyStrategy    : None | SoftwareBlur | PtzParking | Hardware  ← config app
}
```

`CapabilityProtocol` disparaît. `PtzParking` / `SoftwareOnly` / `None` sortent des bindings → deviennent `PrivacyStrategy` sur la caméra.

#### Items d'implémentation

1. **Refacto `OnvifPtzClient` → `OnvifClient`** — protocole pur. `OnvifClient` expose `PostSoapAsync`, `GetDeviceInformationAsync`, `GetProfilesAsync`, `GetCapabilitiesAsync`, `AbsoluteMoveAsync`, `RelativeMoveAsync`, `ContinuousMoveAsync`, `StopAsync`. `OnvifPtzProvider` devient un orchestrateur fin (logique feature uniquement). Injection mise à jour partout.

2. **Unification des enums** — `CapabilityProtocol` supprimé. `SupportedProtocol { Onvif, V380, Dvrip, TapoKlap, Rtsp }` devient la seule référence protocole. `Capability` étendu avec `Stream` et `HardwarePrivacy` (renommage de `privacy_mode`). Migration DB + DTO API + type TS frontend.

3. **`PrivacyStrategy` sur `Camera`** — nouveau champ `privacy_strategy : None | SoftwareBlur | PtzParking | Hardware`. Retire `PtzParking` / `SoftwareOnly` / `None` des bindings. Migration DB.

4. **`SupportedProtocols` sur `Camera`** — colonne JSON `supported_protocols` sur la table `cameras`. La pipeline de découverte (`AssistedCameraDiscoveryProbePipeline`) peuple ce champ à la probe (les infos sont déjà collectées, elles partaient dans le vide). Migration DB.

5. **Bootstrap device ID V380 via ONVIF** — `V380PtzProvider.ProbeAsync` : si pas d'ID en ConfigJson, check `camera.SupportedProtocols.Contains(Onvif)` → `OnvifClient.GetDeviceInformationAsync` → bytes[2..5] BE du serial = device ID. Fallback UDP. Dépend de 1 + 4.

6. **UI — protocoles supportés** — section "Protocoles détectés" dans la fiche caméra : badges `ONVIF · V380 · RTSP · DVRIP`. Vide si non encore sondé (message "Sonder la caméra pour détecter les protocoles"). Données issues de `camera.supportedProtocols`.

7. **UI — binding Stream** — la capacité `stream` apparaît dans la section capacités comme les autres : protocole utilisé (RTSP ou DVRIP), bouton Tester. Pas de form manuelle (toujours auto-détecté).

8. **UI — saisie manuelle ID V380** — quand le binding PTZ V380 a `lastError` contenant "Identifiant V380 introuvable", afficher un champ numérique dédié "Identifiant V380" avec hint "Visible dans l'app V380 Pro → Mon équipement". Soumission → stocké dans ConfigJson `{"device_id": …}` → re-probe automatique.

9. **UI — `PrivacyStrategy`** — remplace les protocoles `PtzParking` / `SoftwareOnly` actuellement dans les bindings. Sélecteur dans la fiche caméra (section "Vie privée") : Aucun / Masquage logiciel / Position de parking PTZ / Matériel. L'option Hardware est grisée si pas de binding `hardware_privacy` vérifié. L'option PtzParking est grisée si pas de binding `ptz` vérifié.

---

### `ptz` — PTZ précis

1. **Protocole propriétaire V380 port 8800** — ✅ implémenté (`V380Client` + `V380PtzProvider`). UDP discovery bloqué depuis Docker bridge — résolu via bootstrap ONVIF serial (item `arch-protocol` 5).

2. **Gestion des positions PTZ (presets + parking)** — deux presets réservés : preset 1 = position de surveillance (home), preset 2 = position de parking vie privée. Minimum 4 slots au total dont 2 personnalisables par l'utilisateur. Deux branches d'implémentation selon la capacité de la caméra :

   - **Branch A — presets natifs** : si la caméra retourne ≥1 preset à la probe (`GetPresets` ONVIF ou équivalent DVRIP), utiliser `SetPreset` / `GotoPreset` natifs. Déjà partiellement câblé dans `OnvifPtzProvider` et `DvripPtzProvider`.
   - **Branch B — positions Vyzio-managed** : fallback générique pour toute caméra dont la probe ne confirme pas le support natif des presets — indépendant du protocole (V380, ONVIF cheap, DVRIP sans preset, etc.). À la première utilisation d'un preset, effectuer un **homing** : envoyer N steps en direction UpLeft jusqu'à la butée mécanique (timeout-based, N exposé comme constante configurable par provider). L'origine (0, 0) est alors connue. Les presets sont persistés en DB comme `(steps_x, steps_y)` depuis zéro. `GoToPreset` : homing → replay des steps vers les coordonnées cibles.

   **Détails d'implémentation :**
   - Le routage Branch A / B est déterminé à la probe : chaque provider tente `GetPresets` (ou équivalent) et expose `SupportsNativePresets` dans le résultat — le flag est persisté dans `CameraCapabilityBinding.ConfigJson`.
   - Nouveau champ `PtzPreset` en DB : `{ "native": false, "presets": [{"id": 1, "label": "Surveillance", "x": 42, "y": 17}, ...] }`.
   - `IPtzCapabilityProvider` : ajouter `PtzHomingStepsAsync` (homing + retour à (0,0)) pour les providers Branch B ; no-op par défaut.
   - Homing déclenché une seule fois par session (état en mémoire par `cameraId`), non bloquant pour les steps manuels en cours.
   - UI : section "Positions PTZ" dans la fiche caméra — liste des presets, bouton "Définir ici" (save position courante), bouton "Aller" (goto), presets 1 et 2 avec labels fixes (Surveillance / Parking), presets 3-4 personnalisables.

---

### `battery-wake` — Réveil caméras DVRIP sur batterie

Investigation close. Direction retenue : WoL + inspection de paquet.

- TCP knock, UDP DVRIP 0x0590, WS-Discovery et WoL magic packet échoués (aucun port ouvert en veille). Le chipset WiFi répond aux pings ICMP (~510ms) au niveau NIC sans réveiller le processeur. Le mécanisme de réveil est un WoWLAN pattern filter dans le NIC, déclenché par l'app ICSee via son canal cloud. **À faire** : capturer le trafic ICSee lors d'un réveil pour identifier le pattern UDP/broadcast, puis l'implémenter. Confirmer par inspection réseau avant de coder.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
