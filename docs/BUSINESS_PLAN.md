# Vyzio — Business Plan (V2)

> Version 0.2 — Mai 2026 — Repositionnement "Non-tech friendly + Support français"

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
10. [Roadmap produit](#10-roadmap-produit)

---

## 1. Résumé exécutif

**Vyzio** est un **appliance de surveillance domestique clef-en-main**, conçue pour le **grand public non-tech** qui ne veut plus dépendre d'Amazon, Google ou Arlo.

Ce qui différencie Vyzio : **support français + installation + garantie que ça marche.** Pas un produit geek pour makers. Un produit pour Monsieur-Madame lambda qui veut juste que ses caméras fonctionnent et ne donnent pas ses images à une boîte américaine.

**Le problème :** Ring/Nest/Arlo = cloud propriétaire + abonnement obligatoire + dépendance internet. Frigate = excellent pour les makers, incompréhensible pour le reste. Umbrel = très bon OS pour self-hosted, mais toujours pour les tech-aware. **Aucun acteur n'offre : surveillance locale simple, zéro configuration, support humain français.**

**La solution :** Une **appliance matérielle pré-configurée** avec Frigate + IA embarquée. L'utilisateur branche, c'est prêt. Ses données restent chez lui. S'il y a problème : support français inclus.

**Offres :**
- **Offering matériel** (prioritaire) — Appliance clef-en-main avec support optionnel → Cible : familles urbaines, PME, syndics
- **Offering open source** — Repo open source pour makers (validation communautaire, pipeline recrutement)

**Traction cible :** Volume matériel à M12 et M24 (à définir).

**Moat défensif :** Support humain français + certification caméras + intégrations testées = non facilement replicable par Umbrel/CasaOS.

---

## 2. Marché et opportunité

### 2.1 Taille du marché

- **Segment caméras IP grand public France** : ~180 M€, +10% CAGR
- **Marché européen smart home security** : ~2,5 Mds USD, +12% CAGR
- **Segment "local-first + support"** : ~5-10% du marché total = ~12-25 M€ potentiel EU

### 2.2 Tendances favorables

- **Montée en puissance du mouvement privacy** — RGPD, scandales, méfiance GAFAM
- **Marché existant = Ring/Nest users frustrés** — Pas besoin de créer la demande, capturer la frustration
- **Souveraineté numérique** — Sensibilité française/EU très haute post-RGPD
- **Support = value** — Non-tech users valorisent l'aide humaine (vs open source gratuit)

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

### 3.1 Offering matériel (PRIORITAIRE)

**Positionnement :** L'appliance surveillance clef-en-main pour grand public  
**Modèle :** Vente unitaire du hardware + abonnement support optionnel

| Composant | Coût estimé | Marge brute |
|---|---|---|
| Mini-PC avec stack pré-installée | À définir | À définir |
| Installation à domicile (optionnel) | À définir | À définir |
| Support annuel (mise à jour, hotline) | À définir | À définir |

**Value prop :** 
- Plug & Play (zéro configuration)
- Support français inclus
- Mises à jour OTA automatiques
- Reconnaissance faciale embarquée
- Compatible caméras IP existantes (PoE, WiFi)

**Revenus primaires :** Vente matériel. **Revenus récurrents :** Abonnement support (opt-in).

### 3.2 Offering open source (VALIDATION + PIPELINE)

**Positionnement :** Repo open source pour makers qui veulent faire eux-mêmes  
**Revenus directs :** Aucun  
**Rôle stratégique :**
- Validation du produit en conditions réelles (feedback makers)
- Pipeline de recrutement pour Hub/Cloud (makers → besoin support → client Hub)
- Contributions externes (améliorations, intégrations)
- Notoriété technique (GitHub stars = crédibilité)

### 3.3 Revenus additionnels (moyen terme)

- **Installation à domicile** — Service payant (marche partenaires locaux)
- **Formation installateurs** — Programme certification pour artisans domotique (marque blanche)
- **Support premium** — Tier support supérieur pour PME/syndics
- **Aides publiques** — Éligibilité potentielle RGPD/souveraineté numérique (BPI)

---

## 4. Analyse concurrentielle

### 4.1 Positionnement vs concurrents

**Ring/Nest/Arlo :** Cloud, abonnement obligatoire, données US
- Notre avantage : local-first, support français, zéro abonnement obligatoire
- Risque : ils pourraient lancer on-premise, mais business model = cloud (unlikely)

**Synology NAS :** Fiabilité, support, perception "IT complex"
- Notre avantage : UX simplifiée, support français, accessibilité grand public
- Faiblesse Synology : perception comme trop technique, trop cher

**Frigate :** Open source, techniquement excellent, MAIS zéro UX, zéro support, pour makers
- Notre positionnement : on utilise Frigate en backbone, on ajoute UX/support/product
- Risque : Frigate évolue en appliance, mais fondateur = open source ideologue (unlikely)

**Umbrel / CasaOS :** OS simplifié, app store modèle, croissance rapide
- CIBLE DIFFERENTE : Umbrel = pour tech-aware / makers, notre solution = pour non-tech
- Notre avantage : focus sécurité (ils sont multitâche), support humain (ils n'en ont pas)
- Complémentaires plus que concurrents : maker → Umbrel, grand public → notre solution

### 4.2 Avantage concurrentiel durable (MOAT)

1. **Support français humain** — Le vrai moat. Pas juste produit, un service. Umbrel/CasaOS n'ont pas ça.
2. **Certification caméras testées** — 5-10 marques garanties "qui marchent". Frigate = user debug
3. **Installation à domicile** — Service optionnel, crée stickiness. Aucun concurrent
4. **Privacy by design + souveraineté française** — Non negotiable. RGPD by design
5. **UX pensée pour non-tech** — "Ma grand-mère peut l'utiliser"
6. **Distribution via installateurs** — Artisans domotique/électriciens = canal GAFAM ne peut pas utiliser

---

## 5. Stratégie Go-to-Market

### 5.1 Phase 1 — MVP + Bêta fermée (M0 à M4)

**Objectif :** MVP fonctionnel (Frigate + reconnaissance IA), 20 testeurs bêta non-tech

**Actions :**
- Développer Hub initial (mini-PC + stack Vyzio)
- Tester avec 20 utilisateurs bêta = familles réelles, PME
- Itérer sur UX (l'user doit comprendre sans doc)
- Calibrer support (combien de tickets par utilisateur?)
- Tester certification caméras (5-10 marques compatible)

### 5.2 Phase 2 — Lancement public (M4 à M8)

**Objectif :** 100 Hubs vendus, 30 Cloud actifs

**Actions :**
- Lancement DIY open source (repo GitHub)
- Lancement Hub (précommande ou site + small run production)
- Lancement Cloud beta (20-30 abonnés)
- Relations presse **locale/régionale** (Marseille, Lyon, Paris) + presse privacy
- YouTube démo : "installation en 5 min"
- SEO local + mots-clés grand public : "surveillance maison sans Amazon", "caméra IP locale sans abonnement"
- Bouche-à-oreille réseau (family/friends)

### 5.3 Phase 3 — Croissance (M8 à M18)

**Objectif :** 500 Hubs, 200 Cloud, rentabilité en vue

**Actions :**
- Support 24/5 français (hotline + chat)
- Partenariats installateurs locaux / électriciens
- Programme installers certifiés (formation)
- Google Ads ciblé sur non-tech ("pas besoin de comprendre, on s'occupe de tout")
- Expansion : Belgique, Suisse (presse + partners)
- Deuxième SKU Hub si besoin (plus gros, plus de caméras)

### 5.4 Canaux d'acquisition (Hub)

| Canal | Phase | CAC estimé | Stratégie |
|---|---|---|---|
| Bouche-à-oreille / NPS | 2, 3 | €0 | Prioritaire — non-tech aime recommander "qui marche" |
| SEO local + keywords "no geek" | 2, 3 | €10-20 | "surveillance sans amazon", "caméra locale" |
| Installateurs partenaires | 3 | €0 (commission) | Artisans, électriciens = distribution naturelle |
| Presse grand public | 2, 3 | ~€30 PR | Pas HackerNews, plutôt "Madame Figaro tech" |
| Google Ads (phase 3) | 3 | €50-80 | Ciblage non-tech, long tail keywords |
| YouTube démo simple | 2, 3 | €0 | "Je branche, c'est prêt" viral potential |

---

## 6. Structure de coûts

### 6.1 Coûts de développement (année 1)

| Poste | Détail | Coût estimé |
|---|---|---|
| Développement core | Founders ou freelance | 0-120 k€ |
| Infrastructure Cloud | OVHcloud / Scaleway | ~6 k€/an |
| Outils & licences | GitHub, CI/CD | ~2 k€/an |
| Design / UX | Dashboard, site | ~5 k€ |
| Juridique | RGPD, CGV | ~3 k€ |

### 6.2 Coûts Hub (par unité)

| Poste | Coût |
|---|---|
| Hardware (mini-PC + emballage) | ~125 € |
| Logistique / livraison | ~15 € |
| SAV estimé (2% retour) | ~3 € |
| **Total coût par Hub** | **~143 €** |

**Prix de vente : €349** → Marge brute : **~206 € (59%)**

### 6.3 Coûts Cloud (par abonné actif)

| Poste | Mensuel |
|---|---|
| Compute (IA) | ~1,50 € |
| Stockage vidéo (30j) | ~0,80 € |
| Bande passante | ~0,40 € |
| Support | ~0,30 € |
| **Total par Starter** | **~3,00 €** |

**Marge brute Cloud Starter : €9,99 - €3,00 = €6,99 (70%)**

---

## 7. Projections financières

### 7.1 Scénario de base — Revenus

| Mois | Hubs (cumulé) | Cloud actifs | Revenu Hub | Revenu Cloud | **Total** |
|---|---|---|---|---|---|
| M6 | 10 | 20 | 2 490 € | 200 € | **2 690 €** |
| M9 | 50 | 60 | 9 950 € | 600 € | **10 550 €** |
| M12 | 120 | 150 | 5 600 € | 1 500 € | **7 100 €** |
| M18 | 350 | 400 | 6 200 € | 4 000 € | **10 200 €** |
| M24 | 700 | 900 | 8 750 € | 9 000 € | **17 750 €** |

### 7.2 Seuil de rentabilité

- Structure légère (2 founders) : **M14-M16**
- Avec 1 salarié dès M12 : **M20-M22**

### 7.3 Besoins en financement

| Scenario | Estimation | Usage |
|---|---|---|
| Bootstrapped | Minimal | Infrastructure, juridique, 1er stock |
| Amorçage | Faible à moyen | Accélération marketing, stock, recrutement |
| Seed | Moyen à élevé | Équipe, distribution, expansion EU |

---

## 8. Équipe et organisation

### 8.1 Profils clés nécessaires

| Rôle | Compétences | Priorité |
|---|---|---|
| CTO / Lead Dev | Backend, IA, Docker/K8s | Critique (fondateur) |
| Product / CEO | Vision, business, GTM | Critique (fondateur) |
| Dev Frontend | TypeScript, React | Phase 2 |
| Dev IA / ML | Computer Vision, PyTorch | Phase 1-2 |
| Growth / Marketing | SEO, community, press | Phase 2 |

### 8.2 Structure juridique recommandée

- **SAS** — Flexibilité, attractivité investisseurs, régime IR possible early
- Domiciliation : France (cohérent promesse souveraineté)

---

## 9. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Frigate évolue appliance clef-en-main | Moyenne | Moyen | Fork stable version 0.17, notre moat = support/UX |
| Amazon/Google on-premise local | Basse | Élevé | Notre prix + support FR + ecosystem les neutralise |
| Umbrel/CasaOS appliance sécurité | Basse | Moyen | Cible différente (makers vs non-tech), moat = support FR |
| Réglementation IA / reconnaissance faciale | Moyenne | Moyen | Usage résidentiel exempté, veille juridique |
| Supply chain hardware (délai production) | Moyenne | Moyen | Multi-source hardware, drop-in compatibility |
| Support explosif (trop tickets) | Haute | Moyen | FAQ, chatbot, capping users avant saturé |
| Adoption lente (marché petit) | Moyenne | Élevé | Pivoter B2B2C (revendeurs, installateurs) avant rupture |

---

## 10. Roadmap produit

### V1 (M0-M6) — MVP clef-en-main
**Focus :** Sécurité + reconnaissance faciale, zéro complexity
- Frigate intégré (moteur NVR)
- Reconnaissance faciale InsightFace embarquée
- Notifications mobile (FCM)
- Dashboard ultra-simple (5 écrans max)
- Auto-discovery caméras ONVIF
- Support 5-10 marques caméras certified
- Détection mouvement + visage inconnu
- Installation 5 minutes = préconfigurée

### V2 (M6-M12) — Intégrations & support
- Home Assistant intégration légère (optionnel)
- Application mobile native
- Support français hotline 24/5
- Programme installer partenaires

### V3 (M12+) — Extension
- Jellyfin intégration (media server optional)
- Home Assistant plus profond (automation simple)
- API pour syndics/PME B2B
- Expansion européenne (EN/DE/BE)

### Jalons clés

| Jalon | Cible | Critère |
|---|---|---|
| MVP + Bêta fermée | M4 | 20 users non-tech, 1h install, zéro tickets |
| Lancement public | M6 | DIY repo + Hub précommande |
| 100 Hubs vendus | M8 | Support tient bon (< 2h response) |
| Rentabilité opérationnelle | M16+ | Hub margin couvre coûts support |
| 500 users total | M12 | 300 Hub + 200 Cloud |

**Philosophie :** Faire une chose bien (sécurité/surveillance) avant d'étendre. V1 = meilleur produit pour surveiller sa maison. V2+ = on expand si demande.
