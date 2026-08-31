# ADR-32 — Pipeline de découverte réseau en 3 étapes : identification / enrichissement / interprétation

> Statut : Accepté
> Fonctionnement détaillé : [`../design/camera-discovery.md`](../design/camera-discovery.md).

## Contexte

La découverte réseau doit lister les équipements présents, collecter des faits vérifiables sur chacun, puis en déduire marque et protocoles supportés — sans jamais masquer un équipement non reconnu (objectif backlog « Scan réseau ») et sans qu'une étape empiète sur la suivante. Un pipeline qui mélange détection réseau, collecte de faits et suggestion de marque produit des faux positifs (une marque déduite d'un protocole partagé entre OEM) et des angles morts (un équipement sans protocole local reconnu qui disparaît de l'affichage).

## Décision

Trois étapes strictement ordonnées, chacune avec une responsabilité unique. Chaque classe porte un commentaire d'en-tête identifiant son étage, pour que la séparation reste visible dans le code et pas seulement ici.

**1) Identification — quels hôtes existent** (`AssistedCameraDiscoveryProbePipeline.IdentifyHostsAsync`/`PingSweepAsync`)
- Hôtes **explicites** (`ProbeHosts`, ou la cible unique d'une vérification manuelle via `CameraDiscoveryTarget`) : **jamais** filtrés — l'utilisateur les a désignés, un ping manqué (ICMP désactivé sur l'appareil) ne doit pas les faire disparaître.
- Hôtes **balayés** (plage CIDR, ex. `192.168.1.0/24`) : filtrés par un ping ICMP (`System.Net.NetworkInformation.Ping`) — sonder chaque protocole contre les 254 adresses d'un `/24` est inutilement coûteux ; une réponse au ping suffit à justifier l'enrichissement.
- **Filet de sécurité** : si aucun hôte balayé ne répond au ping, le balayage retombe sur la liste non filtrée plutôt que de scanner zéro hôte — un ICMP totalement bloqué (conteneur sans `CAP_NET_RAW`) est plus probable qu'un réseau vide.
- Chaque hôte identifié reçoit un **signal de base** `network_host` (priorité `-10`, strictement sous toute autre source) : il garantit qu'un hôte identifié reste visible en `device_unknown` même sans aucun autre signal ; tout vrai signal (protocole, MAC, hostname) l'emporte à la fusion (`AssistedCameraDiscoveryFormatter.MergeCandidates`).

**2) Enrichissement — quels faits vérifiables** (méthodes `Discover*SignalsAsync`, appliquées aux seuls hôtes identifiés). Collecte de faits bruts par hôte, **sans aucune suggestion de marque** :
- **Balayage de ports + fingerprint** (`DiscoverPortScanSignalsAsync`) : `DiscoveryPortCatalog` est l'unique source de vérité (ports scannés + libellés conventionnels + fingerprints + chemins RTSP). Chaque port ouvert est un fait, **affiché même sans protocole reconnu** (libellé conventionnel si connu, sinon « non identifié »). Principe `port ouvert ≠ protocole confirmé` : un port n'est étiqueté d'un protocole que si son fingerprint sans credentials passe (`ConfirmProtocolAsync`) — RTSP `OPTIONS`, ONVIF SOAP `GetSystemDateAndTime`, DVRIP octet magique `0xFF`, V380 trame d'auth 256 octets, Tapo KLAP `handshake1`. ONVIF est ainsi détecté quel que soit son port ; un port 8800 qui ne répond pas au handshake V380 n'est pas étiqueté V380. Un port peut confirmer plusieurs protocoles (many-to-many).
- **RTSP DESCRIBE** : révèle le vrai chemin de flux (valeur propre au-delà du port ouvert).
- **ONVIF multicast** : l'appareil s'auto-identifie (hostname), indépendant de l'étape 1.
- **Hostname (rDNS) et MAC (ARP/OUI)** : indices constructeur factuels ; le texte des notes reste factuel (la note DVRIP précise que le protocole est partagé par plusieurs OEM, sans énumérer de marques).

**3) Interprétation — marque et capacités** (`AssistedCameraDiscoveryIdentifier`/`Formatter`, `AssistedCameraDiscoveryService`). Dérive **uniquement de preuves structurées** (`discoverySource`, jamais le texte des notes) :
- **Marque** : un protocole propriétaire confirmé (V380/KLAP) implique la marque (définitionnel) ; un protocole partagé entre OEM (DVRIP) n'implique aucune marque à lui seul — seuls OUI MAC ou hostname peuvent la déduire.
- **Capacités** : `GetDetectedCapabilities` croise les protocoles réellement détectés sur l'hôte avec `ICapabilityProviderRegistry.GetRegisteredProtocols(capability)` — le **même** registre qui pilote la détection de capacités à l'ajout (ADR-22/28). Relation many-to-many native : une capacité liste tous ses protocoles détectés (PTZ → ONVIF **et** V380), et un protocole apparaît sous plusieurs capacités (ONVIF sous PTZ **et** Réglages image). `Stream` est une capacité de première classe (`IStreamCapabilityProvider` + `RtspStreamProvider`/`DvripStreamProvider` déclaratifs, le transport étant délégué à go2rtc/Frigate — ADR-19), pas un cas particulier : `GetRegisteredProtocols(Stream)` renvoie `[Rtsp, Dvrip]` comme toute autre capacité.

**Configuration = périmètre réseau seul.** Seuls `ProbeHosts`, `ProbeCidrs`, `AutoDetectLocalCidrs`, `ProbeTimeoutMs`, `MaxConcurrentProbes` sont configurables. Ports, chemins RTSP et protocoles associés sont des constantes internes de `DiscoveryPortCatalog` — l'utilisateur n'a pas à savoir qu'une caméra parle V380 sur 8800.

**Frontend en pur affichage.** Le backend transporte des DTO déjà localisés — `DetectedPortSignal(Protocol, Label, Port)`, `DetectedCapability(Capability, Label, ProtocolLabels)`. L'UI affiche la table `Port | Protocole` et la liste `Capacité → protocoles` telles quelles, **sans aucun nom de protocole ou de capacité en dur**. Ajouter un protocole à port dédié = une entrée `DiscoveryPortCatalog` (scan, libellé, fingerprint, confirmation caméra, croisement capacités, frontend inclus).

## Options écartées

- **Étiquetage par numéro de port sans confirmation** : plaquait le protocole sur le seul numéro de port → faux positifs (Tapo:8800 étiqueté V380, ONVIF invisible hors de ses ports « attendus »). Remplacé par le fingerprint de service (pattern `nmap -sV`).
- **Découverte V380 par sonde UDP `NVDEVSEARCH`** : fragile, invisible en Docker bridge. Remplacée par le balayage TCP du port 8800 + fingerprint.
- **Sondes autonomes ONVIF-unicast et Tapo-KLAP, repli RTSP « network_scan »** : redondantes avec le balayage + fingerprint. Retirées ; ONVIF/KLAP sur port partagé (80) restent couverts par fingerprint.
- **Ports / chemins RTSP configurables par l'utilisateur** : surface de configuration inutile (l'utilisateur ne connaît pas les protocoles caméra). Ramenés en constantes internes.

## Conséquences

- ✅ Un équipement sans protocole reconnu reste visible en priorité basse au lieu de disparaître — objectif du backlog respecté ; tous les ports ouverts sont affichés, identifiés ou non
- ✅ Pas de faux positif de marque : la marque ne vient que de preuves structurées, jamais d'un protocole partagé ni du texte des notes
- ✅ Charge réseau réduite : un balayage `/24` sonde les ~5-20 hôtes vivants au lieu de tous les protocoles contre 254 adresses
- ✅ Un seul endroit pour ajouter un protocole (`DiscoveryPortCatalog`) ; capacités et `Stream` dérivées du registre existant, sans code par capacité
- ✅ Surface de configuration = périmètre réseau uniquement ; tests de découverte hermétiques (seams de test isolés de la config/env, écoute en boucle)
- ⚠️ Ping ICMP et lecture ARP exigent le privilège réseau (Linux : `CAP_NET_RAW`, réseau `host`) ; le filet de sécurité absorbe l'ICMP bloqué sans le résoudre à la source
- ⚠️ Fingerprint V380 best-effort (pas de signature de réponse documentée) : privilégie « non identifié » à un faux « V380 »
- ⚠️ Jeu de ports curé, pas 1-65535 (coût du TCP-connect × hôtes) ; extensible en un point
- ⚠️ Identification séquentielle (ping puis sondes) : légère latence ajoutée, compromis assumé pour la réduction de charge réseau
