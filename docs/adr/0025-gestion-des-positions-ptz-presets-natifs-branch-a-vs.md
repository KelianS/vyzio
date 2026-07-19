# ADR-25 — Gestion des positions PTZ : presets natifs (Branch A) vs positions Vyzio-managed (Branch B)

> Statut : Accepté

## Contexte

`PtzGoToPresetAsync` et `PtzSavePresetAsync` sont des no-ops dans `V380PtzProvider` car le protocole V380 ne connaît pas le concept de preset. De même, certaines caméras ONVIF bon marché retournent une liste de presets vide ou retournent une erreur `not implemented`. `PtzGoToPreset(presetId: 1)` dans `ToggleCameraPrivacyModeUseCase` ne provoque donc aucun mouvement sur ces caméras.

Le problème est générique : tout futur protocole ou firmware incomplet produit le même symptôme. La solution ne peut pas être couplée au protocole V380 — elle doit s'appliquer à toute caméra dont la probe ne confirme pas le support natif des presets.

## Décision

**Deux branches d'implémentation, routées à la probe par `SupportsNativePresets` dans `ConfigJson`, jamais par nom de protocole.**

**Branch A — presets natifs**

Si la probe confirme ≥ 1 preset (`GetPresets` ONVIF ou équivalent DVRIP retourne une liste non vide), le flag `"supports_native_presets": true` est persisté dans `CameraCapabilityBinding.ConfigJson`. Les use cases délèguent directement au provider :
- `PtzSavePresetAsync` → `OnvifClient.SetPresetAsync`
- `PtzGoToPresetAsync` → `OnvifClient.GotoPresetAsync`

**Branch B — positions Vyzio-managed (fallback universel)**

Si la probe ne confirme pas le support natif, `"supports_native_presets": false` est persisté. Les positions sont gérées par Vyzio via un mécanisme de **homing + comptage de pas** :

1. **Homing** : `IPtzCapabilityProvider.PtzHomingStepsAsync` envoie N steps `UpLeft` jusqu'à la butée mécanique (timeout-based). N est une constante par provider (défaut : 200 steps). Après homing, la position virtuelle `(0, 0)` est établie et mémorisée en session (`ConcurrentDictionary<cameraId, (StepsX, StepsY)>`).
2. **Tracking** : chaque appel à `PtzStepAsync` met à jour la position virtuelle en mémoire (`±1` par direction, `±1/±1` en diagonal).
3. **Save preset** : le use case lit la position virtuelle courante via `provider.GetVirtualPosition(cameraId)` et persiste `(steps_x, steps_y)` dans la table `ptz_presets`.
4. **Go to preset** : le use case exécute `PtzHomingStepsAsync`, charge `(steps_x, steps_y)` depuis `ptz_presets`, puis rejoue les steps vers la cible (`Right` × steps_x → `Down` × steps_y).

Le homing est déclenché une seule fois par session par cameraId (le vecteur `(0,0)` est mémorisé en mémoire jusqu'au redémarrage du service). Si la position courante n'est pas encore connue (caméra non encore homée cette session), `GetVirtualPosition` retourne `null` — le use case déclenche alors le homing avant de sauvegarder.

**Slots de presets réservés :**
- Preset 1 — Surveillance (home) : position de surveillance nominale.
- Preset 2 — Parking vie privée : destination lors de l'activation du mode `ptz_parking`.
- Presets 3–4 : libres, personnalisables par l'utilisateur.

## Modèle de données — `ptz_presets`

```sql
CREATE TABLE ptz_presets (
    id           TEXT PRIMARY KEY,
    camera_id    TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    preset_id    INTEGER NOT NULL,    -- 1..4
    label        TEXT NOT NULL,       -- "Surveillance" | "Parking" | libre
    native       INTEGER NOT NULL DEFAULT 0,  -- 1 si Branch A, 0 si Branch B
    native_token TEXT,    -- token ONVIF (Branch A)
    steps_x      INTEGER, -- steps depuis (0,0) horizontalement (Branch B)
    steps_y      INTEGER, -- steps depuis (0,0) verticalement, positif = bas (Branch B)
    UNIQUE (camera_id, preset_id)
);
```

## Modifications d'interface

```csharp
// IPtzCapabilityProvider — deux ajouts avec implémentation par défaut (no-op)

// Returns current virtual step position for Branch B providers.
// Returns null for Branch A providers (they don't track steps).
virtual (int StepsX, int StepsY)? GetVirtualPosition(string cameraId) => null;

// Homes the camera to mechanical UpLeft limit, resets virtual position to (0,0).
// Default no-op — only Branch B providers that support homing implement this.
virtual Task PtzHomingStepsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default)
    => Task.CompletedTask;
```

## Routing dans les use cases

```csharp
// Shared helper
static bool SupportsNativePresets(string? configJson)
{
    if (string.IsNullOrEmpty(configJson)) return false;
    using var doc = JsonDocument.Parse(configJson);
    return doc.RootElement.TryGetProperty("supports_native_presets", out var p) && p.GetBoolean();
}

// PtzSavePresetUseCase
if (SupportsNativePresets(binding.ConfigJson))
    await provider.PtzSavePresetAsync(camera, binding, presetId, ct);
else
{
    if (provider.GetVirtualPosition(camera.Id) is null)
        await provider.PtzHomingStepsAsync(camera, binding, ct);
    var (sx, sy) = provider.GetVirtualPosition(camera.Id) ?? (0, 0);
    await presets.UpsertAsync(cameraId, presetId, PresetLabel(presetId), sx, sy, ct);
}

// PtzGoToPresetUseCase
if (SupportsNativePresets(binding.ConfigJson))
    await provider.PtzGoToPresetAsync(camera, binding, presetId, ct);
else
{
    var preset = await presets.GetAsync(cameraId, presetId, ct);
    if (preset is null) return false;
    await provider.PtzHomingStepsAsync(camera, binding, ct);
    for (int i = 0; i < preset.StepsX; i++)
        await provider.PtzStepAsync(camera, binding, PtzDirection.Right, 50, ct);
    for (int i = 0; i < preset.StepsY; i++)
        await provider.PtzStepAsync(camera, binding, PtzDirection.Down, 50, ct);
}
```

## Endpoints API

```
GET  /api/cameras/{id}/ptz/presets           → liste des presets configurés (tous les slots)
POST /api/cameras/{id}/ptz/presets/{pid}/save → save la position courante dans le slot pid
POST /api/cameras/{id}/ptz/presets/{pid}/goto → aller au preset pid
```

## Conséquences

- ✅ Branch B est indépendant du protocole — V380, ONVIF cheap, DVRIP sans presets : même chemin
- ✅ Aucun changement dans `V380PtzProvider.PtzGoToPresetAsync` (reste no-op) — le routing est dans les use cases
- ✅ `OnvifPtzProvider` garde ses implémentations natives inchangées pour Branch A
- ✅ Les presets 1 et 2 sont réservés — `ConfigurePtzParkingPositionUseCase` et `ToggleCameraPrivacyModeUseCase` restent câblés sur `presetId: 1`
- ⚠️ La position virtuelle est en mémoire : un redémarrage du service perd le tracking — le homing est déclenché à nouveau sur le prochain GoToPreset, ce qui est acceptable (la position physique est connue après homing)
- ⚠️ Le replay de steps (homing + N Right + M Down) peut prendre plusieurs secondes — acceptable pour les use cases preset/parking qui ne sont pas du temps réel
