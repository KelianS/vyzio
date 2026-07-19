# TAD — Découverte réseau des caméras

> Comment fonctionne le sous-système de découverte. Le *pourquoi* des choix est dans
> [ADR-32](../adr/0032-pipeline-de-decouverte-reseau-en-3-etapes.md) (pipeline 3 étapes) et
> [ADR-31](../adr/0031-override-manuel-du-constructeur-a-l-onboarding.md) (override manuel).
> Foyer du code : `src/vyzio/Vyzio.Infrastructure/Services/CameraDiscovery/`.

## Rôle

À partir d'un **périmètre réseau** (hôtes ou plages CIDR), produire la liste des équipements
présents, enrichie de faits vérifiables (ports ouverts + protocole confirmé, hostname, MAC) et
d'une interprétation (marque probable, capacités supportées) — **sans jamais masquer** un
équipement non reconnu.

## Les trois étapes

Pipeline orchestré par `AssistedCameraDiscoveryProbePipeline`. Chaque classe porte un commentaire
d'en-tête indiquant son étage.

| Étage | Responsabilité | Classe(s) |
|---|---|---|
| 1. Identification | Quels hôtes existent (ping / cible explicite) | `AssistedCameraDiscoveryProbePipeline` (`IdentifyHostsAsync`, `PingSweepAsync`) |
| 2. Enrichissement | Faits vérifiables par hôte (ports+fingerprint, RTSP, ONVIF, hostname, MAC) | `AssistedCameraDiscoveryProbePipeline` (`Discover*SignalsAsync`) |
| 3. Interprétation | Marque + capacités, à partir de preuves structurées | `AssistedCameraDiscoveryIdentifier`, `AssistedCameraDiscoveryFormatter`, `AssistedCameraDiscoveryService` |

**Règle d'or** : une étape ne fait jamais le travail d'une autre. L'identification ne filtre pas ce
qui s'affiche (chaque hôte identifié reçoit un signal de base `network_host`, priorité `-10`) ;
l'enrichissement ne suggère aucune marque (faits bruts seulement) ; l'interprétation ne dérive la
marque que de `discoverySource` structuré, jamais du texte des notes.

## Modèle de signal & qualification

- **`RawCameraDiscoverySignal`** — un fait produit par l'enrichissement (source, port, note,
  `ConfirmedProtocol?`, `PortServiceLabel?`).
- **`DiscoveryProtocolCatalog`** — mappe chaque `discoverySource` → priorité de fusion (+ le
  `SupportedProtocol` pour les sources qui prouvent un protocole). Utilisé par le `Formatter` pour
  choisir le signal gagnant quand plusieurs décrivent le même hôte.
- **`AssistedCameraDiscoveryIdentifier`** — qualifie chaque hôte sur trois paliers
  (`DetermineQualification`) : **`camera_confirmed`** (port/protocole caméra confirmé — ONVIF, KLAP,
  ou RTSP avec chemin connu), **`camera_likely`** (indice fort mais non confirmé — RTSP qui répond
  sans chemin connu, signature HTTP camera, OUI MAC ou hostname évocateur), **`device_unknown`**
  (aucun signal qualifiant ; inclut le signal de base `network_host`). Correspond au besoin produit
  SPECS §2.2 (« distinguer une caméra confirmée, une caméra probable et un équipement non qualifié »).
- **`AssistedCameraDiscoveryFormatter`** — fusionne les signaux par hôte (priorité) et décide de
  l'exposition au front.

## Balayage de ports & fingerprint (« nmap »)

Source de vérité unique : **`DiscoveryPortCatalog`** (ne pas dupliquer sa table ici — elle vit dans
le code).

- `ScannedPorts` : chaque port TCP-connecté, avec son libellé conventionnel (HTTP, SSH…). **Tout
  port ouvert est affiché**, même sans protocole reconnu (« non identifié »).
- `Fingerprints` : protocole → ports candidats + libellé. Un port ouvert n'est **étiqueté** d'un
  protocole que si son handshake sans credentials passe (`ConfirmProtocolAsync`) : RTSP `OPTIONS`,
  ONVIF SOAP `GetSystemDateAndTime`, DVRIP octet `0xFF`, V380 trame d'auth 256 octets, Tapo KLAP
  `handshake1`. Un port peut confirmer plusieurs protocoles (many-to-many).

Autres sources d'enrichissement, gardées pour leur valeur propre : RTSP DESCRIBE (chemin de flux),
annonce ONVIF multicast (hostname), rDNS (hostname), ARP/OUI (indice constructeur).

## Capacités dérivées du registre

L'interprétation ne code aucune capacité en dur : `AssistedCameraDiscoveryService.GetDetectedCapabilities`
croise les protocoles détectés sur l'hôte avec `ICapabilityProviderRegistry.GetRegisteredProtocols(capability)`
— le **même** registre qui pilote la détection à l'ajout ([ADR-22](../adr/0022-catalogue-de-capacites-camera-decouplage-marque.md),
[ADR-28](../adr/0028-detection-de-capacite-en-cascade-multi-protocole-flag.md)). `Stream` est une
capacité de première classe (`IStreamCapabilityProvider`), pas un cas particulier.

## Contrat de sortie (vers le frontend)

Le backend transporte des DTO **déjà localisés** ; le frontend est en pur affichage (aucun nom de
protocole/capacité en dur) :

- `DetectedPortSignal(Protocol, Label, Port)` → table `Port | Protocole`.
- `DetectedCapability(Capability, Label, ProtocolLabels)` → liste `Capacité → protocoles`.

## Configuration

**Périmètre réseau uniquement** (`DiscoverySettings` : `ProbeHosts`, `ProbeCidrs`,
`AutoDetectLocalCidrs`, `ProbeTimeoutMs`, `MaxConcurrentProbes`). Ports, chemins RTSP et protocoles
sont des **constantes internes** de `DiscoveryPortCatalog` — jamais exposés à l'utilisateur. Les
champs `*Override` de `DiscoverySettings` sont **de test uniquement**, jamais lus depuis la
config/env (hermétisation des tests).

## Limites connues

- Ping ICMP et lecture ARP exigent le privilège réseau (Linux : `CAP_NET_RAW`, réseau `host`). Un
  filet de sécurité (repli sur la liste non filtrée si aucun ping ne répond) absorbe l'ICMP bloqué
  sans le résoudre.
- Fingerprint V380 *best-effort* (pas de signature de réponse documentée) : privilégie « non
  identifié » à un faux « V380 ».
- Jeu de ports curé, pas 1-65535 (coût du TCP-connect × hôtes).

## Ajouter un protocole à port dédié

Une entrée `ScannedPorts` + une entrée `Fingerprints` dans `DiscoveryPortCatalog` (+ un cas dans
`ConfirmProtocolAsync` réutilisant une sonde existante). Détection, affichage du port, confirmation
caméra et croisement des capacités suivent automatiquement — frontend inclus.
