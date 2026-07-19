# ADR-14 — Labels de détection par caméra : colonne JSON sur Camera

> Statut : Accepté

## Contexte

Chaque caméra doit pouvoir détecter un sous-ensemble des labels Frigate (`person`, `car`, `dog`, `cat`, etc.). Cette configuration est projetée dans la section `objects.track` de chaque caméra dans `frigate.yml`. L'entité `Camera` possède déjà un champ `DetectionPreset` (valeur `"person_default"`) qui n'est pas encore utilisé dans la génération de config.

## Frigate : structure de configuration des objets détectés

```yaml
cameras:
  front_door:
    objects:
      track:
        - person
        - dog
```

Sans cette section, Frigate utilise les objets définis au niveau global (par défaut `person` uniquement). La liste des labels disponibles dépend du modèle IA configuré dans Frigate — les labels courants sont : `person`, `car`, `motorcycle`, `bicycle`, `dog`, `cat`, `bird`, `deer`, `face`.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Valeurs de preset** | Étendre `DetectionPreset` avec des chaînes prédéfinies (`person_only`, `all_animals`, `full`) | Zéro migration, simple | Rigide ; combinaisons impossibles ; mapping preset → labels doit vivre quelque part |
| **B — Table `CameraDetectionConfig`** | Entité dédiée avec une ligne par label activé par caméra | Requêtes propres, extensible | Join supplémentaire pour la génération de config ; surcoût pour un besoin simple |
| **C — Colonne JSON `detection_labels_json` sur Camera** | Stocker la liste des labels actifs comme JSON sur la table `cameras` | Simple, flexible, pas de join pour la génération | JSON en base moins requêtable — acceptable car aucune query ne filtre sur les labels individuels |

## Décision

**Option C retenue : colonne JSON `detection_labels_json` sur l'entité `Camera`.**

Le besoin est simple : stocker et lire une liste de chaînes par caméra. Aucune query ne filtre sur un label individuel — la liste est lue en bloc pour la génération de `frigate.yml`. Une table dédiée ajouterait de la complexité sans bénéfice ici. Le champ `DetectionPreset` existant est **remplacé** par `DetectionLabelsJson`.

**Modification de l'entité `Camera` :**

```csharp
// Remplace DetectionPreset
/// <summary>JSON array of active detection labels. Null defaults to ["person"].</summary>
[MaxLength(500)]
public string? DetectionLabelsJson { get; set; }

// Helper (non mappé EF)
public IReadOnlyList<string> GetDetectionLabels() =>
    DetectionLabelsJson is not null
        ? JsonSerializer.Deserialize<List<string>>(DetectionLabelsJson) ?? _defaultLabels
        : _defaultLabels;

private static readonly IReadOnlyList<string> _defaultLabels = ["person"];
```

**Projection dans `FrigateConfigApplier` :**

```csharp
Objects = new FrigateObjectsConfig
{
    Track = camera.GetDetectionLabels().ToList()
},
```

**Labels valides reconnus par Vyzio (liste ouverte, extensible) :**

| Label Frigate | Libellé UI |
|---|---|
| `person` | Personne |
| `face` | Visage |
| `car` | Voiture |
| `motorcycle` | Moto |
| `bicycle` | Vélo |
| `dog` | Chien |
| `cat` | Chat |
| `bird` | Oiseau |
| `deer` | Cerf |

La validation des labels fournis par l'UI se fait dans le use case (`SaveCameraDetectionConfigUseCase`) en comparant à une liste de référence maintenue dans `Core`. Les labels inconnus sont rejetés avec un message explicite.

## Conséquences

- ✅ Migration minimale — une colonne ajoutée sur la table `cameras` existante
- ✅ Génération de config Frigate directe — pas de join, lecture en bloc
- ✅ La valeur `null` correspond au comportement par défaut (`["person"]`) — compatibilité avec les caméras existantes sans migration de données
- ⚠️ `DetectionPreset` est retiré — les caméras existantes ayant `person_default` seront migrées vers `detection_labels_json = null` (comportement équivalent)
- ⚠️ Un reload Frigate est déclenché dès qu'un label change — à traiter dans `SaveCameraDetectionConfigUseCase` via le `CameraConfigWriter` + `ApplyCommand` existants
