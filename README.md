# Vyzio

> **Votre maison surveille. Vos données restent chez vous.**

---

## Vision

Ring envoie vos images chez Amazon. Nest les stocke chez Google. Arlo vend un abonnement pour accéder à vos propres enregistrements.

**Vyzio prend le contre-pied radical.**

Vyzio est une solution de surveillance domestique **autonome, résiliente et privacy-first**, conçue pour le grand public. Grâce à l'intelligence artificielle embarquée, Vyzio reconnaît les visages, identifie les personnes connues, et vous notifie en temps réel sur votre téléphone — avec la photo et le nom de la personne si elle est enregistrée. Tout cela sans qu'un seul octet de vos images ne quitte votre réseau local... sauf si vous en décidez autrement.

La surveillance intelligente ne devrait pas exiger de faire confiance à une entreprise tierce avec les images de votre domicile et de votre famille.

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

Vyzio s'adapte à votre profil, de l'utilisateur le plus tech-savvy au plus novice.

### DIY — Open Source
Pour les makers et les technophiles. Installez Vyzio sur votre propre machine (PC, NAS, serveur), configurez vos caméras, et gardez un contrôle total. **100 % gratuit, 100 % open source.** La communauté est au cœur du projet.

### Vyzio Hub — Clef en main, privacy garantie
Vous ne voulez pas gérer un serveur. Vyzio vous fournit un **mini-PC dédié, pré-configuré**, prêt à brancher chez vous. Installation à domicile disponible en option. Vos données restent sur votre machine, dans votre foyer. Zéro abonnement obligatoire.

### Vyzio Cloud — Sans matériel, sans friction
Pas de serveur, pas de configuration. Vyzio héberge le compute pour vous via un abonnement mensuel. Compatible avec vos caméras IP existantes. Idéal pour une mise en route rapide, avec un engagement fort sur la confidentialité des données.

---

## Pourquoi Vyzio ?

|  | Ring / Nest / Arlo | Vyzio |
|---|:---:|:---:|
| Vos images sont stockées chez vous | ✗ | ✓ |
| Reconnaissance faciale locale | ✗ | ✓ |
| Fonctionne sans internet | ✗ | ✓ |
| Open Source | ✗ | ✓ |
| Compatible caméras IP tierces | Limité | ✓ |
| Abonnement obligatoire | ✓ | Non (DIY / Hub) |

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

- [Spécifications fonctionnelles](SPECS.md)
- [Business Plan](BUSINESS_PLAN.md)
