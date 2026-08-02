# ADR-18 — Enregistrement continu : activation par caméra dans la config Frigate générée

> Statut : remplacé par [ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md)
> sur la rétention et sur le booléen d'activation par caméra. Le schéma `record.retain.days` /
> `record.retain.mode` décrit ici n'existe plus dans Frigate 0.17. Reste valable : l'enregistrement
> intégral est un choix explicite, et son ordre de grandeur disque doit être annoncé avant activation.

## Contexte

En plus des clips événementiels (court extrait autour d'une détection), Frigate supporte un mode d'enregistrement continu par caméra. Ce mode permet de conserver une vidéo complète sur une durée configurable, utile pour retrouver un événement qui n'a pas déclenché de détection. Ce mode a un impact significatif sur le stockage et doit être opt-in par caméra.

## Configuration Frigate pour les clips événementiels et l'enregistrement continu

```yaml
# Clips événementiels (autour de chaque détection)
record:
  enabled: true
  retain:
    days: 7          # durée de rétention des segments sans événement
    mode: motion     # motion | continuous | active_objects
  events:
    retain:
      default: 14    # durée de rétention des clips liés à un événement

# Par caméra (surcharge la config globale)
cameras:
  front_door:
    record:
      enabled: true   # active l'enregistrement pour cette caméra
```

## Décision

**L'enregistrement continu est activé par caméra via un champ booléen `ContinuousRecordingEnabled` dans `CameraDetectionConfig`, projeté dans la section `record` de `frigate.generated.yml` par le `CameraConfigWriter`.**

La rétention globale des clips est configurée au niveau du fichier Frigate généré via une section `record` globale. L'activation par caméra surcharge cette section.

**Extension du modèle `CameraDetectionConfig` :**

```csharp
public sealed class CameraDetectionConfig
{
    public string CameraId { get; init; } = "";
    public IReadOnlyList<string> ActiveLabels { get; init; } = [];
    public bool ContinuousRecordingEnabled { get; init; } = false;  // nouveau champ
}
```

**Projection dans `CameraConfigWriter` :**

```yaml
cameras:
  {slug}:
    record:
      enabled: {continuousRecordingEnabled}
    objects:
      track:
        - {label}
```

La section `record` globale (rétention) reste gérée par une config par défaut dans `CameraConfigWriter` et sera exposée dans l'UI en US-P3.7 ou une future story.

**Impact stockage estimé :**
- 1 caméra 1080p, H.264, 15fps ≈ 1–3 GB/jour selon la complexité de la scène
- L'UI doit afficher cet ordre de grandeur avant activation pour informer l'utilisateur

## Conséquences

- ✅ Activation par caméra — zéro impact sur les caméras non concernées
- ✅ Projeté via le `CameraConfigWriter` existant — pas de nouveau pipeline
- ✅ Aucune migration EF Core nécessaire si `ContinuousRecordingEnabled` est ajouté à la colonne JSON existante `detection_labels_json` (ou dans une colonne dédiée)
- ⚠️ Activation massive → saturation disque rapide — l'UI doit avertir explicitement avant activation
- ⚠️ La rétention est contrôlée par Frigate, pas par Vyzio directement — la valeur configurée dans `frigate.yml` est la source de vérité
