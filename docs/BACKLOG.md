# Vyzio — Backlog
> References : [SPECS.md](./SPECS.md) · [SAD.md](./SAD.md) · [README.md](../README.md)

Le workflow obligatoire est defini dans les regles du repo, fichier `.instructions.md`.

---

## Role de ce document

Ce backlog ne sert pas a brainstormer la strategie.

Il traduit en ordre d'execution une direction deja decidee dans les SPECS et le SAD. Tant que ces documents ne sont pas alignes, le backlog ne doit pas servir a pousser du code.

---

### 1.0.0 - P3 - Support protocole dvrip/XMEye comme fallback (cameras sans RTSP)
> But : permettre l'integration de cameras qui n'exposent pas de RTSP natif (tout firmware Xiongmai : ICSee, Annke, Sannce, Zosi, etc.) via go2rtc comme passerelle transparente. **Le RTSP reste le chemin principal** ; dvrip est propose uniquement quand le port 34567 est detecte et que RTSP est absent. Voir [ADR-19](./SAD.md).

**Taches :**
- [x] Ajouter le champ `StreamProtocol` (`"rtsp"` | `"dvrip"`, defaut `"rtsp"`) sur l'entite `Camera` + migration EF Core
- [x] Mettre a jour `FrigateConfigApplier` : generer la section `go2rtc` quand au moins une camera active a `StreamProtocol == "dvrip"`, et pointer l'input ffmpeg vers `rtsp://127.0.0.1:8554/{slug}` pour ces cameras
- [x] Mettre a jour le parcours UI d'ajout de camera : quand le signal `dvrip_port_detected` est present (toute marque), proposer le mode dvrip comme fallback si RTSP indisponible, avec explication contextuelle sur les limitations (batterie, reveil necessaire)
- [x] Tests unitaires sur `FrigateConfigApplier` : generation correcte de la section `go2rtc` pour les cameras dvrip, absence de la section pour les cameras RTSP seules
- [x] Mettre a jour `vendors/icsee.md` : presenter dvrip comme chemin de fallback (apres tentative RTSP)

**Criteres de validation :**
- Une camera avec `dvrip_port_detected` peut etre ajoutee en mode dvrip via le parcours guide
- Une camera RTSP classique n'est pas affectee (pas de section `go2rtc` generee inutilement)
- Le parcours propose toujours RTSP en premier ; dvrip n'apparait que si RTSP echoue ou est absent
- L'utilisateur comprend la contrainte de reveil sans connaitre le protocole dvrip

---

### 1.0.1 - P1 - Privacy mode
> But : permettre à l'utilisateur de couper une caméra temporairement ou de manière récurrente (ex. tous les soirs de 22h à 6h) pour préserver la vie privée, avec un impact minimal sur les autres fonctionnalités (notifications, reconnaissance, etc.) et une indication claire du statut de confidentialité de chaque caméra. La caméra doit réellement être coupé et le flux RTSP ne doit être visible de personne sur le réseau, y compris de Frigate.

**Taches :**
TODO

### 1.0.1 - P2 - PTZ, camera info et controle avancé
> But : permettre à l'utilisateur de contrôler les caméras PTZ compatibles depuis l'interface Vyzio, avec des commandes de base (panoramique, inclinaison, zoom) et la possibilité de définir des positions prédéfinies pour un accès rapide. Toute info système exposée par la caméra (ex. température, état de la connexion, batterie, etc.) doit être affichée dans l'interface pour aider à la maintenance et au diagnostic.

**Taches :**
TODO

### NEXTS

- [ ] **Réveil a distance des cameras DVRIP sur batterie — investigation close, non implementable.** Le chipset WiFi reste en 802.11 PSM (Power Save Mode) : il repond aux pings ICMP (~510ms) au niveau NIC sans reveiller le processeur principal. TCP knock et UDP discovery (payload DVRIP 0x0590, WS-Discovery ONVIF, WoL magic packet) ont tous echoue — aucun port n'est ouvert en veille. Le seul mecanisme de reveil est un WoWLAN pattern filter proprietaire programme dans le NIC par le firmware ICSee, declenche via leur canal cloud (connexion persistante maintenue par le NIC). Non accessible sans reverse-engineering. **Limitation acceptee** : l'utilisateur doit reveiller la camera manuellement via l'app ICSee avant la verification DVRIP.
==> non acceptable, il faudra implémenter un WoL et faire une inspection de paquet pour déclencher le réveil de la caméra.


---

## Definition of done

Une story n'est pas terminee si un seul de ces points manque :

- objectif metier clair ;
- code minimal et lisible ;
- test ou verification executable adaptee ;
- documentation de cadrage a jour quand necessaire ;
- documentation utilisateur a jour pour une feature livrable ;
- absence de dependance implicite a une option non retenue.
