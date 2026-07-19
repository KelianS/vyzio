# ADR-29 — DVRIP : `DvripClient` partagé, réglages image (`AVEnc.VideoColor.[0]`), PTZ Move/Stop

> Statut : Accepté

## Contexte

ICSee n'expose aucun service ONVIF (port 8899 refusé) — `ImageSettings/Onvif` (ADR-27) ne peut jamais fonctionner sur cette marque. `docs/investigations/icsee_dvrip_privacy.md` avait identifié la piste DVRIP pour les réglages image (`AVEnc.VideoColor.[0]`, notamment `Brightness`) mais avec plusieurs erreurs de transcription du protocole (header binaire, codes de commande, algorithme de hash — voir l'erratum en tête de ce document), jamais corrigées avant un test terrain complet. `DvripPtzProvider` (PTZ, ADR-22/25) partageait ces mêmes erreurs et n'a donc jamais fonctionné correctement en conditions réelles malgré des tests apparemment concluants lors de l'investigation initiale (obtenus via un outil différent du code Vyzio).

## Décision

**a) `DvripClient` — client protocole partagé** (`Vyzio.Infrastructure/VendorAdapters/DvripClient.cs`), extrait de `DvripPtzProvider`. Même rôle que `OnvifClient` pour ONVIF : transport bas niveau uniquement (TCP port 34567, login, framing binaire, JSON), aucune logique fonctionnelle. `DvripPtzProvider` et `DvripImageSettingsProvider` en dépendent tous les deux.

**Protocole confirmé contre une caméra ICSee réelle** (comparaison directe avec la bibliothèque de référence `python-dvr`, puis test en direct) :
- Header binaire **20 octets** : `head(1)=0xFF version(1)=0x00 pad(2) session(4LE) seq(4LE) pad(2) cmd(2LE) dataLen(4LE)`.
- Login : champ JSON `"UserName"` (pas `"Name"`).
- `SofiaHash` : paires d'**octets bruts** du digest MD5 (8 caractères en sortie) — `sofia_hash("a4m3h5") == "S8jyn9CB"`.
- Codes de commande : Login=1000, ConfigGet=1042, ConfigSet=**1040**, OPPTZControl=1400.

```csharp
internal sealed class DvripClient(ILogger<DvripClient> logger)
{
    public Task<string?> ExecuteAsync(Camera, int cmdCode, Func<string, string> buildPayload, CancellationToken);
    public Task<bool> TryLoginAsync(Camera, CancellationToken); // probe de connectivité, jamais de throw
    public Task<JsonNode?> ConfigGetAsync(Camera, string configName, CancellationToken);  // throw DvripCallException
    public Task ConfigSetAsync(Camera, string configName, JsonNode config, CancellationToken); // throw DvripCallException
}

public sealed class DvripCallException(string message, Exception? inner = null) : Exception(message, inner);
```

`DvripCallException` reprend le principe d'`OnvifCallException` (ADR-28) : `ConfigGetAsync`/`ConfigSetAsync` lèvent avec la vraie cause (statut HTTP-like `Ret`, timeout distingué d'un rejet explicite) plutôt que d'avaler l'échec — `ProbeCameraCapabilityUseCase` la capture déjà dans `LastError`. Bornées à 5s au total (connexion + login + requête + réponse). `DvripPtzProvider.TryLoginAsync` garde son comportement probe existant (avale, renvoie `false`).

**b) `DvripImageSettingsProvider` — Brightness/Contrast/Saturation uniquement**, via `AVEnc.VideoColor.[0]` (`ConfigGet`/`ConfigSet`).

- Schéma JSON non garanti stable entre firmwares (plat ou imbriqué sous un tableau de plages horaires) : `FindIntProperty`/`SetIntProperty` parcourent récursivement l'arbre JSON par nom de champ plutôt que de supposer une structure fixe — même principe de résilience qu'`OnvifClient`. `SetImageSettingsAsync` relit toujours la config complète, ne modifie que les champs connus, renvoie l'arbre entier tel quel (aucun champ non modélisé n'est perdu).
- **Sharpness et IrCutMode non pris en charge** : absents de `VideoColor`, mode jour/nuit jamais investigué. `GetImageSettingsAsync` renvoie des valeurs neutres fixes (`Sharpness=50`, `IrCutMode=Auto`), `SetImageSettingsAsync` ignore silencieusement ces deux champs. Le frontend masque les contrôles correspondants quand le protocole résolu est `dvrip`.

**c) `VendorCapabilityPresets.Icsee`** déclare `(ImageSettings, [Dvrip])` — un seul candidat (ONVIF confirmé absent sur ce matériel).

**d) `VendorCapabilityPresets.V380Pro`** ne déclare **plus** `(ImageSettings, [Onvif])` — un test réel a renvoyé un SOAP fault ONVIF explicite (« GetImagingSettings not implemented »), signal définitif de non-implémentation. Un contrôle natif V380 (vision nocturne) a été tenté puis abandonné — voir ADR-30. `ImageSettings` reste configurable à la main pour V380 (via ONVIF) si une unité différente répond correctement, jamais activée sans test réussi.

**e) `DvripPtzProvider` — Move/Stop.** Payload `OPPTZControl` conforme à `python-dvr`/`dbuezas` (`icsee-ptz`, intégration Home Assistant en production pour cette même famille de caméras) : pas de champ `"Action"`, pas de `"POINT"`, `"Pattern"` toujours `"Start"`.

```csharp
// Mouvement : Command = direction, Preset = 0, Step = 1-8 selon la vitesse
// Arrêt     : Command = "DirectionUp" (fixe, indépendant de la direction en cours), Preset = -1, Step = 5
```

`Preset=-1` est le sentinel d'arrêt réel du firmware — pas une simple valeur "sans preset". `PtzStepAsync` retombe sur l'implémentation par défaut de l'interface (`Move` puis `Stop`), désormais correcte puisque les deux commandes sont protocolairement valides. Gauche/droite sont inversés dans `DirectionToCommand` par rapport au nom de commande DVRIP intuitif — montage moteur propre à ce modèle, haut/bas ne nécessitait pas d'inversion.

## Conséquences

- ✅ Réglages image DVRIP et PTZ DVRIP fonctionnels et validés en direct sur matériel réel (lecture, écriture, mouvement, arrêt)
- ✅ `DvripClient` élimine la duplication du framing binaire entre PTZ et réglages image — même pattern que `OnvifClient`
- ✅ Résilient à un schéma JSON de config inconnu — pas de risque de corrompre un champ non modélisé côté Vyzio
- ⚠️ Netteté et vision nocturne restent indisponibles pour ICSee tant qu'une investigation terrain dédiée n'a pas confirmé une commande DVRIP fiable
- ⚠️ Tapo KLAP reste hors périmètre (aucune investigation), voir Idées backlog
