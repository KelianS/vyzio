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

**Vyzio** est une solution de surveillance domestique intelligente, locale et privacy-first. Face à des acteurs dominants (Ring/Amazon, Nest/Google, Arlo) qui centralisent les données des utilisateurs dans leurs clouds, Vyzio prend le contre-pied : l'intelligence artificielle tourne chez l'utilisateur, les images ne quittent jamais son réseau sans son consentement.

**Le problème :** Les solutions existantes imposent un abonnement cloud obligatoire, stockent les images de votre domicile sur des serveurs tiers, et ne fonctionnent pas sans internet.

**La solution :** Un système de surveillance avec reconnaissance faciale IA embarquée, fonctionnant en local, offline-first, compatible avec les caméras IP existantes.

**Les trois offres :**
- **DIY** — Gratuit, open source, pour les technophiles
- **Vyzio Hub** — Mini-PC clef-en-main, vente unitaire, zéro abonnement obligatoire
- **Vyzio Cloud** — Abonnement mensuel sur infrastructure française, pour les utilisateurs sans matériel

**Traction cible :** 500 utilisateurs actifs à 12 mois post-lancement, 2 000 à 24 mois.

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

**Cœur de cible (early adopters) :**
- Hommes/femmes, 28-45 ans, CSP+
- Sensibles à la vie privée et à la souveraineté de leurs données
- Profil tech-savvy ou tech-curious
- Propriétaires ou locataires avec caméras IP existantes ou souhait d'en installer

**Cible secondaire :**
- Seniors souhaitant surveiller leur domicile sans complexité technique (via Hub)
- Petits commerces, TPE souhaitant une solution locale sans abonnement cloud

---

## 3. Offre et modèle de revenus

### 3.1 DIY — Open Source

**Positionnement :** Gratuit, communautaire, référence technique  
**Revenus directs :** Aucun  
**Rôle stratégique :**
- Construire la communauté et la notoriété
- Valider le produit en conditions réelles
- Pipeline de recrutement pour les offres payantes (Hub, Cloud)
- Contributions externes qui améliorent le produit

### 3.2 Vyzio Hub

**Positionnement :** Clef en main, privacy garantie, zéro abonnement obligatoire  
**Modèle :** Vente unitaire du hardware + marge

| Composant | Coût estimé | Prix de vente | Marge brute |
|---|---|---|---|
| Mini-PC (N100 / N150, 8 Go RAM, 256 Go SSD) | ~120 € | 249 € | ~129 € (~52 %) |
| Option installation à domicile | ~80 € coût (partenaires) | 149 € | ~69 € |
| Support prioritaire (optionnel, annuel) | ~10 €/an | 29 €/an | ~19 €/an |

**Revenus récurrents optionnels :**
- Abonnement support/mises à jour prioritaires : 29 €/an
- Extension stockage cloud chiffré (backup des clips) : 4,99 €/mois

### 3.3 Vyzio Cloud

**Positionnement :** Sans matériel, sans friction, infrastructure française  
**Modèle :** Abonnement mensuel (SaaS)

| Plan | Caméras | Rétention | Prix/mois |
|---|---|---|---|
| Starter | 2 caméras | 7 jours | 9,99 € |
| Family | 5 caméras | 30 jours | 19,99 € |
| Premium | 10 caméras | 90 jours | 39,99 € |

- Facturation mensuelle ou annuelle (remise 15 % pour l'annuel)
- Essai gratuit 30 jours, sans CB

### 3.4 Revenus additionnels (moyen terme)

- **API B2B** — Accès à l'engine de reconnaissance pour intégrateurs (ex. syndics, promoteurs immobiliers) : tarification à l'usage
- **Certifications partenaires** — Programme revendeurs pour installateurs de caméras
- **Subventions & aides** — Éligibilité potentielle aux aides à la souveraineté numérique (BPI, French Tech)

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

**Ring (Amazon)**
- Leader du marché grand public
- Ecosystem fermé, caméras propriétaires
- Abonnement Ring Protect obligatoire pour accéder aux enregistrements
- Controverses importantes sur le partage de données avec la police américaine
- **Faiblesse exploitable :** dépendance cloud totale, pas d'option locale

**Nest / Google Home**
- Intégration forte avec l'écosystème Google
- Reconnaissance faciale limitée aux abonnés Nest Aware
- Traitement cloud uniquement
- **Faiblesse exploitable :** utilisateurs réticents à donner leurs images vidéo à Google

**Frigate (open source)**
- NVR local open source, très populaire dans la communauté Home Assistant
- Excellente détection d'objets (YOLO)
- Pas de reconnaissance faciale native, pas de produit clef-en-main, pas de notifications mobile natives
- **Opportunité :** Vyzio peut s'appuyer sur les briques Frigate + apporter la reconnaissance faciale, les notifications et l'UX grand public

### 4.3 Avantage concurrentiel durable

1. **Privacy by design non négociable** — C'est un engagement architectural, pas marketing
2. **Communauté open source** — Moat défensif, contributions externes, confiance
3. **Souveraineté française** — Différenciant fort sur le marché européen post-RGPD
4. **Continuum DIY → Hub → Cloud** — Unique : le même logiciel, trois niveaux de service

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

### 5.4 Canaux d'acquisition

| Canal | Phase | CAC estimé | Potentiel volume |
|---|---|---|---|
| Communautés open source (organique) | 1, 2, 3 | ~0 € | Moyen |
| SEO / contenu | 1, 2, 3 | ~20 € | Élevé (long terme) |
| Relations presse | 1, 2 | ~50 € (PR) | Moyen |
| Publicité payante | 3 | ~40-80 € | Élevé |
| Bouche-à-oreille / NPS | 2, 3 | ~0 € | Élevé |

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
| Concurrence GAFAM sur le segment local | Faible | Élevé | Moat communautaire open source + engagement privacy non réplicable par GAFAM |
| Réglementation reconnaissance faciale (IA Act EU) | Moyenne | Élevé | Usage résidentiel privé hors champ du règlement ; veille juridique continue |
| Difficulté de recrutement tech | Moyenne | Moyen | Communauté open source comme vivier ; télétravail |
| Adoption lente (niche trop petite) | Faible | Élevé | Le marché self-hosted est en forte croissance (Home Assistant, preuve du segment) |
| Problèmes de supply chain Hub | Moyenne | Moyen | Multi-sourcing hardware, modèles compatibles multiples |
| Concurrence Frigate sur le DIY | Élevée | Faible | Frigate = infrastructure bas niveau, Vyzio = produit complet. Complémentaires plus que concurrents |
| Attaque / fuite de données (Cloud) | Faible | Très élevé | Architecture sécurisée dès le départ, audits réguliers, chiffrement bout-en-bout |

---

## 10. Roadmap et jalons

| Jalon | Échéance cible | Critère de succès |
|---|---|---|
| **MVP DIY fonctionnel** | M3 | Reconnaissance faciale + notifications + dashboard de base |
| **Bêta fermée** | M4-M5 | 20 testeurs, feedback structuré collecté |
| **Lancement open source public** | M6 | Repo public, doc complète, 100 stars GitHub |
| **Lancement Hub** | M6-M7 | 50 précommandes |
| **Lancement Cloud** | M7 | 20 abonnés payants |
| **Intégration Home Assistant officielle** | M8 | Add-on accepté dans le store officiel |
| **Application mobile native** | M12-M15 | iOS + Android sur les stores |
| **Expansion EU** | M18 | Site + support EN/DE, 1er partenaire revendeur hors France |
| **Rentabilité opérationnelle** | M16-M20 | Cash-flow positif sur 3 mois consécutifs |
