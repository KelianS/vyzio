# Catalogue constructeur

Ce dossier est la **source unique** pour tout ce qui concerne le support d'une marque ou d'un modèle de caméra dans Vyzio :
- La documentation utilisateur affichée dans l'interface lors de la découverte
- Le niveau de garantie du mode vie privée
- La liste officielle du matériel reconnu

---

## Matériel supporté

| Famille (`vendorFamily`) | Nom affiché | Activation RTSP | Mode vie privée |
|---|---|---|---|
| `tplink_tapo` | TP-Link Tapo | Compte caméra via app Tapo | **Coupure matérielle** (cache objectif + LED éteinte) |
| `icsee` | ICSee / XMEye | Activation dans app ICSee ou fallback DVRIP | Enregistrement désactivé (software) |
| `v380_pro` | V380 PRO | Fichier `ceshi.ini` sur carte SD | Enregistrement désactivé (software) |

> **"Coupure matérielle"** : Vyzio commande l'API locale du constructeur. Le capteur ou le cache physique est désactivé — signal non falsifiable.
>
> **"Enregistrement désactivé"** : Vyzio coupe l'accès au flux via son moteur de détection. La caméra reste électriquement active mais Vyzio n'enregistre plus.

---

## Ajouter un constructeur

### 1. Créer la fiche `vendors/<vendorFamily>.md`

Le nom du fichier doit correspondre exactement à la clé `vendorFamily` retournée par la découverte réseau (définie dans `AssistedCameraDiscoveryKnownDevices`).

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

**Niveau de garantie : [Coupure matérielle | Enregistrement désactivé]**

Expliquer en une ou deux phrases ce que Vyzio fait ou ne fait pas pour cette marque,
et pourquoi (pas d'API connue, API propriétaire implémentée, etc.).

## Si cela ne fonctionne pas

Conseils de dépannage spécifiques au constructeur.
```

Les liens Markdown `[label](url)` sont cliquables dans l'UI. Les assets statiques (fichiers à télécharger) vont dans `vendors/assets/` et sont servis via `/api/cameras/vendor-assets/<nom>`.

---

### 2. Enregistrer le `vendorFamily` dans la découverte

Dans [AssistedCameraDiscoveryKnownDevices.cs](../Vyzio.Infrastructure/Services/CameraDiscovery/AssistedCameraDiscoveryKnownDevices.cs) :

- Ajouter la détection par empreinte (nom mDNS, hostname, OUI MAC) dans `DetectVendorFamily`
- Ajouter le nom d'affichage dans `FormatVendorFamily`
- Ajouter le niveau de support dans `AssistedCameraDiscoveryIdentifier.DetermineSupportLevel` (`"guided"` ou `"basic"`)
- Ajouter les mots-clés hostname dans `LooksLikeCameraHostName` si pertinent

**Mettre à jour le tableau "Matériel supporté" dans ce README** avec la nouvelle ligne.

---

### 3. Implémenter `IVendorCameraAdapter` (mode vie privée)

Créer `Vyzio.Infrastructure/VendorAdapters/<NomConstructeur>CameraAdapter.cs` :

```csharp
public sealed class MonConstructeurCameraAdapter(...) : IVendorCameraAdapter
{
    public string VendorFamily => "mon_constructeur"; // doit matcher le vendorFamily ci-dessus

    public Task<bool> SupportsPrivacyModeAsync(Camera camera, CancellationToken ct = default)
    {
        // Retourner true si l'API constructeur permet une coupure matérielle.
        // Retourner false si seul le fallback (enregistrement désactivé) est possible.
        return Task.FromResult(true);
    }

    public Task SetPrivacyModeAsync(Camera camera, bool active, CancellationToken ct = default)
    {
        // Appeler l'API locale du constructeur.
        // Lever une exception si l'appel échoue (le use case catchera et mettra PrivacyVendorCut = false).
    }
}
```

Si aucune API matérielle n'est disponible, implémenter quand même la classe avec `SupportsPrivacyModeAsync = false` et un commentaire expliquant pourquoi. Cela documente explicitement la décision et permet une future implémentation sans toucher au reste.

Enregistrer l'adaptateur dans [ServiceCollectionExtensions.cs](../Vyzio.Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs) :

```csharp
services.AddSingleton<IVendorCameraAdapter, MonConstructeurCameraAdapter>();
```

---

### 4. Mettre à jour le tableau "Matériel supporté" dans ce README

C'est la source unique. Ne pas maintenir de liste ailleurs.
