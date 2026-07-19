# Documents de conception technique (TAD)

Un **TAD** (Technical Architecture Document) décrit **comment** un sous-système fonctionne — le
détail trop spécifique pour le SAD (frontières) et trop transverse pour un ADR (une décision). Il
**référence** le code et les ADR, il ne les recopie pas (règle suprême zéro-duplication,
[`../CLAUDE.md`](../CLAUDE.md)). Rôle et cycle de vie : [`../WORKFLOW.md`](../WORKFLOW.md).

Chaîne : SAD (frontières) → ADR (décision + pourquoi) → **TAD (comment)** → code (fait).

## Catalogue

| Composant | TAD | Décisions sources | Foyer du code |
|---|---|---|---|
| Découverte réseau des caméras | [`camera-discovery.md`](camera-discovery.md) | ADR-31, ADR-32 | `Vyzio.Infrastructure/Services/CameraDiscovery/` |

## Composants candidats (détail encore porté par leurs ADR + le code)

Ces sous-systèmes ont un *comment* assez riche pour mériter un TAD dédié le jour où leur détail
gêne la lecture de leurs ADR. Tant qu'ils tiennent, leur détail reste dans l'ADR et le code — ne pas
créer de TAD vide par anticipation.

- **Protocoles & capacités caméra** — clients ONVIF/DVRIP/V380, registre de capacités,
  `PrivacyStrategy`. Sources : ADR-19, ADR-20, ADR-22, ADR-24, ADR-27, ADR-28, ADR-29, ADR-30.
- **Intégration Frigate** — contrat MQTT/REST consommé, `FrigateAdapter`, génération `config.yml`.
  Sources : ADR-04, ADR-05, ADR-13, ADR-16, ADR-17, ADR-18.
- **PTZ & positions** — presets natifs vs Vyzio-managed, miniatures. Sources : ADR-21, ADR-25, ADR-26.
