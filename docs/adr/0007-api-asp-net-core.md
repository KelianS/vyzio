# ADR-07 — API : ASP.NET Core

> Statut : Accepté

## Contexte

L'API sert le dashboard React, les webhooks et les intégrations tierces. Elle doit exposer des flux temps réel et proxyfier les ressources Frigate avec authentification.

## Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **ASP.NET Core Minimal APIs** | Cohérence .NET, performance, outillage mature | Expertise .NET requise |
| FastAPI (Python) | Vélocité rapide sur cas simples | Introduit un second runtime principal |
| NestJS/Node | Ecosystème web riche | Moins cohérent avec le cœur .NET |

## Décision

**ASP.NET Core (.NET 10) — Minimal APIs** avec :
- **SignalR** pour le hub WebSocket événements temps réel → dashboard
- **SSE** via `IAsyncEnumerable` pour les flux légers (état caméras)
- **Scalar** pour la documentation OpenAPI
- Proxy authentifié devant Frigate : clips et flux live HLS redirigés depuis l'API Frigate après vérification du JWT Vyzio — Frigate n'est jamais exposé directement

## Routes principales

```
GET    /api/cameras                  → Config + état (via Frigate REST)
POST   /api/cameras                  → Ajout (écrit frigate.yml + reload)
GET    /api/cameras/{id}/live        → Proxy HLS Frigate (auth Vyzio)

GET    /api/profiles
POST   /api/profiles                 → Upload photo → sync bibliothèque Frigate + métadonnées Vyzio
DELETE /api/profiles/{id}

GET    /api/events                   → Paginé, filtrable
GET    /api/events/{id}/thumbnail    → Proxy Frigate + URL signée (accès distant)
WS     /hubs/events                  → SignalR hub push temps réel

GET    /api/clips/{id}               → Proxy clip MP4 Frigate (auth Vyzio)

POST   /api/auth/login
POST   /api/auth/refresh
DELETE /api/auth/logout

GET    /api/settings
PATCH  /api/settings
```

## Conséquences

- ✅ Stack 100% .NET — logs unifiés, DI partagé, même pipeline middleware
- ✅ SignalR gère la reconnexion WebSocket automatiquement côté client
- ✅ Frigate jamais exposé directement — Vyzio est le proxy authentifié obligatoire
- ⚠️ Proxy clips vidéo : utiliser `HttpClient` en streaming pour éviter le buffering mémoire
