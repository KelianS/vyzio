# ADR-05 — Communication inter-services Vyzio : MQTT + Channels

> Statut : Accepté

## Contexte

Les composants Vyzio (règles métier, storage, notification) doivent réagir aux mêmes événements de façon découplée. MediatR est explicitement écarté.

## Options comparées

| Solution | Complexité | Dépendance infra | Persistance events | Continuité Frigate | Intégrations tierces |
|---|:---:|:---:|:---:|:---:|:---:|
| **MQTT** (Mosquitto dédié) | ✅ Faible | ✅ Léger | ⚠️ QoS 1 | ✅ | ✅ |
| **Redis Streams** | ⚠️ +1 conteneur | ❌ | ✅ Oui | ❌ | ⚠️ |
| HTTP callbacks internes | ⚠️ | ✅ | ❌ | ⚠️ | ❌ |
| MediatR | ❌ Écarté | ✅ | ❌ | ❌ | ❌ |
| gRPC streaming | ⚠️ | ❌ | ❌ | ❌ | ❌ |

**MQTT** : un broker Mosquitto dédié tourne sur le réseau Docker interne. Frigate y publie ses événements et Vyzio peut s'y raccorder sans couplage aux processus internes de Frigate. QoS 1 garantit la livraison at-least-once et le broker reste exposable localement pour les intégrations de développement.

**Redis Streams** : persistance robuste, groupes de consommateurs, replay d'événements. Solution préférable si les composants Vyzio deviennent plusieurs processus distincts. Overhead : ~30 MB + 1 conteneur. Retenu comme **option v2** si le besoin de persistance forte se confirme.

**HTTP callbacks internes** : solution simple mais plus couplée, moins naturelle pour exposer les événements Vyzio aux intégrations tierces et moins cohérente avec Frigate.

## Décision

**MQTT (broker Mosquitto dédié) entre Frigate et Vyzio, une file en mémoire (Channels) entre les services de Vyzio.**

Vyzio souscrit aux événements de détection de Frigate et lui publie la commande de sensibilité de détection (ADR-35). Vyzio ne publie aucun topic qui lui soit propre : ses services se passent les événements par une file en mémoire, dans le même processus.

**Redis Streams** est documenté comme évolution v2 si le besoin de persistance ou de replay d'événements se confirme.

## Conséquences

- ✅ Dépendance explicite et légère — un broker Mosquitto dédié, visible dans le runtime
- ✅ Continuité avec Frigate — une seule technologie de messagerie dans le système
- ✅ Composants Vyzio découplés : l'ingestion des événements Frigate dépose dans une file en mémoire que le service de notification consomme
- ⚠️ Aucun événement Vyzio n'est exposé aux intégrations tierces, et le broker n'est pas joignable hors du réseau Docker interne
- ⚠️ Testabilité : le contrat avec Frigate est testé contre des doubles, sans broker MQTT réel
- ⚠️ MQTT QoS 1 : at-least-once, pas exactly-once — les services doivent être idempotents sur réception
- ⚠️ Pas de persistance native des événements en vol si le broker redémarre — mitigé par QoS 1 et sessions persistantes
