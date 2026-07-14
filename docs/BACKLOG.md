# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans [`WORKFLOW.md`](./WORKFLOW.md).

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

7. **Support des caméras multi-flux RTSP** — voir issue [#18](https://github.com/KelianS/vyzio/issues/18). Certaines caméras (ex. V380 avec 3 objectifs) exposent plusieurs flux RTSP simultanés ; le modèle actuel suppose un flux unique par caméra.

---

### `ptz` — PTZ précis

_Vide pour l'instant — presets natifs/managés (homing + steps), parking vie privée et miniatures de positions sont livrés (branche `feature/preset-ptz`). Voir SPECS §9.3-9.4, SAD ADR-26._

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
