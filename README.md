# Vyzio

> **Votre maison surveille. Vos données restent chez vous.**

---

## Vision

Ring, Nest, Arlo : la surveillance cloud devient la norme. Vos images chez Amazon, Google, Arlo. Abonnement obligatoire. Dépendance totale à internet.

**Vyzio prend le contre-pied radical.**

Vyzio est une solution de surveillance domestique **prête à brancher, sans technicité, sans abonnement**, conçue pour les familles qui en ont assez de la complexité. Grâce à l'IA embarquée, Vyzio reconnaît les visages, identifie les personnes connues, et vous notifie en temps réel — tout cela localement, sans que vos images ne quittent votre maison.

**Vyzio, c'est Frigate sans les technicitures.** Pour quelqu'un qui veut juste que ça marche. Avec du support français si ça casse.

---

## Fonctionnalités clés

- **Reconnaissance faciale IA** — Identifie les membres du foyer, les amis réguliers, les livreurs. Alerte immédiatement sur tout visage inconnu.
- **Notifications intelligentes** — Push mobile avec photo + nom (si connu) ou alerte "visage inconnu". Pas de spam, seulement ce qui compte.
- **Compatible caméras IP existantes** — Protocoles RTSP / ONVIF. Vos caméras actuelles fonctionnent, pas besoin de tout racheter.
- **Stockage local des enregistrements** — Vos vidéos sont archivées sur votre propre machine, pas sur le cloud d'un tiers.
- **Offline-first & résilient** — Le système fonctionne sans connexion internet. Les notifications sont envoyées dès que le réseau est disponible.
- **Dashboard de gestion** — Interface web pour gérer les caméras, les profils de personnes, les zones de détection et les alertes.
- **Détection d'événements** — Mouvement, intrusion, présence prolongée. Paramétrable par zone et par plage horaire.

---

## Trois façons d'utiliser Vyzio

Vyzio s'adapte à votre préférence : matériel, cloud ou open source.

### Offering Matériel — Plug & Play, pour grand public
Une **petite boîte, zéro installation**, branchée sur votre réseau. Détection automatique de vos caméras IP existantes, configuration entièrement guidée, et c'est fini. 

Si quelque chose se casse, vous appelez du support français. C'est ça, le produit.

Installation à domicile disponible en option.

### Offering Cloud — Pas de matériel, abonnement en ligne
Pas d'envie de brancher une boîte ? Nous gérons la solution pour vous via un abonnement, sur infrastructure française. Vos caméras communiquent en chiffré. Mêmes garanties privacy.

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
| Abonnement obligatoire | ✓ | Non (Matériel / Open Source) |

---

## Nos engagements

- **Privacy by design** — Le traitement IA se fait localement. Aucune image n'est envoyée à des serveurs tiers sans consentement explicite.
- **Transparence** — Le code source du moteur core est ouvert. Vous pouvez auditer ce que Vyzio fait de vos données.
- **Résilience** — Pas de dépendance à un cloud externe pour les fonctions critiques. Votre système continue de tourner même en cas de panne internet.
- **Interopérabilité** — Pas de vendor lock-in sur le matériel. Vyzio fonctionne avec l'écosystème de caméras IP existant.

---

## Statut du projet

> ⚠️ Vyzio est actuellement en **phase de conception**. Ce dépôt contient la vision, les spécifications fonctionnelles et la roadmap technique. Le développement actif commence prochainement.

Les contributions sur la vision, les cas d'usage et les spécifications sont les bienvenues dès maintenant.

---

## Contribuer

Vyzio est un projet open source. Les contributions sont bienvenues sur :
- Le moteur de détection et reconnaissance (core engine)
- Les intégrations caméras (RTSP, ONVIF, drivers)
- Les modèles IA (reconnaissance faciale, détection d'événements)
- L'interface de gestion (dashboard)
- La documentation

---

## Documentation

- [Spécifications fonctionnelles](docs/SPECS.md)
- [Business Plan](docs/BUSINESS_PLAN.md)
