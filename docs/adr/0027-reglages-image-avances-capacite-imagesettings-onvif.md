# ADR-27 — Réglages image avancés : capacité `ImageSettings`, ONVIF Imaging Service, valeurs non persistées

> Statut : Accepté

## Contexte

SPECS §10 : l'utilisateur doit pouvoir régler luminosité, contraste, saturation, netteté et vision nocturne (IR) depuis Vyzio plutôt que dans l'app constructeur — c'est le premier jalon du principe produit « contrôle unifié de toutes les caméras » (README, `../CLAUDE.md`). Comme PTZ et vie privée matérielle (ADR-22), ces réglages ne dépendent pas de la marque mais de ce que la caméra sait réellement faire.

Différence structurelle avec PTZ/privacy : il n'y a rien à persister côté Vyzio. La caméra reste la seule source de vérité pour ses réglages image — Vyzio lit et écrit en direct, comme un simple proxy protocolaire.

## Décision

**Nouvelle valeur d'enum `CameraCapability.ImageSettings`**, résolue par protocole exactement comme `Ptz`/`HardwarePrivacy` — aucune extension du modèle `CameraCapabilityBinding` nécessaire (le binding existant sert uniquement à tracer quel protocole gère la capacité et le résultat du dernier probe).

```csharp
// Vyzio.Core/Entities/CameraCapability.cs
public enum CameraCapability { Stream, Ptz, HardwarePrivacy, ImageSettings }

// Vyzio.Core/Entities/CameraImageSettings.cs — snapshot live, jamais persisté en base
public sealed record CameraImageSettings(
    int Brightness,      // 0-100
    int Contrast,        // 0-100
    int Saturation,      // 0-100
    int Sharpness,       // 0-100
    IrCutMode IrCutMode); // Auto | On | Off

// Vyzio.Core/Interfaces/IImageSettingsCapabilityProvider.cs
public interface IImageSettingsCapabilityProvider
{
    SupportedProtocol Protocol { get; }
    Task<bool> ProbeAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
    Task<CameraImageSettings?> GetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CancellationToken ct = default);
    Task SetImageSettingsAsync(Camera camera, CameraCapabilityBinding binding, CameraImageSettings settings, CancellationToken ct = default);
}
```

`ICapabilityProviderRegistry` gagne `ResolveImageSettings(SupportedProtocol)`, même contrat que `ResolvePtz`/`ResolvePrivacy` (throw si non enregistré).

**Protocole couvert dans cette itération : ONVIF uniquement**, via le service ONVIF Imaging (`GetImagingSettings`/`SetImagingSettings`, ver20/imaging/wsdl) — `OnvifClient` gagne les méthodes correspondantes, transport SOAP identique au PTZ (WS-UsernameToken, port 8899). `OnvifImageSettingsProvider` couvre donc la même liste de marques que `OnvifPtzProvider` (V380 Pro, Hikvision, Dahua, Reolink, Axis, tout ONVIF générique).

**DVRIP (ICSee/XMEye) et Tapo KLAP ne sont pas couverts par cette ADR** — leurs commandes de réglage image ne sont pas documentées publiquement et n'ont pas encore été investiguées sur le terrain (contrairement au PTZ DVRIP, cf. ADR-21). Reste en Idées backlog jusqu'à investigation terrain, suivant le même principe que ADR-23/26 (« jamais deviner un protocole binaire propriétaire sans capture réseau »).

**Pas de migration EF** : `Capability`/`Protocol` sont déjà des colonnes `TEXT` sur `camera_capability_bindings` (ADR-22) — ajouter une valeur d'enum ne change pas le schéma. Les valeurs de réglage elles-mêmes ne sont stockées nulle part côté Vyzio.

**Endpoints (lecture/écriture directe, pas de use case de persistance) :**
```
GET /api/cameras/{id}/image-settings  → lit en direct via le provider résolu, 404 si capacité non configurée/vérifiée
PUT /api/cameras/{id}/image-settings  → écrit en direct, renvoie le nouveau snapshot lu après écriture
```

`VendorCapabilityPresets` : ajout de `(CameraCapability.ImageSettings, SupportedProtocol.Onvif)` au preset `V380Pro` — c'est la seule marque officiellement supportée qui parle déjà ONVIF.

## Conséquences

- ✅ Aucune migration de base de données, aucun risque de désynchronisation Vyzio/caméra (pas de copie locale à invalider)
- ✅ Réutilise entièrement le pattern ADR-22 (registry, probe, `VendorCapabilityPresets`) — zéro nouvelle abstraction
- ✅ `OnvifClient` déjà couvert par WS-UsernameToken/port 8899 — pas de nouveau transport
- ⚠️ DVRIP et Tapo KLAP restent hors périmètre — un utilisateur ICSee/Tapo ne voit pas cette capacité tant qu'une investigation terrain n'a pas produit un provider dédié
- ⚠️ Les plages ONVIF (`Brightness`/`Contrast`/`ColorSaturation`/`Sharpness`) sont nominalement 0-100 par le schéma `ver10/schema` mais certains firmwares appliquent leurs propres bornes ; pas de `GetOptions`/min-max dans cette itération — à ajouter si un firmware terrain contredit l'hypothèse 0-100

> **Correctif terrain (2026-07-14) :** deux caméras réelles (V380, ICSee) ont révélé que `OnvifClient` avalait toute erreur HTTP/SOAP en silence (`PostSoapAsync` loguait puis renvoyait `null`), remontant systématiquement une `LastError` vide côté binding — l'UI affichait alors un message générique au lieu de la vraie cause. Corrigé : `PostSoapAsync` accepte un paramètre `throwOnFailure` qui, pour les appels Imaging (`GetVideoSourceTokenAsync`, `GetImagingSettingsAsync`, `SetImagingSettingsAsync`), lève `OnvifCallException` avec le statut HTTP réel et le texte du SOAP fault si présent ; l'exception remonte jusqu'à `ProbeCameraCapabilityUseCase`, qui la capture déjà dans `LastError` (aucun changement nécessaire côté use case). Log terrain confirmé : un des deux boîtiers renvoie `400 Bad Request` sur `imaging_service` — cause probable : absence du paramètre SOAP 1.2 `action` dans le `Content-Type`, désormais ajouté (`soapAction` sur `PostSoapAsync`/`SendCommandAsync`) pour les appels Imaging. PTZ/Media/Device restent inchangés (comportement résilient à dessein, cf. tests `OnvifPtzProviderTests`) — seule la capacité `ImageSettings`, dont le probe doit être franc, adopte ce nouveau contrat.
