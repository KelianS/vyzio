# ADR-24 — Séparation couche protocole / couche fonctionnelle : `OnvifClient`, `SupportedProtocol`, `PrivacyStrategy`

> Statut : Accepté

## Contexte

ADR-22 a introduit `CapabilityProtocol` avec des valeurs mixant protocoles réseau (`Onvif`, `Dvrip`, `TapoKlap`) et stratégies fonctionnelles (`PtzParking`, `SoftwareOnly`, `None`). Ce mélange a rendu l'enum inapte à décrire les protocoles réellement détectés sur la caméra, et a couplé la stratégie de vie privée à la résolution des providers.

Trois problèmes structurels identifiés :
1. `CapabilityProtocol.PtzParking` n'est pas un protocole réseau — c'est une stratégie applicative. Stocker ce "protocole" dans `camera_capability_bindings.protocol` crée une colonne dont la valeur n'est pas interrogeable pour répondre à "quels protocoles réseau parle cette caméra ?".
2. `OnvifPtzClient` avait fusionné transport SOAP (Wire) et orchestration (caches de profile, locks de step, logique PTZ) — rendant le client non réutilisable pour d'autres usages ONVIF (ex: bootstrap device ID V380).
3. Bootstrap de l'ID V380 via série ONVIF nécessitait que `V380Client` accède à `OnvifPtzClient` ou duplique la logique HTTP ONVIF.

## Décision

**1. `OnvifClient` — client ONVIF pur transport (Singleton).**

`OnvifPtzClient` éclaté en deux : `OnvifClient` (transport SOAP, Singleton) + `OnvifPtzProvider` (orchestration PTZ, caches, locks). `OnvifClient` expose uniquement des appels SOAP/HTTP sans état applicatif — réutilisable par n'importe quel provider.

```csharp
internal sealed class OnvifClient(IHttpClientFactory httpClientFactory, ILogger<OnvifClient> logger)
{
    // Wire methods uniquement
    Task<OnvifDeviceInfo> GetDeviceInformationAsync(Camera, CancellationToken);
    Task<(string ProfileToken, string PtzConfigToken)> GetFirstProfileAsync(Camera, CancellationToken);
    Task<PtzCapabilities> GetPtzConfigurationOptionsAsync(Camera, string configToken, CancellationToken);
    Task<PtzStatus> GetStatusAsync(Camera, string profileToken, CancellationToken);
    Task ContinuousMoveAsync(Camera, string profileToken, double pan, double tilt, CancellationToken);
    Task RelativeMoveAsync(Camera, string profileToken, double pan, double tilt, CancellationToken);
    Task StopAsync(Camera, string profileToken, CancellationToken);
    Task SetPresetAsync(Camera, string profileToken, int presetId, CancellationToken);
    Task GotoPresetAsync(Camera, string profileToken, int presetId, CancellationToken);
}
```

**2. `SupportedProtocol` — enum strictement protocoles réseau.**

`CapabilityProtocol` supprimé et remplacé :

| Avant (`CapabilityProtocol`) | Après (`SupportedProtocol`) |
|---|---|
| `Onvif` | `Onvif` |
| `Dvrip` | `Dvrip` |
| `TapoKlap` | `TapoKlap` |
| `V380` | `V380` |
| `PtzParking` | *(supprimé — stratégie, pas protocole)* |
| `SoftwareOnly` | *(supprimé — stratégie, pas protocole)* |
| `None` | *(supprimé)* |
| — | `Rtsp` *(ajouté pour futur binding Stream)* |

`Camera.SupportedProtocols` : nouvelle colonne JSON (`supported_protocols_json`) alimentée par le pipeline de probe, qui liste les protocoles réseau effectivement détectés sur la caméra.

**3. `PrivacyStrategy` — enum des stratégies vie privée par caméra.**

`PrivacyModeStrategy { Software, PtzParking, Hardware }` renommé en `PrivacyStrategy { None, SoftwareBlur, PtzParking, Hardware }`. Valeur BDD conservée dans la colonne `privacy_mode_strategy` (pas de rename schéma), avec migration de données `'software'` → `'software_blur'`.

**4. `PtzParkingPrivacyProvider` et `SoftwareOnlyPrivacyProvider` supprimés.**

La logique `PtzParking` est inlinée dans `ToggleCameraPrivacyModeUseCase` via le registry PTZ existant : `PtzGoToPresetAsync(presetId: 1)`. `SoftwareOnly` est la branche `default` du switch — aucun provider nécessaire.

**5. Bootstrap ID V380 via ONVIF (Singleton partagé).**

`V380PtzProvider` reçoit `OnvifClient` par injection. `ProbeAsync` tente dans l'ordre : ConfigJson persisté → `OnvifClient.GetDeviceInformationAsync` (serial bytes[2..5] BE = device_id) → UDP broadcast. L'ONVIF fonctionne en TCP depuis Docker bridge, contrairement au UDP.

```
Série ONVIF "9609019b8ae5" → bytes[2..5] = 0x019B8AE5 = 26970853 (device_id V380)
```

**6. `CameraCapability.PrivacyMode` → `CameraCapability.HardwarePrivacy`.**

Renommage sémantique : la capacité "privacy" enregistrée dans `camera_capability_bindings` désigne uniquement la coupure **matérielle** (Tapo KLAP). Le mode vie privée logiciel (Frigate disabled) ne nécessite pas de binding — il est universel.

**7. `BackfillCameraCapabilityBindingsUseCase` supprimé.**

Le backfill au démarrage via Linq était un one-shot de migration devenu stale. La migration EF Core `20260705120000_ArchProtocolRefacto` remplace toutes ses transformations de données.

## Conséquences

- ✅ `OnvifClient` réutilisable par tout provider qui parle ONVIF (V380 bootstrap, futur discovery)
- ✅ `SupportedProtocol` décrit des protocoles réseau réels — interrogeable pour "quels protocoles parle cette caméra ?"
- ✅ `Camera.SupportedProtocols` ouvre la porte à des affichages informatifs en UI (badges protocoles)
- ✅ `PtzParking` en tant que stratégie vie privée n'est plus couplé à un provider par protocole — fonctionne avec tout provider PTZ existant ou futur
- ✅ `PrivacyStrategy.None` est maintenant une valeur explicite — les caméras sans stratégie configurée ne tombent plus silencieusement sur `SoftwareBlur`
- ⚠️ Migration de données requise : `'software'` → `'software_blur'` dans `privacy_mode_strategy`, `'privacy_mode'` → `'hardware_privacy'` dans `capability`, suppression des bindings `ptz_parking`/`software_only`
