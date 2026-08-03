# ADR-26 — Miniatures de positions PTZ : capture client-triggered, stockage fichier, serving direct

> Statut : Accepté

## Contexte

Chaque preset PTZ configuré doit afficher une miniature de la vue caméra à la position enregistrée (SPECS §9.4). La miniature doit être capturée après un GoTo, persistée et servie par l'API.

## Options comparées

| Option | Stockage | Déclenchement | Complexité |
|---|---|---|---|
| **BLOB SQLite sur PtzPreset** | DB | Post-goto | ⚠️ Migr. + DB bloat images |
| **Fichier sur disque** (retenu) | Fichier | Post-goto client | ✅ Simple, pas de migration |
| **URL client-side (localStorage)** | Browser | Post-goto | ❌ Éphémère, pas multi-device |

## Décision

**Fichiers JPEG sur disque, dans le répertoire de données (`{data_dir}/ptz-thumbnails/{cameraId}-{presetId}.jpg`).**

- `IPtzThumbnailStore` (Core/Interfaces) — `SaveAsync` / `TryGetAsync`
- `FilePtzThumbnailStore` (Infrastructure/Services) — implémentation fichier
- Pas de use case Application dédié — la capture est orchestrée par deux endpoints Minimal API qui s'appuient directement sur `IFrigateRestClient` (même pattern que le proxy `latest.jpg`)

**Endpoints :**
```
POST /api/cameras/{id}/ptz/presets/{presetId}/snapshot  → capture frame Frigate + persiste
GET  /api/cameras/{id}/ptz/presets/{presetId}/thumbnail → sert le JPEG (404 si absent)
```

**Déclenchement côté client :**
- Après `POST /ptz/preset/goto` → attente 1 500 ms (délai de mouvement physique) → `POST /snapshot`
- Après `POST /ptz/preset/save` → même délai + capture (la caméra est déjà à la position)
- La miniature n'est pas capturée à la sauvegarde initiale d'un preset (la caméra n'est pas nécessairement à la position à ce moment)

**Affichage :**
- `PtzControlPanel` (vue live) : seul endroit où les presets se configurent ([ADR-45](0045-positions-ptz-configurees-depuis-la-vue-live-pas-les-reglages.md)) ; chaque tuile preset affiche sa miniature, déclenche la capture après GoTo et après un nouvel enregistrement
- Cache-busting via `?t={timestamp}` dans le `src` de l'image, mis à jour après chaque capture réussie

## Conséquences

- ✅ Aucune migration de base de données
- ✅ Cohérent avec le pattern existant `latest.jpg` et `FaceStorageOptions`
- ✅ Les miniatures survivent aux redémarrages (fichiers disque)
- ⚠️ Le délai de 1 500 ms est un heuristique — une caméra Branch B (homing + steps) peut être plus lente ; acceptable car la miniature est non-bloquante
