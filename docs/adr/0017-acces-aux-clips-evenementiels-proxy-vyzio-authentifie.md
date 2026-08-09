# ADR-17 — Accès aux clips événementiels : proxy Vyzio authentifié en streaming

> Statut : Accepté — le proxy tient, mais l'identifiant de route n'est plus résolu en base :
> [ADR-49](0049-vyzio-ne-persiste-pas-les-detections-l-historique-est-la-liste-de-frigate-enrichie-a-la-lecture.md)

## Contexte

Chaque événement de détection peut produire un clip MP4 dans Frigate (si l'enregistrement de clips est activé). Le champ `has_clip` dans `observed_events` indique si un clip est disponible. L'UI doit permettre de lire ce clip depuis l'historique. À la différence du flux live (continu, haute bande passante), les clips sont des fichiers courts (<60s en général) : le proxy est acceptable.

## Endpoints clips Frigate disponibles

```
GET /api/events/{event_id}/clip.mp4       → clip événementiel MP4
GET /api/events/{event_id}/thumbnail.jpg  → miniature de l'événement
GET /api/events/{event_id}/snapshot.jpg   → snapshot haute résolution
```

Frigate stocke les clips sous `/media/frigate/clips/` dans son volume. La rétention est contrôlée par la section `record.retain` de la config Frigate générée.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — URL directe Frigate** | Vyzio retourne l'URL Frigate, le navigateur accède directement | Zéro overhead serveur | Frigate exposé sans auth ; problème CORS selon navigateur |
| **B — Proxy Vyzio authentifié** | `GET /api/detection-events/{id}/clip` → Vyzio proxifie le MP4 depuis Frigate en streaming | Auth Vyzio obligatoire ; Frigate jamais exposé pour les clips ; pas de CORS | Overhead serveur modéré — acceptable (fichiers courts, pas de flux continu) |
| **C — Volume partagé + serve statique** | Vyzio monte le volume clips Frigate et les sert directement | Performance maximale | Couplage fort au layout interne Frigate ; déconseillé |

## Décision

**Option B retenue : proxy Vyzio authentifié en streaming pour les clips et thumbnails.**

La route `GET /api/detection-events/{id}/clip` valide le JWT Vyzio, résout le `frigate_event_id` dans `observed_events`, puis proxifie le MP4 depuis `http://frigate:5000/api/events/{frigate_event_id}/clip.mp4` en **streaming chunked** pour éviter le buffering mémoire complet.

```csharp
// Principe de l'implémentation (pas de buffering complet)
var frigateStream = await httpClient.GetStreamAsync(frigateClipUrl, ct);
return Results.Stream(frigateStream, "video/mp4", enableRangeProcessing: true);
```

Le support des **Range headers** (HTTP 206) est activé pour permettre la navigation dans le clip depuis le player navigateur sans retélécharger le fichier entier.

**Routes exposées :**

```
GET /api/detection-events/{id}/clip        → proxy clip MP4 (streaming, Range support)
GET /api/detection-events/{id}/thumbnail   → proxy thumbnail JPEG (déjà existant via FrigateSnapshotProvider)
```

**Rétention clips Frigate :** contrôlée par la section `record` de `frigate.generated.yml`. Vyzio projette la rétention configurée par l'utilisateur (en jours) dans ce fichier. Quand Frigate supprime un clip arrivé à terme, `has_clip` dans `observed_events` n'est pas mis à jour automatiquement — l'UI doit gérer gracieusement un 404 sur la route clip.

## Conséquences

- ✅ Auth Vyzio validée avant tout accès aux clips — Frigate jamais exposé pour les médias
- ✅ Support Range HTTP → navigation dans le clip sans re-download complet
- ✅ Pas de couplage au layout interne Frigate (volume)
- ⚠️ Overhead proxy modéré — acceptable pour des clips <60s ; à monitorer si clips longs (enregistrement continu)
- ⚠️ `has_clip: true` peut devenir obsolète si Frigate a supprimé le clip par rétention — l'UI affiche un état "clip expiré" si 404 reçu
