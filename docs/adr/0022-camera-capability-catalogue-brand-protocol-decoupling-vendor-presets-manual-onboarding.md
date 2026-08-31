# ADR-22 — Catalogue de capacités caméra : découplage marque/protocole, presets vendor et onboarding manuel

> Statut : Accepté

## Contexte

ADR-20 et ADR-21 ont introduit `IVendorCameraAdapter` : une caméra a un `VendorFamily` (string) qui résout vers **un seul adaptateur monolithique**, lequel décide en dur si PTZ et mode vie privée sont supportés et comment les piloter. Ce modèle a deux limites structurelles, révélées par l'usage :

1. **Couplage fragile par string.** `TapoCameraAdapter.VendorFamily` a valu `"tapo"` au lieu de `"tplink_tapo"` sans aucune erreur de compilation — le ticket technique initial proposait de typer `VendorFamily`, mais cela ne traite que le symptôme : tant qu'une marque résout vers un seul adaptateur figé, le vrai problème (1 marque = 1 implémentation imposée) reste entier.
2. **Aucune caméra hors catalogue ne peut accéder aux fonctionnalités avancées.** Une caméra ICSee non reconnue (faux négatif de détection, variante de firmware) ne peut pas activer le PTZ ou un mode vie privée renforcé, même si son matériel le permet — alors que `OnvifCameraAdapter` prouve déjà que ces capacités sont souvent **indépendantes de la marque** (un seul adaptateur couvre V380, Hikvision, Dahua, Reolink, Axis sans code spécifique).

`OnvifCameraAdapter` est en réalité déjà un **provider de protocole**, pas un adaptateur de marque — son `VendorFamily = "onvif"` et l'alias runtime `"v380_pro" → "onvif"` (ADR-21) sont un début de découplage marque/comportement. Cette ADR généralise ce constat à l'ensemble du modèle.

## Décision produit associée

Voir SPECS §2.3 : les fonctionnalités avancées deviennent des **capacités indépendantes de la marque**. Une marque "officiellement supportée" est une marque pour laquelle Vyzio connaît déjà la configuration de ces capacités (preset). Une caméra non répertoriée doit pouvoir accéder aux mêmes capacités via une déclaration manuelle **vérifiée par un test réel**, jamais sur simple déclaration.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Typer `VendorFamily` uniquement** (scope du ticket TECH initial) | Constantes typées, mais toujours 1 marque → 1 adaptateur figé | Change minimal, corrige le bug de typo | Ne résout pas le couplage de fond ; n'ouvre aucun chemin pour les caméras non répertoriées |
| **B — Catalogue de capacités + providers par protocole + presets vendor** | `Camera` expose des `CameraCapabilityBinding` (capacité × protocole × config), résolues par un registre typé par protocole ; les presets vendor pré-remplissent ces bindings | Découple marque (présentation/preset) et protocole (comportement réel, typé, vérifiable) ; débloque l'onboarding manuel ; chaque nouveau protocole profite à toutes les marques qui le parlent | Refactor plus large : nouvelle entité, migration EF, éclatement de `IVendorCameraAdapter` |
| **C — Garder l'adaptateur monolithique, ajouter une case "marque inconnue"** | Étendre `NullVendorCameraAdapter` avec des champs manuels ad hoc sur `Camera` | Minimal | Ne généralise pas — chaque nouvelle capacité manuelle nécessite de nouveaux champs ad hoc ; pas de sélection de protocole ; pas vérifiable proprement |

**Option B retenue.**

## Décision

**Le `Stream` (transport RTSP/DVRIP, ADR-19) reste hors périmètre de ce refactor** — il est fondamental et déjà bien modélisé via `Camera.StreamProtocol` + `go2rtc`. Seules les **capacités optionnelles** (PTZ, mode vie privée matériel, futur info système) basculent vers le modèle générique.

**0. Principe transversal : enum en code, string inchangée en base — zéro migration sur l'existant.** Tous les champs qui représentent un ensemble fermé de valeurs (`VendorFamily`, `StreamProtocol`, `PrivacyModeSource`, `PrivacyModeStrategy`, `CameraCapability`, `CapabilityProtocol`) sont des **enums C# dans le code**, jamais des strings comparées à la main. La persistance EF Core reste sur les **mêmes colonnes `TEXT`, avec les mêmes valeurs déjà stockées** (`"tplink_tapo"`, `"rtsp"`, `"manual"`, `"ptz_parking"`...). Un converter pur (CLR type → même colonne, même type SQL, même nullabilité) ne modifie aucun facet détecté par EF Core : **`dotnet ef migrations add` ne génère aucune opération sur ces colonnes**. La seule migration réelle de ce chantier est l'ajout de la nouvelle table `camera_capability_bindings` (additive, voir §Migration).

```csharp
// Vyzio.Core/Entities/VendorFamily.cs — remplace les strings "tplink_tapo"/"icsee"/"v380_pro"
// Noms choisis pour que JsonNamingPolicy.SnakeCaseLower(nom) == valeur déjà stockée en base
// (vérifié : TplinkTapo → "tplink_tapo", Icsee → "icsee", V380Pro → "v380_pro")
public enum VendorFamily { TplinkTapo, Icsee, V380Pro }
// Camera.VendorFamily devient VendorFamily? (null = marque non détectée/non répertoriée)

// Vyzio.Core/Entities/StreamProtocol.cs — remplace "rtsp" | "dvrip" (ADR-19)
public enum StreamProtocol { Rtsp, Dvrip }

// Vyzio.Core/Entities/PrivacyModeSource.cs — remplace "manual" | "schedule" | null
public enum PrivacyModeSource { Manual, Schedule }
// Camera.PrivacyModeSource devient PrivacyModeSource? (null = jamais activé)

// Vyzio.Core/Entities/PrivacyModeStrategy.cs — remplace "software" | "ptz_parking" | "hardware" (ADR-21)
public enum PrivacyModeStrategy { Software, PtzParking, Hardware }

// Vyzio.Core/Entities/CameraCapability.cs
public enum CameraCapability { Ptz, PrivacyMode /* , SystemInfo (futur) */ }

// Vyzio.Core/Entities/CapabilityProtocol.cs — nouvelle colonne, aucune contrainte de valeur héritée
public enum CapabilityProtocol { Onvif, Dvrip, TapoKlap, PtzParking, SoftwareOnly, None }
```

`PtzParking` et `SoftwareOnly` sont des protocoles de `PrivacyMode` qui **composent** un protocole `Ptz` existant plutôt que de parler au firmware — voir point 3.

**Conversion EF Core — un seul converter générique, pas un mapping en dur par enum :**

```csharp
// Vyzio.Infrastructure/Persistence/Conversions/SnakeCaseEnumConverter.cs
public sealed class SnakeCaseEnumConverter<TEnum> : ValueConverter<TEnum, string>
    where TEnum : struct, Enum
{
    public SnakeCaseEnumConverter() : base(
        v => JsonNamingPolicy.SnakeCaseLower.ConvertName(v.ToString()),
        v => Enum.Parse<TEnum>(ToPascalCase(v), ignoreCase: true))
    { }

    private static string ToPascalCase(string snake) =>
        string.Concat(snake.Split('_').Select(s => char.ToUpperInvariant(s[0]) + s[1..]));
}
```

Appliqué identiquement aux 6 enums (variante `SnakeCaseEnumConverter<TEnum?>` pour les propriétés nullables `VendorFamily?` / `PrivacyModeSource?`). Un test unitaire round-trip (`ToSnakeCase(FromSnakeCase(s)) == s`) sur chaque valeur legacy déjà en base (`"tplink_tapo"`, `"icsee"`, `"v380_pro"`, `"rtsp"`, `"dvrip"`, `"manual"`, `"schedule"`, `"software"`, `"ptz_parking"`, `"hardware"`) verrouille la non-régression — c'est ce test, pas une relecture manuelle, qui garantit qu'aucune base existante n'est cassée par le renommage d'identifiants C# ci-dessus.

**2. Nouvelle entité `CameraCapabilityBinding` (remplace les booléens épars) :**

```csharp
public sealed class CameraCapabilityBinding
{
    public Guid Id { get; init; }
    public Guid CameraId { get; init; }
    public CameraCapability Capability { get; init; }
    public CapabilityProtocol Protocol { get; init; }
    public string? ConfigJson { get; set; }     // port, adresse ONVIF, credentials DVRIP, etc.
    public bool Verified { get; set; }          // résultat du dernier test reel — jamais déclaratif
    public DateTime? VerifiedAt { get; set; }
    public string? LastError { get; set; }
}
// Unique (CameraId, Capability) — une seule liaison active par capacité et par caméra
```

`Camera.VendorFamily` est **conservé** mais devient purement descriptif (affichage, lien vers `vendors/*.md`, choix du preset à l'onboarding) — il ne pilote plus aucune résolution fonctionnelle. `Camera.PtzSupported` devient un booléen dérivé/caché (`Verified == true` sur le binding `Ptz`) pour les requêtes UI rapides ; la source de vérité est le binding. `Camera.PrivacyModeStrategy` (enum `PrivacyModeStrategy`) ne change pas de rôle — c'est déjà un choix utilisateur protocole-agnostique, il passe juste de string à enum comme le reste (point 0).

**3. Interfaces de capacité, en remplacement de `IVendorCameraAdapter` monolithique :**

```csharp
public interface IPtzCapabilityProvider
{
    CapabilityProtocol Protocol { get; }
    Task<bool> ProbeAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task PtzMoveAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default);
    Task PtzStopAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task PtzGoToPresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);
    Task PtzSavePresetAsync(CameraCapabilityBinding binding, int presetId, CancellationToken ct = default);
    Task PtzStepAsync(CameraCapabilityBinding binding, PtzDirection direction, int speed, CancellationToken ct = default); // défaut : Move+Stop
}

public interface IPrivacyCapabilityProvider
{
    CapabilityProtocol Protocol { get; }
    Task<bool> ProbeAsync(CameraCapabilityBinding binding, CancellationToken ct = default);
    Task SetPrivacyModeAsync(CameraCapabilityBinding binding, bool active, CancellationToken ct = default);
}
```

**Implémentations (reprises des adaptateurs existants, sans réécriture du protocole bas niveau) :**

```
IPtzCapabilityProvider
  OnvifPtzProvider      ← logique extraite de OnvifCameraAdapter (ADR-21)
  DvripPtzProvider      ← logique extraite de ICSeeXMEyeCameraAdapter (OPPTZControl cmd 1400)
  TapoKlapProvider       ← NOUVEAU : motorMove via KLAP (voir note ci-dessous)

IPrivacyCapabilityProvider
  TapoKlapProvider          ← logique extraite de TapoCameraAdapter (KLAP, coupure matérielle)
  PtzParkingPrivacyProvider ← décore N'IMPORTE QUEL IPtzCapabilityProvider pour réaliser la
                              manœuvre de parking (ADR-21) ; généralise ptz_parking à tout
                              protocole PTZ, pas seulement Onvif/Dvrip
  SoftwareOnlyPrivacyProvider ← no-op, toujours disponible (fallback universel, ADR-20)
```

**Note — un protocole n'est pas limité à une seule capacité.** `TapoKlapProvider` implémente **les deux interfaces** (`IPrivacyCapabilityProvider` et `IPtzCapabilityProvider`) sur le même transport KLAP (handshake + chiffrement AES-128-GCM déjà implémentés dans `TapoCameraAdapter`). C'est un exemple concret du problème que ce refactor corrige : les caméras Tapo pan-tilt (C200, C210, C225…) supportent le PTZ via une commande KLAP (`motorMove`) **sur le même canal** que `set_lens_mask` — mais comme l'ancien `TapoCameraAdapter` n'exposait que les méthodes privacy de `IVendorCameraAdapter`, cette capacité PTZ n'a jamais été branchée, alors que toute l'infrastructure de transport (auth, chiffrement) existe déjà et fonctionne. `SupportsPtzAsync` retournait `false` pour Tapo non pas parce que le matériel ne le permet pas, mais parce que personne n'avait de raison de regarder au-delà de la capacité pour laquelle l'adaptateur avait été écrit initialement. Le découplage capacité/protocole rend ce genre de capacité manquante visible et triviale à ajouter (nouvelle commande KLAP, pas nouveau transport) — voir tâche dédiée dans le backlog.

**4. `ICapabilityProviderRegistry`** remplace `IVendorCameraAdapterFactory` : résolution par **(capacité, protocole)** typé, plus par `VendorFamily` string.

```csharp
public interface ICapabilityProviderRegistry
{
    IPtzCapabilityProvider ResolvePtz(CapabilityProtocol protocol);
    IPrivacyCapabilityProvider ResolvePrivacy(CapabilityProtocol protocol);
}
```

**5. Presets vendor — la marque redevient une donnée, pas du code :**

```csharp
// Preset = bindings par défaut proposées à l'onboarding pour une marque reconnue
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, CapabilityProtocol Protocol)> DefaultBindings);

// Vyzio.Infrastructure/VendorPresets/VendorCapabilityPresets.cs
public static readonly IReadOnlyList<VendorCapabilityPreset> All = new[]
{
    new VendorCapabilityPreset(VendorFamily.TplinkTapo, new[]
    {
        (CameraCapability.PrivacyMode, CapabilityProtocol.TapoKlap),
        (CameraCapability.Ptz, CapabilityProtocol.TapoKlap),   // nouveau — voir note TapoKlapProvider
    }),
    new VendorCapabilityPreset(VendorFamily.Icsee, new[]
    {
        (CameraCapability.Ptz, CapabilityProtocol.Dvrip),
        (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
    }),
    new VendorCapabilityPreset(VendorFamily.V380Pro, new[]
    {
        (CameraCapability.Ptz, CapabilityProtocol.Onvif),
        (CameraCapability.PrivacyMode, CapabilityProtocol.PtzParking),
    }),
};
```

Un test vérifie que chaque valeur de l'enum `VendorFamily` a un fichier `vendors/{nom_snake_case}.md` correspondant — le nom de fichier est dérivé via le même `SnakeCaseEnumConverter` que la persistance (`JsonNamingPolicy.SnakeCaseLower`), pas une seconde table de correspondance (clôt le critère de validation du ticket TECH initial).

**6. Onboarding :**

```
Marque détectée et reconnue (heuristiques inchangées, ADR-12) :
  → pré-remplir les bindings depuis VendorCapabilityPreset
  → probe automatique de chaque binding (silencieux, identique à l'expérience actuelle)
  → binding activé seulement si Verified == true

Marque non reconnue ("Configuration avancée — caméra non répertoriée") :
  → pour chaque capacité (PTZ, mode vie privée) : l'utilisateur choisit un protocole
    (ONVIF / DVRIP / Aucun) et saisit les paramètres de connexion requis
  → Vyzio exécute ProbeAsync() avant d'autoriser l'activation
  → échec de probe → message explicite, capacité non proposée (jamais un simple "à vos risques")
```

## Migration

- **Une seule migration EF Core réelle dans ce chantier : ajout de la table `camera_capability_bindings`** (additive, aucune colonne existante touchée).
- Les colonnes existantes `vendor_family`, `stream_protocol`, `privacy_mode_source`, `privacy_mode_strategy` ne changent ni de nom, ni de type SQL, ni de contenu — seul le type CLR change côté EF Core (string → enum via `SnakeCaseEnumConverter`, point 0). `dotnet ef migrations add` ne doit générer aucune opération sur ces colonnes ; si une opération apparaît malgré tout à la génération, c'est un signal que le converter ne correspond pas exactement au schéma existant et qu'il faut le corriger avant de committer la migration — pas l'inverse.
- Script de backfill (logique applicative, pas une migration de schéma) : pour chaque caméra existante, dériver les `CameraCapabilityBinding` depuis l'état actuel —
  `VendorFamily == TplinkTapo` → binding `PrivacyMode/TapoKlap` (Verified = `PrivacyVendorCut` actuel) ; le binding `Ptz/TapoKlap` n'est **pas** backfillé automatiquement (capacité nouvellement exposée, jamais vérifiée auparavant) — proposé à l'utilisateur comme probe optionnel post-migration, jamais activé silencieusement ;
  `PtzSupported == true` + `VendorFamily ∈ {V380Pro (alias onvif), Icsee}` → binding `Ptz/Onvif` ou `Ptz/Dvrip` selon la marque ;
  `PrivacyModeStrategy == PtzParking` → binding `PrivacyMode/PtzParking` référençant le binding `Ptz` existant.
- Aucune régression fonctionnelle attendue sur les capacités déjà actives : le comportement par caméra existante est reconstruit à l'identique, pas réinitialisé. Seule nouveauté : la capacité PTZ Tapo, auparavant invisible, devient disponible (opt-in, probe requis).

## Conséquences

- ✅ Une nouvelle marque qui parle un protocole déjà supporté (ONVIF, DVRIP) s'ajoute en **donnée** (preset + fiche `vendors/*.md`), sans nouveau code
- ✅ Les caméras non répertoriées accèdent aux mêmes capacités que les caméras supportées, via un onboarding plus long mais jamais bloquant par principe (SPECS §2.3)
- ✅ Plus aucune résolution fonctionnelle par string libre : tous les champs fermés (`VendorFamily`, `StreamProtocol`, `PrivacyModeSource`, `PrivacyModeStrategy`, `CapabilityProtocol`) sont des enums vérifiés à la compilation — le bug `"tapo"` vs `"tplink_tapo"` ne peut plus se reproduire, ni en lecture ni en écriture
- ✅ `ptz_parking` se généralise automatiquement à tout futur protocole PTZ (le décorateur `PtzParkingPrivacyProvider` ne connaît aucun détail de protocole)
- ✅ `VendorFamily` reste l'identifiant de présentation/documentation — aucune rupture pour `vendors/*.md`, les heuristiques de détection (ADR-12) ou l'affichage UI
- ✅ Le découplage capacité/protocole révèle une capacité déjà disponible mais jamais implémentée : le PTZ Tapo via KLAP (voir note `TapoKlapProvider`) — preuve directe que le modèle précédent cachait des capacités plutôt que de les rendre visibles
- ⚠️ Refactor plus large que le ticket TECH initial : migration EF + éclatement d'interface + UI d'onboarding manuel — à phaser explicitement dans le backlog
- ⚠️ Le protocole `TapoKlap` reste à ce jour mono-marque (Tapo) ; sa généralisation en `CapabilityProtocol` est surtout structurelle/symétrique pour la partie transport, mais lui permet déjà de servir deux capacités (Privacy + Ptz) au lieu d'une seule — gain de réutilisation réel, pas seulement symétrique
- ⚠️ L'onboarding manuel introduit une surface d'erreur utilisateur plus large (saisie de paramètres protocole) — le probe obligatoire avant activation est la garde-fou non négociable

> **Mise à jour 2026-07-05 (ADR-24) :** `CapabilityProtocol` supprimé et remplacé par `SupportedProtocol { Onvif, V380, Dvrip, TapoKlap, Rtsp }` (valeurs strictement protocole réseau). `CameraCapability.PrivacyMode` renommé `CameraCapability.HardwarePrivacy`. `OnvifPtzClient` → `OnvifClient` (pure transport). `PtzParkingPrivacyProvider` et `SoftwareOnlyPrivacyProvider` supprimés. `BackfillCameraCapabilityBindingsUseCase` supprimé. `Camera.SupportedProtocols` (JSON) ajouté. Voir ADR-24.
