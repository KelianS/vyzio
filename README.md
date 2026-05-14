# Vyzio

> **Votre maison surveille. Vos données restent chez vous.**

---

## Vision

Ring, Nest, Arlo : la surveillance cloud devient la norme. Vos images chez Amazon, Google, Arlo. Abonnement obligatoire. Dépendance totale à internet.

**Vyzio prend le contre-pied radical.**

Vyzio est une solution de surveillance domestique **prête à brancher, sans technicité, sans abonnement**, conçue pour les familles qui en ont assez de la complexité. En s'appuyant sur Frigate pour l'analyse vidéo locale, Vyzio rend la reconnaissance des personnes, les alertes utiles et la configuration accessibles sans exposer l'utilisateur à la complexité technique sous-jacente.

**Vyzio, c'est Frigate sans les technicitures.** Pour quelqu'un qui veut juste que ça marche. Avec du support français si ça casse.

---

## Fonctionnalités clés

- **Identification locale des personnes** — Frigate reconnait localement les visages et Vyzio transforme ces signaux en alertes compréhensibles.
- **Notifications intelligentes** — Vyzio priorise les alertes et les rend lisibles pour un usage non-tech. Pas de spam, seulement ce qui compte.
- **Compatible caméras IP existantes** — Protocoles RTSP / ONVIF. Vos caméras actuelles fonctionnent, pas besoin de tout racheter.
- **Stockage local des enregistrements** — Vos vidéos sont archivées sur votre propre machine, pas sur le cloud d'un tiers.
- **Offline-first & résilient** — Le système fonctionne sans connexion internet. Les notifications sont envoyées dès que le réseau est disponible.
- **Dashboard de gestion** — Interface web pour gérer les caméras, les profils produit, les règles métier et les alertes.
- **Détection d'événements** — Frigate capte et publie les événements ; Vyzio les filtre, les classe et les exploite dans les parcours produit.

---

## Deux façons d'utiliser Vyzio

Vyzio s'adapte à votre profil : appliance clef-en-main ou open source.

### Offering Matériel — Plug & Play, pour grand public
Une **petite boîte, zéro installation**, branchée sur votre réseau. Détection automatique de vos caméras IP existantes, configuration entièrement guidée, et c'est fini. 

Si quelque chose se casse, vous appelez du support français. C'est ça, le produit.

Installation à domicile disponible en option.

### Offering Open Source — Pour les makers
Voulez installer vous-même ? Repo open source complet, Docker Compose. Mais c'est pour les gens qui savent ce qu'ils font — pas de support inclus.

---

## Pourquoi Vyzio ?

|  | Ring / Nest / Arlo | Vyzio |
|---|:---:|:---:|
| Vos images sont stockées chez vous | ✗ | ✓ |
| Reconnaissance faciale locale | ✗ | ✓ |
| Fonctionne sans internet | ✗ | ✓ |
| Open Source | ✗ | ✓ |
| Compatible caméras IP tierces | Limité | ✓ |
| Abonnement obligatoire | ✓ | Non |

---

## Nos engagements

- **Privacy by design** — Le traitement IA se fait localement. Aucune image n'est envoyée à des serveurs tiers sans consentement explicite.
- **Transparence** — Le code source du moteur core est ouvert. Vous pouvez auditer ce que Vyzio fait de vos données.
- **Résilience** — Pas de dépendance à un cloud externe pour les fonctions critiques. Votre système continue de tourner même en cas de panne internet.
- **Interopérabilité** — Pas de vendor lock-in sur le matériel. Vyzio fonctionne avec l'écosystème de caméras IP existant.

---

## Statut du projet

> ⚠️ Vyzio est actuellement en **phase de conception**. Ce dépôt contient la vision du produit, les spécifications fonctionnelles, les décisions d'architecture et le plan de reprise. Le développement actif reprend une fois ces documents alignés.

Les contributions sur la vision, les cas d'usage et les spécifications sont les bienvenues dès maintenant.

---

## Contribuer

Vyzio est un projet open source. Les contributions sont bienvenues sur :
- L'intégration produit autour de Frigate
- Les parcours backend (.NET) et règles métier
- L'interface de gestion (dashboard)
- La qualité du runtime local et de l'expérience d'installation
- La documentation

---

## Documentation

- [Spécifications fonctionnelles](docs/SPECS.md)
- [Architecture logicielle](docs/SAD.md)
- [Backlog de reprise](docs/BACKLOG.md)
- [Business Plan](docs/BUSINESS_PLAN.md)
- [Documentation utilisateur](docs/user/CAMERA_ONBOARDING.md)
- [Documentation utilisateur notifications](docs/user/TELEGRAM_NOTIFICATIONS.md)
- [Design System](docs/DESIGN%20SYSTEM.md)
