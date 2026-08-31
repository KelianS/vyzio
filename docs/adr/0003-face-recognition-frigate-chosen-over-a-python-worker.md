# ADR-03 — Reconnaissance faciale : Frigate retenu, worker Python non retenu

> Statut : Accepté

## Contexte

Depuis Frigate 0.16+, la reconnaissance faciale locale est disponible nativement et intégrée au flux Frigate (UI, filtres, MQTT, notifications). Réimplémenter systématiquement la face recognition dans Vyzio crée une duplication coûteuse.

## Options comparées

| Option | Avantages | Inconvénients |
|---|---|---|
| **Face Recognition Frigate natif** | Intégration native, maintenance faible, cohérence UI/événements | Dépend des capacités Frigate et de son rythme d'évolution |
| **Worker Python Vyzio obligatoire** | Contrôle complet pipeline IA | Coût élevé, dette de maintenance, duplication d'une feature déjà disponible |
| **Mode hybride** (Frigate par défaut + worker optionnel) | Optimise coûts et garde une porte pour besoins avancés | Complexité de gouvernance de deux modes |

## Décision

**Solution retenue : Face Recognition native de Frigate.**

Le worker Python dédié reste un **choix étudié, non retenu** en cible v1/v2 car il duplique une capacité déjà mature dans Frigate et augmente fortement la complexité d'exploitation.

## Choix étudié (non retenu)

Une variante avec service Python isolé a été évaluée :

```
Face Recognition Worker (Python 3.12)
├── Exposé uniquement en gRPC local (port non publié hors Docker network)
├── Aucun accès à SQLite Vyzio
├── Aucun accès au bus MQTT Vyzio
├── Interface unique : Recognize(image) → embeddings + bboxes
└── Stateless — pas de persistance locale
```

Le worker étudié était conçu comme un **microservice de calcul pur**. Toute logique métier aurait dû rester dans le Core .NET.

Transport étudié pour cette option non retenue :

| Option | Latence locale | Contrat typé | Complexité |
|---|:---:|:---:|:---:|
| gRPC | ✅ < 2ms | ✅ Protobuf | ⚠️ Proto à maintenir |
| HTTP/REST (JSON) | ✅ < 5ms | ⚠️ OpenAPI | ✅ Minimal |
| Unix socket | ✅ < 1ms | ❌ | ⚠️ |

```protobuf
service FaceRecognition {
  rpc Recognize (RecognizeRequest) returns (RecognizeResponse);
  rpc ComputeEmbedding (EmbeddingRequest) returns (EmbeddingResponse);
}
message RecognizeRequest  { bytes image_jpeg = 1; }
message RecognizeResponse { repeated FaceResult faces = 1; }
message FaceResult {
  repeated float embedding = 1;  // 512 dims ArcFace
  BoundingBox    bbox       = 2;
  float          confidence = 3;
}
```

## Conséquences

- ✅ Réduction de la dette de réimplémentation
- ✅ Stack opérationnelle plus simple (moins de conteneurs, moins de surfaces de panne)
- ✅ Time-to-market meilleur pour une offre non-tech
- ✅ Les options étudiées sont conservées dans la documentation pour réévaluation future
