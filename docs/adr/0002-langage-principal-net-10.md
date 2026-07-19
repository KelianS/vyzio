# ADR-02 — Langage principal : .NET 10

> Statut : Accepté

## Contexte

Les services Vyzio (orchestration, API, notifications, profils) doivent être implémentés dans un langage performant, typé et adapté aux contraintes embarquées. Les instructions du projet définissent .NET ou Rust comme priorités.

## Options comparées

| Critère | .NET 10 (C#) | Rust | Go | Python |
|---|:---:|:---:|:---:|:---:|
| Productivité / vélocité | ✅ Élevée | ⚠️ Courbe d'apprentissage | ✅ Bonne | ✅ Élevée |
| Performance | ✅ Excellente (AOT, SIMD) | ✅ Maximale | ✅ Bonne | ❌ GIL |
| Consommation mémoire (NativeAOT) | ✅ ~50 MB | ✅ ~5 MB | ✅ ~15 MB | ❌ ~150 MB+ |
| Écosystème embarqué arm64 | ✅ NativeAOT cross-compile | ✅ | ✅ | ⚠️ |
| ONNX Runtime bindings officiels | ✅ Microsoft | ❌ Non officiel | ❌ | ✅ |
| ORM + migrations | ✅ EF Core | ❌ sqlx (no migrations) | ⚠️ GORM | ✅ Alembic |
| WebSocket / SignalR | ✅ Natif ASP.NET | ✅ tungstenite | ✅ | ✅ |
| Pool de contributeurs | ✅ Large | ⚠️ Niche | ✅ | ✅ |

**Rust** est écarté non pour des raisons de performance, mais de **vélocité** : EF Core + ASP.NET Core + SignalR forment un écosystème cohérent sans assembler des primitives bas niveau. Pour un projet produit avec une équipe de taille réduite, Rust alourdirait le delivery sans bénéfice justifié ici.

## Décision

**.NET 10 (C#)** pour tous les services Vyzio.

- **NativeAOT** en production : démarrage < 100ms, pas de JIT, empreinte réduite
- **ASP.NET Core + EF Core + MQTT client** pour garder une stack unique du domaine jusqu'aux intégrations
- **SignalR** pour pousser les événements enrichis vers le dashboard en temps réel

## Conséquences

- ✅ Stack cohérente : ASP.NET Core + EF Core + SignalR dans un seul écosystème
- ✅ NativeAOT → binaires autonomes, pas de runtime installé sur l'appliance
- ✅ arm64 supporté nativement → Raspberry Pi 5, Apple Silicon
- ✅ Pas de runtime Python requis dans l'architecture cible
