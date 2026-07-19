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

**MQTT (broker Mosquitto dédié) pour tous les événements métier.**

Le `FrigateAdapter` souscrit aux topics Frigate et publie des événements Vyzio sur des topics dédiés. Chaque composant Vyzio (ProfileRulesService, StorageService, NotificationService) souscrit indépendamment aux topics qui le concernent.

```
Topics MQTT Frigate (consommés par FrigateAdapter) :
frigate/events                    → detections Frigate retenues dans la solution cible
frigate/{camera}/motion           → non consomme par le flux metier cible

Topics MQTT Vyzio (publiés par Vyzio, consommés par ses propres services + tiers) :
vyzio/events/detection_enriched   → { frigate_event_id, camera, label, sub_label, confidence, occurred_at }
vyzio/events/notification_ready   → { event_id, profile_id, priority, channels }
vyzio/events/camera_status        → { camera, status: online|offline|error }
```

```csharp
// FrigateAdapter : consomme Frigate, publie sur Vyzio topics
public class FrigateAdapter : IHostedService
{
    public async Task HandleFrigateEventAsync(FrigateEvent e)
    {
    // Normalisation (camera, label, sub_label, score, liens Frigate)
    await _mqttClient.PublishAsync("vyzio/events/detection_enriched", payload);
    }
}

// ProfileRulesService : applique le mapping produit et prépare les actions
public class ProfileRulesService : IHostedService
{
  // Souscrit : vyzio/events/detection_enriched
  // Mappe sub_label Frigate vers un profil Vyzio, évalue les règles
  // Publie : vyzio/events/notification_ready
}

// NotificationService : souscrit aux événements enrichis
public class NotificationService : IHostedService
{
  // Souscrit : vyzio/events/notification_ready
  // Envoie Telegram / FCM / webhook
}
```

**Redis Streams** est documenté comme évolution v2 si le besoin de persistance ou de replay d'événements se confirme.

## Conséquences

- ✅ Dépendance explicite et légère — un broker Mosquitto dédié, visible dans le runtime
- ✅ Continuité avec Frigate — une seule technologie de messagerie dans le système
- ✅ Intégrations tierces (Home Assistant, n8n) nativement exposées sur les topics Vyzio
- ✅ Composants Vyzio découplés — chacun souscrit uniquement aux topics qu'il consomme
- ✅ Testabilité : un broker MQTT léger (Mosquitto en container test) remplace le mock
- ⚠️ MQTT QoS 1 : at-least-once, pas exactly-once — les services doivent être idempotents sur réception
- ⚠️ Pas de persistance native des événements en vol si le broker redémarre — mitigé par QoS 1 et sessions persistantes
