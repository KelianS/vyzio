# Vyzio — Business Plan

> Version 0.1 — Mai 2026 — Document confidentiel

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Marché et opportunité](#2-marché-et-opportunité)
3. [Offre et modèle de revenus](#3-offre-et-modèle-de-revenus)
4. [Analyse concurrentielle](#4-analyse-concurrentielle)
5. [Stratégie Go-to-Market](#5-stratégie-go-to-market)
6. [Structure de coûts](#6-structure-de-coûts)
7. [Projections financières](#7-projections-financières)
8. [Équipe et organisation](#8-équipe-et-organisation)
9. [Risques et mitigation](#9-risques-et-mitigation)
10. [Roadmap et jalons](#10-roadmap-et-jalons)

---

## 1. Résumé exécutif

**Vyzio** est un **appliance de surveillance domestique clef-en-main**, conçue pour le **grand public non-tech** qui ne veut plus dépendre d'Amazon, Google ou Arlo.

Ce qui différencie Vyzio : **support français + installation + garantie que ça marche.** Pas un produit geek pour makers. Un produit pour Monsieur-Madame lambda qui veut juste que ses caméras fonctionnent et ne donnent pas ses images à une boîte américaine.

**Le problème :** Ring/Nest/Arlo = cloud propriétaire + abonnement obligatoire + dépendance internet. Frigate = excellent pour les makers, incompréhensible pour le reste. Umbrel = très bon OS pour self-hosted, mais toujours pour les tech-aware. **Aucun acteur n'offre : surveillance locale simple, zéro configuration, support humain français.**

**La solution :** **Vyzio Hub** — Mini-PC pré-configuré avec Frigate + IA embarquée. L'utilisateur branche, c'est prêt. Ses données restent chez lui. S'il y a problème : support français inclus.

**Offres :**
- **Vyzio Hub** (prioritaire) — €349 matériel + €12/mois support optionnel → Cible : familles urbaines, PME, syndics
- **Vyzio Cloud** — €9.99-39.99/mois pour qui n'a pas de matériel
- **DIY** — Repo open source, gratuit, pour makers (validation communautaire, pipeline recrutement Hub/Cloud)

**Traction cible :** 200 Hub + 50 Cloud à M12, 1 000 Hub + 300 Cloud à M24.

**Moat défensif :** Support humain français + certification caméras + intégrations testées = non facilement replicable par Umbrel/CasaOS.

---

## 2. Marché et opportunité

### 2.1 Taille du marché

| Périmètre | Valeur estimée (2025) | Croissance annuelle |
|---|---|---|
| Marché mondial smart home security | ~12 Mds USD | ~14 % CAGR |
| Marché européen | ~2,5 Mds USD | ~12 % CAGR |
| Segment caméras IP grand public France | ~180 M€ | ~10 % |

Sources : MarketsandMarkets, Statista (estimations).

### 2.2 Tendances favorables

- **Montée en puissance du mouvement privacy** — RGPD, scandales de données, méfiance envers les GAFAM
- **Explosion du mouvement "self-hosted"** — Home Assistant (500k+ utilisateurs), Jellyfin, Nextcloud : une communauté tech massive cherche des alternatives locales
- **Souveraineté numérique** — Forte sensibilité française et européenne sur l'hébergement des données
- **Maturité des caméras IP** — Le parc installé est énorme ; les utilisateurs ne veulent pas tout racheter
- **Coût de l'IA embarquée en baisse** — Les SBC (Raspberry Pi, mini-PC) sont suffisamment puissants pour faire tourner des modèles de reconnaissance faciale

### 2.3 Segment cible

**Cœur de cible (PRIMARY) :**
- **Familles urbaines** (Paris, Lyon, Marseille) : 30-50 ans, propriétaires/accédants, sensibles à la vie privée & souveraineté
  - Aujourd'hui : Ring, Nest, ou rien (peur de la complexité)
  - Problema : abonnement obligatoire, données cloud
  - Désir : surveillance locale simple, zéro technicité, support français

- **PME / Petits commerces** (cafés, restaurants, petits hôtels) : besoin de surveillance locale, pas d'IT interne
  - Aujourd'hui : NAS Synology complexe, ou caméras IP avec cloud propriétaire
  - Problema : trop cher, trop technique, support inexistant en français
  - Désir : surveillance locale, intégration PoE facile, quelqu'un à appeler si ça casse

- **Syndics / Immobilier** : surveiller espaces communs sans dépendre du cloud
  - Conformité RGPD + donnée locale = critère clé

**Cible secondaire :**
- Seniors, non-tech, souhaitant surveiller leur maison (via Hub tout configuré)
- Makers tech-aware qui veulent une alternative Frigate avec support (DIY ou Hub)

---

## 3. Offre et modèle de revenus

### 3.1 Vyzio Hub (PRIORITAIRE)

**Positionnement :** L'appliance surveillance clef-en-main pour grand public  
**Modèle :** Vente unitaire du hardware + abonnement support optionnel

| Composant | Coût estimé | Prix de vente | Marge brute |
|---|---|---|---|
| Mini-PC (N100 / N150, 8 Go RAM, 256 Go SSD) | ~120 € | **349 €** | ~229 € (~66 %) |
| Installation à domicile (optionnel) | ~80 € coût | 149 € | ~69 € |
| Support annuel (prioritaire, mise à jour, hotline) | ~10 €/an | **12 €/mois (~144 €/an)** | ~134 €/an |

**Value prop Hub :** 
- Plug & Play (zéro configuration)
- Support français inclus
- Mises à jour OTA automatiques
- Reconnaissance faciale embarquée
- Compatible caméras IP existantes (PoE, WiFi)

**Revenus primaires :** Vente Hub. **Revenus récurrents :** Abonnement support (opt-in, ~40-50 % des utilisateurs).

### 3.2 Vyzio Cloud (SECONDAIRE)

**Positionnement :** Pour qui n'a pas d'équipement à la maison, abonnement cloud français  
**Modèle :** Abonnement mensuel (SaaS)

| Plan | Caméras | Stockage | Prix/mois |
|---|---|---|---|
| Starter | 2 caméras | 7 jours | 9,99 € |
| Family | 5 caméras | 30 jours | 19,99 € |
| Premium | 10 caméras | 90 jours | 39,99 € |

- Facturation mensuelle ou annuelle (remise 15 % pour l'annuel)
- Essai gratuit 30 jours
- Infrastructure OVHcloud (France)

### 3.3 DIY — Open Source (VALIDATION + PIPELINE)

**Positionnement :** Repo open source, gratuit, pour makers qui veulent faire eux-mêmes  
**Revenus directs :** Aucun  
**Rôle stratégique :**
- Validation du produit en conditions réelles (feedback makers)
- Pipeline de recrutement pour Hub/Cloud (makers → hub besoin support → client Hub)
- Contributions externes (améliorations, intégrations)
- Notoriété technique (GitHub stars = crédibilité)

### 3.4 Revenus additionnels (moyen terme)

- **Installation à domicile** — Service payant pour Hub (€149, marche partenaires locaux)
- **Formation installateurs** — Programme certification pour artisans domotique (marque blanche)
- **Support premium 24/7** — Tier support supérieur pour PME/syndics (€29/mois)
- **Aides publiques** — Éligibilité potentielle RGPD/souveraineté numérique (BPI)

---

## 4. Analyse concurrentielle

### 4.1 Positionnement

| Critère | Ring | Nest | Arlo | Frigate | **Vyzio** |
|---|:---:|:---:|:---:|:---:|:---:|
| Données stockées localement | ✗ | ✗ | ✗ | ✓ | ✓ |
| Reconnaissance faciale locale | ✗ | Partiel | ✗ | ✗ | ✓ |
| Fonctionne sans internet | ✗ | ✗ | ✗ | ✓ | ✓ |
| Open Source | ✗ | ✗ | ✗ | ✓ | ✓ |
| Compatible caméras IP tierces | ✗ | Limité | ✗ | ✓ | ✓ |
| Abonnement obligatoire | ✓ | ✓ | ✓ | ✗ | Non (DIY/Hub) |
| Clef en main | ✓ | ✓ | ✓ | ✗ | ✓ (Hub/Cloud) |
| Dashboard moderne | ✓ | ✓ | ✓ | Basique | ✓ |
| Infrastructure française | ✗ | ✗ | ✗ | N/A | ✓ (Cloud) |

### 4.2 Analyse des acteurs clés

**Ring (Amazon) / Nest (Google) / Arlo**
- Leaders sur cloud centralisé + abonnement obligatoire
- Bonnes UX mais dépendance cloud, données US
- **Notre avantage :** local-first, support français, zéro abonnement obligatoire
- **Risque :** ils pourraient lancer une offre "on-premise", mais peu probable (business model cloud)

**Synology (NAS)**
- Excellente fiabilité, support, RGPD-friendly
- Surveillance Station intégrée
- **Faiblesse :** €500+ (trop cher), perçu comme "pour IT" (pas accessible grand public), pas de support français spécialisé
- **Notre avantage :** prix (€349 vs €500), UX simplifiée, support français

**Frigate (open source)**
- Excellente technologie, très populaire chez makers
- NVR complet, reconnaissance faciale, détection YOLO
- **Faiblesse :** zéro UX grand public, zéro support, zéro product
- **Notre positionnement :** on utilise Frigate en backbone, on ajoute la UX/support/product
- **Risque faible :** Frigate pourrait lancer une "appliance clef-en-main", mais fondateur est open source ideologue (unlikely)

**Umbrel / CasaOS**
- OS simplifié pour self-hosted (app store modèle)
- Croissance rapide, communauté active
- **Faiblesse :** support zéro, pour tech-aware, pas de focus sécurité/surveillance
- **Notre positionnement :** On cible non-tech (Umbrel = makers), on cible sécurité (ils sont multitâche), on offre support (ils n'en ont pas)
- **Complémentaires plus que concurrents :** maker tech-aware utilise Umbrel, Madame Dupont utilise Vyzio Hub

### 4.3 Avantage concurrentiel durable (MOAT)

1. **Support français humain** — Le vrai moat. Pas juste un produit, un service. Umbrel, CasaOS n'ont pas ça.
2. **Certification caméras testées** — Vyzio garantit 5-10 marques de caméras (PoE, WiFi) qui "marchent". Frigate = à l'utilisateur de debugger.
3. **Installation à domicile** — Service optionnel, but creates stickiness. Aucun concurrent ne l'offre.
4. **Privacy by design + souveraineté française** — Non negotiable. Infrastructure locale ou OVHcloud, RGPD by design.
5. **UX pensée pour non-tech** — Pas une architecture lambda, design intentionnel pour "ma grand-mère peut l'utiliser".

**Protections contre les concurrents :**
- Frigate evolution = on fork ou on reste sur v0.17, on continue
- Amazon/Google lancent alternatif on-premise = notre moat support + prix les neutralise
- Umbrel lance appliance sécurité = on est déjà sur le marché avec la communauté

---

## 5. Stratégie Go-to-Market

### 5.1 Phase 1 — Lancement communautaire (M0 à M6)

**Objectif :** 500 étoiles GitHub, 100 utilisateurs DIY actifs, première couverture presse tech

**Actions :**
- Publication du code open source avec documentation complète
- Posts sur les communautés clés : Reddit (r/homeassistant, r/selfhosted, r/privacy), Hacker News, forums français (Next INpact, Korben)
- Intégration Home Assistant officielle (add-on)
- Blog technique sur les choix d'architecture (transparence = crédibilité)
- Démo vidéo : installation en 10 minutes

### 5.2 Phase 2 — Lancement Hub (M6 à M12)

**Objectif :** 200 Hub vendus, 50 abonnés Cloud

**Actions :**
- Campagne de précommande (Kickstarter ou direct)
- Partenariats installateurs de caméras IP (BtoB indirect)
- Relations presse : médias tech français (01net, Numerama, Les Numériques) + médias privacy (La Quadrature du Net, etc.)
- Programme d'ambassadeurs communautaires
- SEO sur des mots-clés à fort potentiel : "caméra surveillance sans abonnement", "alternative Ring open source", "NVR local"

### 5.3 Phase 3 — Croissance (M12 à M24)

**Objectif :** 2 000 utilisateurs actifs (toutes offres), rentabilité opérationnelle

**Actions :**
- Publicité ciblée (Google Ads, Meta) sur segments privacy/tech
- Programme revendeurs / installateurs certifiés
- Expansion internationale (Belgique, Suisse, Allemagne)
- Partenariats distributeurs (Amazon FR, LDLC, Darty pour le Hub)
- Lancement application mobile native

### 5.4 Canaux d'acquisition (Hub)

| Canal | Phase | CAC estimé | Stratégie |
|---|---|---|---|
| Bouche-à-oreille / NPS | 2, 3 | €0 | Prioritaire — non-tech aime recommander "qui marche" |
| SEO local + "no geek" keywords | 2, 3 | €10-20 | "surveillance sans amazon", "caméra locale" |
| Installateurs partenaires | 3 | €0 (commission) | Artisans, électriciens = distribution naturelle |
| Presse grand public + Reddit | 2, 3 | ~€30 PR | Pas HackerNews, plutôt "Madame Figaro tech" |
| Google Ads (phase 3) | 3 | €50-80 | Ciblage non-tech, long tail keywords |
| YouTube démo simple | 2, 3 | €0 | "Je branche, c'est prêt" viral potential |

**Stratégie différente de SaaS tech :** CAC dépend du bouche-à-oreille + qualité produit, pas de performance marketing agressif.

---

## 6. Structure de coûts

### 6.1 Coûts de développement (année 1)

| Poste | Détail | Coût annuel estimé |
|---|---|---|
| Développement core | 1-2 développeurs (fondateurs ou freelance) | 0-120 k€ |
| Infrastructure Cloud | Serveurs OVHcloud / Scaleway (staging + prod) | ~6 k€/an |
| Outils & licences | GitHub, CI/CD, monitoring | ~2 k€/an |
| Design / UX | Dashboard, marketing site | ~5 k€ |
| Juridique | RGPD, CGV, mentions légales | ~3 k€ |

### 6.2 Coûts liés au Hub

| Poste | Par unité |
|---|---|
| Hardware (mini-PC + emballage) | ~125 € |
| Logistique / livraison | ~15 € |
| SAV estimé (2 % taux retour) | ~3 € provisionnés |
| **Total coût par Hub** | **~143 €** |

Prix de vente cible : **249 €** → Marge brute : **~106 € (43 %)**

### 6.3 Coûts Cloud (par abonné actif)

| Poste | Coût mensuel estimé |
|---|---|
| Compute (analyse IA) | ~1,50 € |
| Stockage vidéo (30j, 2 cam) | ~0,80 € |
| Bande passante | ~0,40 € |
| Support | ~0,30 € |
| **Total coût par abonné Starter** | **~3,00 €** |

Marge brute Cloud Starter : 9,99 € - 3,00 € = **~6,99 € (70 %)**

---

## 7. Projections financières

### 7.1 Hypothèses

- Lancement DIY : M1
- Lancement Hub : M6
- Lancement Cloud : M6
- Croissance conservatrice la première année, accélération en année 2

### 7.2 Scénario de base — Revenus

| Mois | Hubs vendus (cumulé) | Abonnés Cloud | Revenu mensuel Hub | Revenu mensuel Cloud | **Total mensuel** |
|---|---|---|---|---|---|
| M6 | 10 | 20 | 2 490 € | 200 € | **2 690 €** |
| M9 | 50 | 60 | 9 950 € | 600 € | **10 550 €** |
| M12 | 120 | 150 | 5 600 €* | 1 500 € | **7 100 €** |
| M18 | 350 | 400 | 6 200 €* | 4 000 € | **10 200 €** |
| M24 | 700 | 900 | 8 750 €* | 9 000 € | **17 750 €** |

*Revenu Hub = ventes du mois × marge brute (~106 €) + abonnements support récurrents

### 7.3 Seuil de rentabilité

- Avec une structure légère (2 fondateurs, pas de salariés en phase 1) : **~M14-M16**
- Avec 1 salarié supplémentaire dès M12 : **~M20-M22**

### 7.4 Besoins en financement

| Scénario | Montant | Usage |
|---|---|---|
| Bootstrapped | 0-20 k€ | Infrastructure, juridique, 1er stock Hub |
| Love money / amorçage | 50-150 k€ | Accélération marketing, stock Hub, 1 recrutement |
| Seed | 300-500 k€ | Équipe, distribution, expansion européenne |

---

## 8. Équipe et organisation

### 8.1 Profils clés nécessaires

| Rôle | Compétences | Priorité |
|---|---|---|
| CTO / Lead Dev | Backend (Rust/.NET), IA, Docker/K8s | Critique (fondateur) |
| Product / CEO | Vision produit, business, GTM | Critique (fondateur) |
| Dev Frontend | TypeScript, React/Vue | Phase 2 |
| Dev IA / ML | Computer Vision, PyTorch, InsightFace | Phase 1-2 |
| Growth / Marketing | SEO, communautés tech, presse | Phase 2 |

### 8.2 Structure juridique recommandée

- **SAS** — Flexibilité, attractivité pour les investisseurs, régime IR possible en phase early
- Domiciliation : France (cohérent avec la promesse souveraineté)
- Enregistrement à l'INPI + dépôt marque "Vyzio"

---

## 9. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| **Frigate évolue et devient appliance clef-en-main** | Moyenne | Moyen | On reste sur stable version (0.17), on fork si besoin. Notre moat = support/UX, pas techno |
| **Amazon/Google lancent appliance local "Ring Protect Local"** | Basse | Élevé | Notre prix + support FR + ecosystem ouvert les neutralise. Ils sont cloud-first (business model) |
| **Umbrel/CasaOS lancent appliance sécurité** | Basse | Moyen | Cible différente (makers vs. non-tech). Complémentaires. Notre moat = support français |
| Réglementation reconnaissance faciale (IA Act EU) | Moyenne | Moyen | Usage résidentiel privé exempté. Veille juridique. Dans worst case = on désactive IA, garde surveillance |
| Problèmes supply chain Hub (délai production) | Moyenne | Moyen | Multi-source hardware, drop-in compatibility. Pré-commander composants |
| Support explosif (trop de tickets) | Haute | Moyen | Documenter, FAQ, chatbot first-line. Capping utilisateurs avant support saturé |
| Adoption lente (marché plus petit que prévu) | Moyenne | Élevé | Pivoter vers B2B2C (revendeurs, installateurs) avant rupture |
| Fuite données Cloud / incident sécurité | Basse | Très élevé | Architecture chiffrement natif, pen testing régulier, assurance cyber, incident response plan |

---

## 10. Roadmap produit

### V1 (M0-M6) — MVP clef-en-main
**Focus :** Sécurité + reconnaissance faciale, zéro complexity
- [x] Frigate intégré (moteur NVR)
- [x] Reconnaissance faciale InsightFace embarquée
- [x] Notifications mobile (FCM)
- [x] Dashboard ultra-simple (5 écrans max)
- [x] Auto-discovery caméras ONVIF
- [x] Support 5-10 marques caméras certified
- [x] Détection mouvement + visage inconnu
- [x] Installation 5 minutes = préconfiguré

### V2 (M6-M12) — Intégrations & support
- Home Assistant intégration légère (optionnel, pour détection supplémentaire)
- Application mobile native
- Support français hotline
- Support 24/5
- Programme installer partenaires

### V3 (M12+) — Extension
- Jellyfin intégration (media server optional)
- Home Assistant plus profond (automation simple)
- API pour syndics/PME B2B
- Expansion européenne (EN/DE/BE)

### Jalons clés

| Jalon | Cible | Critère |
|---|---|---|
| MVP + Bêta fermée | M4 | 20 users non-tech, 1h installation, zéro tickets |
| Lancement public | M6 | DIY repo + Hub précommande |
| 100 Hubs vendus | M8 | Support tient bon (< 2h response) |
| Rentabilité opérationnelle | M16+ | Hub margin couvre coûts support |
| 500 users total | M12 | 300 Hub + 200 Cloud |

**Philosophie :** Faire une chose bien (sécurité/surveillance) avant d'étendre. V1 = meilleur produit pour surveiller sa maison. V2+ = on expand si demande.
