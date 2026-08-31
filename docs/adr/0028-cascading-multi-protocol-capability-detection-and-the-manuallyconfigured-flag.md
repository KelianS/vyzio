# ADR-28 — Détection de capacité en cascade multi-protocole + flag `ManuallyConfigured`

> Statut : Accepté

## Contexte

Deux défauts découverts en test terrain sur `SeedAndProbePresetsUseCase` (ADR-22), tous deux dans `SeedAndProbePresetAsync` :

1. **Écrasement silencieux d'une config manuelle.** Le code réinitialisait inconditionnellement le protocole d'un binding existant vers celui du preset dès qu'ils différaient (`existing.Protocol != protocol`). Ce comportement visait à migrer les vieux bindings quand le **preset lui-même change dans le code** (ex. V380Pro : `Onvif` → `V380`, migration historique) — mais il ne distingue pas ce cas de « l'utilisateur a choisi un autre protocole qui fonctionne ». Conséquence terrain : un utilisateur ICSee changeait manuellement le protocole PTZ vers `Onvif` (fonctionnel sur son unité), et le clic suivant sur « Détecter les capacités » l'écrasait silencieusement vers le `Dvrip` du preset.
2. **Un seul protocole essayé par capacité, jamais de repli.** Le preset ICSee ne déclarait que `Dvrip` pour PTZ — alors que certaines unités ICSee exposent aussi ONVIF (cf. `vendors/icsee.md` § A savoir). Sans second essai automatique, ces unités restent bloquées sur DVRIP même quand ONVIF marcherait mieux. C'était l'item backlog `onboarding` #5 (« Priorité protocole pour la détection de capacités »), resté en attente depuis le refacto `arch-protocol`.

## Décision

**a) `VendorCapabilityPreset.DefaultBindings` déclare une liste ordonnée de protocoles candidats par capacité**, pas un protocole unique :

```csharp
// Vyzio.Core/Entities/VendorCapabilityPreset.cs
public sealed record VendorCapabilityPreset(
    VendorFamily VendorFamily,
    IReadOnlyList<(CameraCapability Capability, IReadOnlyList<SupportedProtocol> Protocols)> DefaultBindings);

// Vyzio.Core/Entities/VendorCapabilityPresets.cs
new VendorCapabilityPreset(VendorFamily.Icsee,
[
    (CameraCapability.Ptz, new[] { SupportedProtocol.Onvif, SupportedProtocol.Dvrip }),
]),
```

`SeedAndProbePresetAsync` essaie chaque candidat **dans l'ordre**, s'arrête au premier qui vérifie (`Verified = true`), et conserve le dernier essayé (avec son `LastError`) si aucun ne fonctionne — jamais de fallback silencieux vers un état non testé.

**b) Nouveau champ `CameraCapabilityBinding.ManuallyConfigured`** (colonne `manually_configured`) :
- mis à `true` uniquement par `ConfigureCameraCapabilityUseCase` (le chemin manuel — formulaire de configuration, y compris sur une marque reconnue) ;
- laissé à `false` pour tout binding seedé depuis un preset ;
- `SeedAndProbePresetAsync` ne touche **jamais** un binding `ManuallyConfigured = true`, qu'il soit vérifié ou non — seul un nouveau choix manuel de l'utilisateur peut le changer. Il se contente de re-probe pour rafraîchir `Verified`/`LastError`.
- un binding déjà `Verified = true` avec un protocole toujours présent dans la liste de candidats du preset n'est pas non plus retesté depuis zéro — seulement re-probe, jamais reset.

**c) Le formulaire de configuration manuelle n'est plus réservé aux caméras non répertoriées.** Une capacité non encore liée (preset ou manuelle) reste toujours ajoutable à la main, même sur une marque reconnue — un preset déclare ce que Vyzio *attend*, pas un plafond exhaustif (ex. ajouter `ImageSettings/Onvif` sur une ICSee dont l'unité s'avère aussi parler ONVIF).

**d) Détection à l'ajout généralisée aux caméras sans marque reconnue.** `ICapabilityProviderRegistry.GetRegisteredProtocols(capability)` expose, pour PTZ/vie privée matérielle/réglages image, la liste des protocoles ayant un provider enregistré (ordre d'enregistrement DI, ONVIF en premier). Une caméra sans `VendorFamily` passe désormais par la même cascade que les marques reconnues, juste construite depuis cette liste au lieu d'un preset — au lieu de ne tenter que PTZ/ONVIF comme avant. Seule différence avec le chemin preset : si aucun protocole ne vérifie, le binding est supprimé plutôt que laissé en échec — un preset a le droit de proposer « à configurer », une caméra non reconnue n'a pas de raison de garder un essai à l'aveugle qui a échoué.

## Conséquences

- ✅ Un choix manuel de protocole n'est plus jamais silencieusement écrasé par un nouveau clic sur « Détecter les capacités »
- ✅ Les marques dont certaines unités parlent plusieurs protocoles (ICSee/ONVIF) bénéficient d'un vrai essai en cascade, sans configuration manuelle nécessaire dans le cas nominal
- ✅ Une caméra non reconnue bénéficie de la même détection automatique (PTZ + réglages image + vie privée matérielle) qu'une marque connue, plus seulement PTZ/ONVIF
- ✅ Migration additive uniquement (`manually_configured INTEGER NOT NULL DEFAULT 0`) — aucune caméra existante affectée (tous les bindings existants restent `ManuallyConfigured = false`, donc toujours éligibles à la cascade/reset comme avant)
- ⚠️ Un binding manuel qui ne fonctionne plus (firmware changé, caméra remplacée) reste bloqué sur son protocole choisi jusqu'à une nouvelle action manuelle de l'utilisateur — c'est le compromis assumé : ne jamais surprendre l'utilisateur plutôt que « deviner » qu'il faut re-essayer un autre protocole à sa place
