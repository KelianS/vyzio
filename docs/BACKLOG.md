# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### leftover

- [ ] Onboarding : détecter ONVIF PTZ à l'ajout (port 8899 + GetCapabilities) → assigner `vendorFamily = "onvif"` et `PtzSupported = true` automatiquement. Actuellement : checkbox manuelle dans la fiche caméra.
- [ ] Si PTZ détecté automatiquement à l'ajout : étape dédiée "Configurer position de surveillance". Actuellement la fiche caméra couvre ce cas manuellement.
- [ ] **V380 — bouton Home masqué** : `GotoPreset` retourne HTTP 400 sur V380, le bouton home tente l'appel sans effet. Option : ajouter `SupportsPresetAsync` sur l'interface ou détecter à l'exécution. Non bloquant pour la release.
- [ ] **Protocole port 8800** : reverse-engineering V380 propriétaire pour step précis et contrôle temps réel. Estimation 2-3j. Voir NEXTS.
- [ ] Étendre la réponse `GET /api/cameras` avec les capacités vérifiées dans un champ dédié (réservé à une itération suivante — `ptzSupported` booléen reste pour l'instant, calculé côté backend depuis `Camera.PtzSupported`)
- [ ] Marque reconnue : probe automatique silencieux à l'onboarding initial (auto-probe des bindings preset dès l'ajout d'une caméra connue, sans étape UI visible) — réservé à une itération suivante ; actuellement probe déclenché par l'utilisateur via le bouton "Tester"
- [ ] Tapo PTZ opt-in : après un probe PTZ réussi, mettre à jour `Camera.ptzSupported = true` automatiquement pour que le panneau PTZ apparaisse dans le live feed — réservé à une itération suivante (limitation documentée)


### NEXTS

- [ ] **PTZ précis V380 Pro via port 8800 (protocole propriétaire)** : port ouvert, répond à un paquet binaire Sofia-like en 205ms (`9c ff ff ff` = -100 LE = rejet de notre format). Protocole non standard, magic bytes différents du DVRIP classique (`ff000000`). Estimation 2-3j de reverse-engineering pour obtenir login + ContinuousMove + Stop. L'app native V380 utilise ce protocole et permet un contrôle précis sans la limitation 3s du serveur ONVIF. Scripts de probe dans `tools/camera-probe/probe_8800.py`.

- [ ] **Réveil a distance des cameras DVRIP sur batterie — investigation close, non implementable.** Le chipset WiFi reste en 802.11 PSM (Power Save Mode) : il repond aux pings ICMP (~510ms) au niveau NIC sans reveiller le processeur principal. TCP knock et UDP discovery (payload DVRIP 0x0590, WS-Discovery ONVIF, WoL magic packet) ont tous echoue — aucun port n'est ouvert en veille. Le seul mecanisme de reveil est un WoWLAN pattern filter proprietaire programme dans le NIC par le firmware ICSee, declenche via leur canal cloud (connexion persistante maintenue par le NIC). Non accessible sans reverse-engineering. **Limitation acceptee** : l'utilisateur doit reveiller la camera manuellement via l'app ICSee avant la verification DVRIP.
==> non acceptable, il faudra implémenter un WoL et faire une inspection de paquet pour déclencher le réveil de la caméra.
- [ ] Notification de l'utilisateur pour des evennements système (camera offline, batterie faible, systeme boot, mise à jour effectuée ...). Configurable!
- [ ] Canal discord et notification vers des groupes
- [ ] tests end 2 end (playwright) pour chaque US des SPECS.
- [ ] integration automatisation et scenario via Home Assistant ? Gestion de capteur d'ouverture, detection de mouvement, présence etc.
- [ ] Optimisation des performances de frigate en fonction des ressources disponibles (CPU, RAM, GPU) et de la charge de travail (nombre de caméras, résolution, FPS). Ajustement dynamique des paramètres de détection et d'enregistrement pour maintenir un équilibre entre qualité et performance.

---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
