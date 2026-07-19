# ADR-12 — Gestion des caméras pilotée par Vyzio, appliquée à Frigate

> Statut : Accepté

## Contexte

Vyzio doit offrir une gestion caméra simple pour un utilisateur non-technicien tout en conservant Frigate comme moteur vidéo et source d'exécution effective. L'utilisateur ne doit jamais modifier manuellement un fichier YAML, mais la cible technique finale reste que les caméras actives soient injectées dans la configuration Frigate puis appliquées par rechargement contrôlé de Frigate.

L'architecture doit donc résoudre simultanément quatre besoins durables :

- fournir un référentiel caméra intelligible côté Vyzio pour l'interface et les règles métier ;
- permettre un parcours guidé d'ajout, de vérification et de correction ;
- produire une configuration Frigate déterministe à partir de l'état validé côté Vyzio ;
- appliquer cette configuration à Frigate sans exposer les détails internes au parcours utilisateur.

Frigate reste responsable de l'ingestion ONVIF/RTSP/MJPEG, du pipeline vidéo, du live preview final et des détections. Vyzio reste responsable du parcours, du vocabulaire produit, de la validation et de l'orchestration de configuration.

## Décision

La gestion des caméras est modélisée comme une orchestration Vyzio en quatre briques distinctes :

| Brique | Rôle | Source de vérité |
|---|---|---|
| **Camera Catalog** | référentiel Vyzio des caméras connues, de leur nom métier, mode de connexion, état de validation et paramètres utiles à la génération de configuration | SQLite Vyzio |
| **Camera Discovery Adapter** | découverte réseau assistée, qualification des candidats détectés et fallback manuel complet | Frigate/sondage réseau + saisie utilisateur |
| **Camera Config Writer** | génération déterministe de la section `cameras` de la configuration Frigate à partir des caméras actives validées | configuration Frigate générée par Vyzio |
| **Camera Status Projection** | synthèse d'état exploitable par l'UI (`online`, `offline`, `degraded`, `config_error`) à partir des checks Vyzio et du retour Frigate | projection applicative Vyzio |
| **Vendor Guidance Catalog** | notices d'activation, indicateur `camera supported` et aides de parcours par constructeur ou famille de caméras | catalogue applicatif Vyzio |

Cette séparation permet d'éviter deux erreurs :

- piloter directement l'UI depuis les concepts internes Frigate ;
- stocker toute la vérité caméra uniquement dans du YAML difficile à valider, versionner et tester.

## Architecture cible

Le flux nominal cible est le suivant :

1. Vyzio découvre des équipements réseau via ONVIF, RTSP, HTTP(S) et sondages ciblés.
2. Vyzio qualifie chaque candidat avec un niveau de confiance produit (`camera_confirmed`, `camera_likely`, `device_unknown`) et, si possible, une famille constructeur.
3. Vyzio présente une aide d'activation adaptée quand le flux n'est pas encore exploitable, par exemple pour une caméra sortie de carton avec RTSP ou ONVIF désactivés.
4. Vyzio vérifie la joignabilité et la cohérence minimale du flux une fois les prérequis d'activation réunis.
5. Vyzio enregistre la caméra dans son catalogue avec un statut de validation explicite.
6. Vyzio génère la configuration Frigate complète à partir du catalogue des caméras actives.
7. Vyzio applique cette configuration par écriture atomique du fichier cible puis déclenche un reload/restart maîtrisé de Frigate.
8. Vyzio contrôle le retour de Frigate et met à jour un statut produit lisible pour l'utilisateur.

Le dashboard ne manipule donc jamais directement `frigate.yml`. Il agit sur des ressources Vyzio ; Vyzio dérive ensuite la configuration Frigate effective.

## Stratégie de découverte et d'assistance retenue

La stratégie produit et technique retenue pour l'onboarding caméra suit quatre étages :

1. **Découverte device** : repérer les équipements potentiellement pertinents via ONVIF multicast, probes RTSP ciblés, probes HTTP(S) et futur support de signaux complémentaires si utiles.
2. **Qualification caméra** : attribuer à chaque candidat un niveau de confiance et une famille probable de constructeur au lieu d'afficher indistinctement tout objet connecté. La récupération best-effort de l'adresse MAC et l'exploitation de l'OUI constructeur sont retenues comme signaux supplémentaires de qualification, sans devenir une source de vérité unique.
3. **Assistance d'activation** : exposer une notice simple, adaptée au constructeur détecté, pour activer RTSP, ONVIF ou le mode de diffusion attendu sans imposer une recherche externe.
4. **Binding Frigate** : ne générer la configuration Frigate qu'une fois un flux effectivement exploitable confirmé.

Conséquence importante : l'activation automatique de RTSP n'est pas une hypothèse générale de l'architecture cible. Elle n'est envisageable que pour certains constructeurs disposant d'une API locale documentée et stable. La cible nominale reste une activation assistée, guidée par Vyzio, puis une reprise automatique du parcours dès que le flux devient joignable.

## Modèle de qualification retenu

Le niveau d'information affiché à l'utilisateur ne doit pas être un score brut arbitraire. L'architecture retenue distingue :

- **les signaux observés** : ONVIF joignable, réponse RTSP cohérente, interface HTTP caractéristique, informations d'en-tête, OUI constructeur via MAC, chemin RTSP connu, comportement observé lors de la vérification ;
- **la qualification technique interne** : `camera_confirmed`, `camera_likely`, `device_unknown`, utile pour la découverte, le support et l'explication du comportement ;
- **les deux états produit exposés dans le parcours** : `camera supported` oui / non, `RTSP active` oui / non.

La qualification technique interne répond à la question : « cet équipement ressemble-t-il réellement à une caméra exploitable ? ».

L'état `camera supported` répond à la question : « Vyzio sait-il accompagner cette caméra dans le parcours nominal ? ».

L'état `RTSP active` répond à la question : « le flux est-il déjà activable et testable sans étape constructeur supplémentaire ? ».

Les signaux techniques internes et les états produit doivent rester distincts pour éviter deux dérives :

- considérer qu'un équipement est officiellement supporté simplement parce qu'il ressemble à une caméra ;
- exposer dans l'interface grand public une taxonomie technique plus complexe que nécessaire.

Règles d'interprétation retenues :

- `camera_confirmed` exige plusieurs signaux convergents compatibles avec une vraie caméra IP exploitable ;
- `camera_likely` couvre un équipement très probablement caméra mais encore incomplet, ambigu ou non vérifié ;
- `device_unknown` couvre un équipement joignable ou détecté sans preuve suffisante pour le présenter comme caméra ;
- `camera supported = oui` implique que Vyzio dispose d'un parcours nominal exploitable ou d'une guidance constructeur suffisante pour accompagner l'utilisateur ;
- `camera supported = non` implique que Vyzio ne sait pas encore accompagner cette caméra de façon suffisamment fiable dans le parcours nominal ;
- `RTSP active = oui` implique que le flux peut être vérifié immédiatement ;
- `RTSP active = non` implique qu'une étape d'activation ou de correction reste nécessaire avant vérification.

Conséquence d'architecture : les contrats de découverte peuvent conserver la qualification technique et ses raisons pour le support et le debug, mais le parcours utilisateur ne doit exposer que les états `camera supported` et `RTSP active`. L'UI ne doit pas avoir à recalculer cette logique.

## Contrats API cibles

Les contrats externes doivent exprimer une intention produit, pas un détail d'infrastructure :

```
GET    /api/cameras                    → liste hub-friendly des caméras connues + statut synthétique
POST   /api/cameras/discovery          → renvoie des candidats normalisés issus de la découverte réseau
POST   /api/cameras                    → crée ou enregistre une caméra dans le catalogue Vyzio
POST   /api/cameras/{id}/verify        → teste la connectivité et produit un aperçu exploitable
PATCH  /api/cameras/{id}               → nommage + édition minimale
POST   /api/cameras/{id}/apply         → régénère la configuration Frigate et applique le changement
GET    /api/cameras/{id}/status        → détail d'état et aides à la correction
```

Principes de conception associés :

- les réponses doivent employer un vocabulaire produit (`connected`, `previewAvailable`, `needsAttention`) plutôt que des codes Frigate bruts ;
- la saisie manuelle est un chemin nominal de secours, pas une exception cachée ;
- la découverte doit retourner des candidats qualifiés et des aides d'activation, pas une simple liste brute de ports ouverts ;
- l'adresse MAC, quand elle peut être récupérée de façon fiable depuis l'hôte ou l'appliance, doit être utilisée comme signal complémentaire de qualification et de rattachement vendor ;
- une caméra potentielle sans RTSP actif reste un candidat utile si Vyzio sait fournir une guidance d'activation exploitable ;
- la liste des caméras officiellement supportées doit être maintenue côté Vyzio et exposée au parcours pour rendre le niveau de confiance explicite ;
- l'écriture de configuration doit rester atomique : génération complète puis application, jamais mutation partielle non traçable ;
- la base Vyzio n'est pas la configuration finale exécutée par le moteur vidéo ; elle stocke la vérité métier nécessaire pour générer cette configuration ;
- le hub et la future page caméras consomment le même contrat de statut pour éviter une divergence d'interprétation.

## Modèle de données minimal côté Vyzio

Un stockage Vyzio dédié est nécessaire pour supporter la gestion métier des caméras et la projection d'état indépendamment des événements de détection.

```
CameraAggregate
  - Id
  - Slug
  - DisplayName
  - SourceType          // onvif | rtsp_manual | http_mjpeg
  - Host
  - Port
  - Username (référence secrète)
  - Password (référence secrète)
  - StreamPath
  - DetectionPreset
  - Status
  - LastReachabilityCheckAt
  - LastSuccessfulFrameAt
  - FrigateCameraName
  - ValidationState
```

Les secrets caméra ne doivent pas être stockés en clair dans la projection métier. Ils restent chiffrés via la stratégie déjà retenue dans le SAD (`DataProtection`) ou référencés via un magasin interne si ce besoin grossit.

## Intégration Frigate retenue

La configuration finale exécutée par Frigate est générée par Vyzio à partir du catalogue caméra validé :

- Vyzio ne modifie jamais manuellement un fragment isolé côté utilisateur ; il régénère un document de configuration cohérent ;
- la section `cameras` de Frigate est dérivée des caméras actives Vyzio ;
- l'application du changement passe par une écriture atomique suivie d'un reload/restart contrôlé de Frigate ;
- en cas d'échec d'application, le statut utilisateur devient `config_error` et Vyzio conserve la trace du dernier état appliqué avec succès.

Le parcours reste compatible avec la stratégie "Hub Vyzio simplifié + Frigate avancé" :

- **découverte** : utiliser Frigate ou un adaptateur dédié quand une capacité exploitable existe, sans dépendre d'un écran Frigate ;
- **qualification** : distinguer les caméras confirmées, les caméras probables et les équipements non qualifiés avant de les proposer au parcours nominal ;
- **guidance** : exposer une notice par constructeur détecté, avec une liste de modèles officiellement supportés et le niveau d'assistance associé ;
- **prévisualisation** : passer par un proxy Vyzio pour éviter d'exposer directement Frigate au dashboard ;
- **application** : Vyzio régénère la configuration caméra Frigate à partir du catalogue, puis déclenche un reload/restart maîtrisé ;
- **état** : Vyzio recoupe le statut applicatif avec les signaux Frigate pour afficher une information simple au lieu d'un diagnostic brut.

Le point important de conception est de ne pas faire dépendre tout le parcours d'une API de découverte Frigate qui pourrait varier. L'abstraction `CameraDiscoveryAdapter` doit permettre un fallback manuel complet.

## Conséquences

- ✅ Le dashboard reste découplé de la syntaxe et des contraintes internes de Frigate
- ✅ La base Vyzio sert de référence métier, tandis que Frigate reste la cible d'exécution effective
- ✅ L'état caméra devient un concept produit de premier ordre, au lieu d'être inféré uniquement depuis les détections
- ⚠️ Introduit une nouvelle agrégation métier et une synchronisation explicite BD Vyzio → configuration Frigate
- ⚠️ Le mécanisme de reload/restart Frigate doit être idempotent, observable et validé en environnement Docker réel
