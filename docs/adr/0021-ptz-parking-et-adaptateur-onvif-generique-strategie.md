# ADR-21 — PTZ Parking et adaptateur ONVIF générique : stratégie multi-couche pour le mode vie privée

> Statut : Accepté

## Contexte

ADR-20 introduit `IVendorCameraAdapter` comme brique partagée. L'investigation terrain de juin 2026 sur ICSee (DVRIP) et V380 Pro (ONVIF) a confirmé que **le PTZ parking est la seule solution hardware viable** pour les caméras sans API native de coupure flux :

- **ICSee/XMEye** : VideoEnable=False bloqué (Ret 606), PrivacyMask sans effet sur le flux cloud P2P XMEye, OPSleep non implémenté (Ret 103). PTZ via OPPTZControl cmd 1400 confirmé fonctionnel (SetPreset + DirectionLeftUp 8s + GotoPreset).
- **V380 Pro** : ONVIF disponible mais GetPrivacyMasks absent, SetVideoEncoderConfiguration inaccessible (bug firmware Multicast). PTZ via ONVIF ContinuousMove + Stop confirmé fonctionnel.

ONVIF PTZ est un standard supporté par la quasi-totalité des caméras PTZ du marché (Hikvision, Dahua, Reolink, Axis, V380…). Implémenter un adaptateur par marque serait une réimplémentation inutile de la même logique ONVIF.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Adaptateur par marque** | `V380ProAdapter`, `HikvisionAdapter`, `ReolinkAdapter`… chacun avec son implémentation PTZ | Isolation totale par marque | Duplication massive du code ONVIF ; chaque nouvelle marque = nouveau fichier |
| **B — `OnvifCameraAdapter` générique** | Un seul adaptateur pour toutes les caméras supportant ONVIF PTZ | Zero duplication ; toute nouvelle caméra ONVIF fonctionne sans code | Cas particuliers firmware peuvent nécessiter des workarounds dans l'adaptateur générique |
| **C — Délégation PTZ à Frigate** | Passer par l'API Frigate pour les commandes PTZ | Cohérent avec ADR-01 | Frigate n'expose pas d'API PTZ pour piloter les caméras depuis Vyzio |

**Option B retenue.** ONVIF PTZ est suffisamment standardisé pour qu'un adaptateur générique couvre la majorité des cas. Les quelques firewares incomplets (V380 presets non implémentés) sont gérés par des fallbacks dans l'adaptateur.

## Décision

**Trois stratégies de mode vie privée, configurables par caméra.** Chaque stratégie est documentée comme une extension de la décision ADR-20 :

| Stratégie | Déclenchée par | Comportement |
|---|---|---|
| `"software"` | Toutes caméras | Frigate `enabled: false` uniquement |
| `"ptz_parking"` | Caméras PTZ (`PtzSupported = true`) | Mouvement vers butée mécanique **ET** Frigate `enabled: false` (cumulatif) |
| `"hardware"` | Tapo (et futures caméras avec firmware natif) | Coupure API constructeur **ET** Frigate `enabled: false` (cumulatif) |

**`ptz_parking` est toujours cumulatif avec le fallback software.** Cette règle n'est pas un compromis — c'est une garantie : si le mouvement PTZ échoue (timeout réseau, caméra hors portée), Frigate est quand même désactivé.

## Architecture — `OnvifCameraAdapter` générique

```csharp
// Vyzio.Infrastructure/VendorAdapters/OnvifCameraAdapter.cs
// VendorFamily = "onvif"
// Couvre : V380 Pro, Hikvision, Dahua, Reolink, Axis et tout appareil ONVIF PTZ
public sealed class OnvifCameraAdapter : IVendorCameraAdapter
{
    public string VendorFamily => "onvif";

    // Privacy : PTZ parking cumulatif avec Frigate disabled (géré par ToggleCameraPrivacyModeUseCase)
    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct)
        => Task.FromResult(camera.PtzSupported);  // privacy hardware = ptz_parking si PTZ disponible

    // PTZ : ONVIF ContinuousMove + Stop
    public Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct) => Task.FromResult(true);
    public Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct);
    public Task PtzStopAsync(Camera camera, CancellationToken ct);
    // Preset : GotoPreset si supporté, sinon ContinuousMove inverse (fallback)
    public Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct);
    public Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct);
}
```

Séquence PTZ parking — privacy ON :
1. `ContinuousMove(pan=-1, tilt=-1)` pendant ~8s → butée mécanique
2. `Stop`

Séquence PTZ parking — privacy OFF :
1. `GotoPreset(presetId: 1)` si presets supportés
2. Sinon : `ContinuousMove(pan=+1, tilt=+1)` ~4s → `Stop` (retour approximatif)

## Architecture — extension `IVendorCameraAdapter`

```csharp
public interface IVendorCameraAdapter
{
    string VendorFamily { get; }

    // Privacy (ADR-20)
    Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default);
    Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default);

    // PTZ (ADR-21)
    Task<bool> SupportsPtzAsync(Camera camera, CancellationToken ct = default);
    Task PtzMoveAsync(Camera camera, PtzDirection direction, int speed, CancellationToken ct = default);
    Task PtzStopAsync(Camera camera, CancellationToken ct = default);
    Task PtzGoToPresetAsync(Camera camera, int presetId, CancellationToken ct = default);
    Task PtzSavePresetAsync(Camera camera, int presetId, CancellationToken ct = default);
}
```

## Architecture — `VendorCameraAdapterFactory`

```
"tplink_tapo" → TapoCameraAdapter   (KLAP, hardware privacy natif)
"icsee"       → ICSeeXMEyeCameraAdapter  (DVRIP OPPTZControl cmd 1400)
"onvif"       → OnvifCameraAdapter   (ONVIF générique — V380, Hikvision, Dahua, Reolink, Axis…)
défaut        → NullVendorCameraAdapter
```

**Aucun adaptateur V380-spécifique.** V380 Pro utilise `vendorFamily = "onvif"`, assigné à l'onboarding via détection automatique.

## Détection ONVIF PTZ à l'onboarding

Le parcours d'ajout de caméra est enrichi d'une sonde ONVIF PTZ :

```
Onboarding — nouvelle étape après vérification RTSP :
  Si port 8899 répond ET GetCapabilities retourne service PTZ :
    → Camera.PtzSupported = true
    → Camera.VendorFamily = "onvif" (si non déjà identifié comme "icsee" ou "tplink_tapo")
    → Proposer étape "Configurer le mode vie privée" avec sélecteur de stratégie
      et PtzControlPanel pour définir la position de surveillance
```

## Composant `PtzControlPanel` — partagé multi-contexte

Un seul composant React, monté dans trois contextes :

| Contexte | Usage | Éléments affichés |
|---|---|---|
| `LiveFeedModal` | Usage quotidien | Joystick + stop + "Retour position surveillance" |
| Fiche caméra | Configuration | Joystick + stop + "Retour" + **"Définir position de surveillance"** |
| Onboarding | Première configuration | Joystick + stop + **"Définir position de surveillance"** |

Le bouton "Définir position de surveillance" déclenche `ConfigurePtzParkingPositionUseCase` → `PtzSavePresetAsync(presetId: 1)`.

## Endpoints API PTZ

```
POST /api/cameras/{id}/ptz/move          → { direction, speed }
POST /api/cameras/{id}/ptz/stop
POST /api/cameras/{id}/ptz/preset/save   → { presetId }
POST /api/cameras/{id}/ptz/preset/goto   → { presetId }
PATCH /api/cameras/{id}/privacy-strategy → { strategy: "software"|"ptz_parking"|"hardware" }
```

## Conséquences

- ✅ Zéro code supplémentaire pour chaque nouvelle caméra ONVIF PTZ — `vendorFamily = "onvif"` suffit
- ✅ PTZ parking cumulatif : protection garantie même en cas d'échec du mouvement PTZ
- ✅ `PtzControlPanel` partagé : cohérence UX entre vue live, fiche caméra et onboarding
- ✅ ICSee DVRIP isolé dans son adaptateur — ne pollue pas la logique ONVIF générique
- ⚠️ Les presets ONVIF ne sont pas universellement implémentés (V380 : "not implemented" lors des tests) — le fallback `ContinuousMove` inverse est le chemin nominal sur ces firmwares ; à valider marque par marque
- ⚠️ La durée du mouvement PTZ (~8s) est empirique — à rendre configurable si les tests montrent une hétérogénéité selon les modèles

> **Mise à jour 2026-07-05 (ADR-24) :** `PtzParkingPrivacyProvider` supprimé — la logique est inlinée dans `ToggleCameraPrivacyModeUseCase`. `PrivacyModeStrategy { Software, PtzParking, Hardware }` renommé en `PrivacyStrategy { None, SoftwareBlur, PtzParking, Hardware }` ; la valeur BDD `privacy_mode_strategy = 'software'` migrée en `'software_blur'`. Voir ADR-24.
