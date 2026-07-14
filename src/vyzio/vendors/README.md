# Catalogue constructeur

Ce dossier est la **source unique** pour tout ce qui concerne le support d'une marque ou d'un modèle de caméra dans Vyzio :
- La documentation utilisateur affichée dans l'interface lors de la découverte
- Les capacités déclarées pour chaque marque (mode vie privée, PTZ)
- La liste officielle du matériel reconnu

---

## Matériel supporté

| Famille (`VendorFamily`) | id | Nom affiché | Mode vie privée | PTZ | Réglages image |
|---|---|---|---|---|---|
| `TplinkTapo` | `tplink_tapo` | TP-Link Tapo | **Coupure matérielle** (cache objectif + LED éteinte) via KLAP | Oui (C200/C210/C225…) via KLAP — probe requis | Non (KLAP non investigué) |
| `Icsee` | `icsee` | ICSee / XMEye | PTZ parking via DVRIP | Oui — ONVIF essayé en premier, repli DVRIP (ADR-28) | Luminosité/contraste/saturation via DVRIP (ADR-29) — netteté/IR non disponibles |
| `V380Pro` | `v380_pro` | V380 PRO | PTZ parking via ONVIF | Oui via ONVIF | Non confirmé (ONVIF Imaging non implémenté sur le matériel testé) — configurable manuellement |

> **"Coupure matérielle"** : Vyzio commande l'API locale du constructeur. Le capteur ou le cache physique est désactivé — signal non falsifiable.
>
> **"PTZ parking"** : Vyzio commande physiquement la rotation de la caméra vers une butée mécanique, et désactive simultanément l'enregistrement. Double protection : la caméra ne voit plus rien ET Vyzio n'enregistre plus.

Les valeurs `VendorFamily` dans le code C# (enum `Vyzio.Core.Entities.VendorFamily`) sont converties vers ces valeurs DB par `JsonNamingPolicy.SnakeCaseLower` — le nom du fichier `.md` doit correspondre à la valeur DB.

---

## Modèle de capacités (ADR-22)

Chaque marque est définie comme un **preset de capacités**, pas comme un adaptateur monolithique. Une capacité (ex. `Ptz`) est indépendante de la marque — elle est résolue par **protocole** (`Onvif`, `Dvrip`, `TapoKlap`…).

```
VendorCapabilityPreset:
  TplinkTapo → [ PrivacyMode/TapoKlap, Ptz/TapoKlap ]
  Icsee      → [ Ptz/[Onvif, Dvrip] (cascade, ADR-28), PrivacyMode/PtzParking, ImageSettings/Dvrip (ADR-29) ]
  V380Pro    → [ Ptz/Onvif, PrivacyMode/PtzParking ]
  # ImageSettings/Onvif volontairement retiré du preset V380Pro (2026-07-14) : test réel a
  # confirmé "GetImagingSettings not implemented" — reste configurable manuellement.
```

Le preset déclare quelles capacités sont *attendues* pour cette marque. Elles sont ensuite **vérifiées par probe** sur le matériel réel avant d'être activables. Un probe échoué ne bloque pas les autres capacités.

---

## Ajouter un constructeur

### 1. Créer la fiche `vendors/<vendorFamily>.md`

Le nom du fichier doit correspondre à la valeur DB de `VendorFamily` (ex. `tplink_tapo.md`).

La fiche doit contenir **au minimum** ces sections :

```md
# Nom du constructeur

Contexte : quelques phrases sur pourquoi ce modèle demande une configuration particulière.

## Ce qu'il faut avant de commencer

- Prérequis matériels et logiciels

## Etapes d'activation RTSP

1. Etape 1
2. Etape 2

## Si Vyzio demande une adresse de flux

Format(s) RTSP connus pour ce constructeur.

## Mode vie privée

**Niveau de garantie : [Coupure matérielle | PTZ parking | Enregistrement désactivé]**

Expliquer en une ou deux phrases ce que Vyzio fait pour cette marque.

## Si cela ne fonctionne pas

Conseils de dépannage spécifiques au constructeur.
```

Les liens Markdown `[label](url)` sont cliquables dans l'UI. Les assets statiques vont dans `vendors/assets/` et sont servis via `/api/cameras/vendor-assets/<nom>`.

---

### 2. Ajouter la valeur dans l'enum `VendorFamily`

Dans `Vyzio.Core/Entities/VendorFamily.cs` :

```csharp
public enum VendorFamily
{
    TplinkTapo,
    Icsee,
    V380Pro,
    MonConstructeur,  // "mon_constructeur" en DB via SnakeCaseLower
}
```

Le nom du membre doit être en PascalCase — `JsonNamingPolicy.SnakeCaseLower` génère automatiquement la valeur DB (ex. `MonConstructeur` → `"mon_constructeur"`). Le nom du fichier `.md` doit correspondre.

---

### 3. Enregistrer la détection réseau

Dans `AssistedCameraDiscoveryKnownDevices.cs` :

- Ajouter la détection par empreinte (nom mDNS, hostname, OUI MAC) dans `DetectVendorFamily`
- Ajouter le nom d'affichage dans `FormatVendorFamily`
- Ajouter le niveau de support dans `DetermineSupportLevel` (`"guided"` ou `"basic"`)

---

### 4. Déclarer le preset de capacités

Dans `Vyzio.Core/Entities/VendorCapabilityPresets.cs` :

```csharp
new VendorCapabilityPreset(VendorFamily.MonConstructeur, [
    (CameraCapability.Ptz, CapabilityProtocol.Onvif),
    (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
])
```

Si le protocole n'existe pas encore, créer un `IPtzCapabilityProvider` ou `IPrivacyCapabilityProvider` correspondant dans `Vyzio.Infrastructure/CapabilityProviders/` et l'enregistrer dans `ServiceCollectionExtensions.cs`.

---

### 5. Mettre à jour le tableau "Matériel supporté" dans ce README
