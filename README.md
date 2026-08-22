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
- **Contrôle unifié de toutes vos caméras** — PTZ, mode vie privée matériel, réglages image (luminosité, contraste) et, à terme, l'appairage Wi-Fi. Vyzio pilote directement vos caméras, via leur protocole propriétaire si nécessaire — fini les applis constructeur pleines de pub et de trackers, tout se gère au même endroit.
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

## Démarrage rapide

> **Prérequis** : Linux avec Docker Engine 25+ et Docker Compose v2. Testé sur Debian, Ubuntu, Raspberry Pi OS (64-bit).

### Installation

```bash
# Télécharger le docker-compose.yml
curl -O https://raw.githubusercontent.com/KelianS/vyzio/main/docker-compose.yml

# Lancer la stack
docker compose up -d
```

Ouvrir `http://<IP_SERVEUR>:8080` et configurer depuis l'interface.

### Variables d'environnement

Toutes les valeurs ont des défauts prêts pour la production. Surcharger via les variables `VYZIO_*` dans `docker-compose.yml` :

| Variable | Défaut | Description |
|---|---|---|
| `VYZIO_TIME_ZONE` | TZ système | Fuseau horaire IANA, ex. `Europe/Paris` |
| `VYZIO_DISCOVERY_PROBE_CIDRS` | *(aucun)* | Plage réseau pour la détection des caméras, ex. `192.168.1.0/24` |
| `VYZIO_FRIGATE_API_BASE_URL` | `http://frigate:5000` | URL interne Frigate (ne pas modifier sauf déploiement custom) |

Liste complète dans [`CONTRIBUTING.md`](./CONTRIBUTING.md).

### Mise à jour

```bash
# Mettre à jour vers la dernière version stable
docker compose pull
docker compose up -d
```

### Prérequis matériel recommandés

| | Minimum | Recommandé |
|---|:---:|:---:|
| CPU | 4 cœurs | 6+ cœurs |
| RAM | 4 Go | 8 Go |
| Stockage | 32 Go | 500 Go+ (selon rétention vidéo) |

> La détection IA (Frigate) est gourmande en CPU. Une NPU ou un GPU dédié améliore significativement les performances au-delà de 2-3 caméras.

---

## Statut du projet

> Vyzio est en **développement actif**. L'infrastructure de production est en place (CI/CD, images Docker, déploiement Docker Compose). Les fonctionnalités core sont opérationnelles : gestion des caméras, détection IA via Frigate, reconnaissance de personnes, notifications Telegram, live feed, clips et historique des détections.

Les contributions sont bienvenues, voir [`CONTRIBUTING.md`](./CONTRIBUTING.md) pour le workflow de développement.

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
- [Modes d'emploi hérités](docs/user/) — l'aide vit désormais dans l'interface ([ADR-53](docs/adr/0053-la-doc-utilisateur-vit-dans-l-interface-trois-niveaux-d-aide.md))
- [Design System](docs/DESIGN%20SYSTEM.md)
