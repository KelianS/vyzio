# Catalogue constructeur

Ce dossier est la **source unique** pour tout ce qui concerne le support d'une marque ou d'un modèle de caméra dans Vyzio :
- La documentation utilisateur affichée dans l'interface lors de la découverte
- Les capacités déclarées pour chaque marque (PTZ, vie privée matérielle, réglages image)
- La liste officielle du matériel reconnu

---

## Matériel supporté

| Famille (`VendorFamily`) | id | Nom affiché | Vie privée atteignable | PTZ | Réglages image |
|---|---|---|---|---|---|
| `TplinkTapo` | `tplink_tapo` | TP-Link Tapo | **Coupure matérielle** (cache objectif + LED éteinte) via KLAP | Oui via KLAP | Non (KLAP non investigué) |
| `Icsee` | `icsee` | ICSee / XMEye | **PTZ parking** | Oui, ONVIF essayé en premier, repli DVRIP (ADR-28) | Luminosité, contraste, saturation via DVRIP (ADR-29). Netteté et IR non disponibles |
| `V380Pro` | `v380_pro` | V380 PRO | **PTZ parking** | Oui via V380 | Non confirmé sur le matériel testé, configurable à la main |

> **« Coupure matérielle »** : Vyzio commande l'API locale du constructeur. Le capteur ou le cache physique est désactivé, signal non falsifiable.
>
> **« PTZ parking »** : Vyzio commande physiquement la rotation de la caméra vers une butée mécanique, et désactive simultanément l'enregistrement. Double protection : la caméra ne voit plus rien ET Vyzio n'enregistre plus.

La colonne « vie privée » dit ce que la marque rend **atteignable**, pas ce qui est appliqué. La
stratégie effective est un réglage par caméra (`Camera.PrivacyStrategy`, `SoftwareBlur` par défaut),
jamais déduite de la marque : `Hardware` exige un binding `HardwarePrivacy` vérifié, `PtzParking`
un binding `Ptz` vérifié.

Les valeurs `VendorFamily` dans le code C# (enum `Vyzio.Core.Entities.VendorFamily`) sont converties vers ces valeurs DB par `JsonNamingPolicy.SnakeCaseLower`. Le nom du fichier `.md` doit correspondre à la valeur DB.

---

## Modèle de capacités (ADR-22, mis à jour par ADR-24)

Chaque marque est définie comme un **preset de capacités**, pas comme un adaptateur monolithique. Une capacité (ex. `Ptz`) est indépendante de la marque : elle est résolue par **protocole réseau** (`SupportedProtocol` : `Onvif`, `V380`, `Dvrip`, `TapoKlap`, `Rtsp`).

<!-- vendor-presets:start -->
```
TplinkTapo → HardwarePrivacy/[TapoKlap], Ptz/[TapoKlap]
Icsee → Ptz/[Onvif, Dvrip], ImageSettings/[Dvrip]
V380Pro → Ptz/[V380]
```
<!-- vendor-presets:end -->

> Ce bloc est rendu depuis `VendorCapabilityPresets.All` et vérifié par
> `VendorCatalogDocumentationTests`. Ne pas le modifier à la main : le test échoue en affichant le
> texte attendu, à coller ici tel quel.

Plusieurs protocoles pour une même capacité forment une **cascade**, essayée dans l'ordre écrit
(ADR-28). Le preset déclare ce qui est *attendu* pour la marque ; chaque capacité est ensuite
**vérifiée par probe** sur le matériel réel avant d'être activable, et un probe échoué ne bloque
pas les autres.

La vie privée n'est plus une capacité, à l'exception de `HardwarePrivacy` : `PtzParking` s'appuie
sur le binding `Ptz` existant. Les capacités volontairement absentes d'un preset, et la raison de
leur absence, sont commentées dans `VendorCapabilityPresets.cs`.

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

Dans `Vyzio.Core/Entities/VendorFamily.cs`. Le nom du membre est en PascalCase :
`JsonNamingPolicy.SnakeCaseLower` en dérive la valeur DB (`MonConstructeur` → `"mon_constructeur"`),
et le nom du fichier `.md` doit correspondre à cette valeur.

---

### 3. Enregistrer la détection réseau

Dans `Vyzio.Infrastructure/Services/CameraDiscovery/` :

- `AssistedCameraDiscoveryKnownDevices.cs` : l'empreinte (nom mDNS, hostname, OUI MAC) dans `DetectVendorFamily`, le nom d'affichage dans `FormatVendorFamily`
- `AssistedCameraDiscoveryIdentifier.cs` : le niveau de support dans `DetermineSupportLevel` (`"guided"` ou `"basic"`)

---

### 4. Déclarer le preset de capacités

Dans `Vyzio.Core/Entities/VendorCapabilityPresets.cs`, sur le modèle des entrées existantes : une
capacité, et la liste ordonnée des protocoles à essayer pour elle.

Si le protocole n'existe pas encore, créer le provider correspondant (`IPtzCapabilityProvider`,
`IPrivacyCapabilityProvider`, `IImageSettingsCapabilityProvider`) dans
`Vyzio.Infrastructure/CapabilityProviders/` et l'enregistrer dans
`Vyzio.Infrastructure/DependencyInjection/ServiceCollectionExtensions.cs`. **L'ordre
d'enregistrement DI est l'ordre d'essai** en détection à l'aveugle, ONVIF en premier (ADR-28).

---

### 5. Mettre à jour ce README

Le tableau « Matériel supporté » à la main, le bloc de capacités en relançant `dotnet test` : le
test échoue en affichant le bloc attendu.
