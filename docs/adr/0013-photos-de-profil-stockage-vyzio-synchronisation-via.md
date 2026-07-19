# ADR-13 — Photos de profil : stockage Vyzio + synchronisation via API REST Frigate

> Statut : Accepté

## Contexte

La reconnaissance faciale de Frigate (v0.16+) repose sur une bibliothèque de photos de référence organisée par nom de personne. Pour qu'un profil Vyzio génère une reconnaissance, ses photos de référence doivent être présentes dans cette bibliothèque. Trois stratégies d'alimentation ont été évaluées.

## API REST Frigate pour la gestion des faces (v0.16+)

Frigate expose les endpoints suivants pour gérer la bibliothèque de reconnaissance :

```
POST   /api/faces/{name}              → upload d'une photo de référence (multipart/form-data, champ "file")
DELETE /api/faces/{name}/{filename}   → suppression d'une photo de référence spécifique
GET    /api/faces                     → liste toutes les personnes et leurs photos dans la bibliothèque
```

La bibliothèque est physiquement stockée dans le volume Frigate sous `/media/frigate/clips/faces/{name}/`. L'activation de la reconnaissance faciale requiert dans `frigate.yml` :

```yaml
face_recognition:
  enabled: true
  threshold: 0.9    # score minimal pour valider une reconnaissance (0.0–1.0)
  min_area: 10000   # surface minimale du visage détecté en pixels²
```

Lors d'une détection avec reconnaissance réussie, Frigate publie sur MQTT le champ `sub_label` avec le nom de la personne reconnue — déjà consommé par le `FrigateAdapter` Vyzio existant.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Écriture directe dans le volume Frigate** | Vyzio écrit les fichiers photos dans `/media/frigate/clips/faces/{name}/` via un volume Docker partagé | Zéro API, minimal | Couplage fort à la structure interne Frigate ; casse si Frigate change son layout ; photos sous contrôle de Frigate, pas de Vyzio |
| **B — API REST Frigate uniquement** | Vyzio transmet la photo à Frigate via `POST /api/faces/{name}` sans en garder de copie | Simple, découplé | Si Frigate est réinitialisé ou recréé, les photos sont perdues ; pas de source de vérité côté Vyzio |
| **C — Stockage canonique Vyzio + sync via API REST** | Vyzio conserve une copie canonique dans `/data/vyzio/faces/{profile_id}/` et synchronise vers Frigate via `POST /api/faces/{name}` à chaque ajout, retrait ou renommage | Vyzio est source de vérité ; re-sync possible après reset Frigate ; photos sont données utilisateur sous contrôle Vyzio | Deux copies stockées (volume Vyzio + volume Frigate) |

## Décision

**Option C retenue : stockage canonique Vyzio + synchronisation via API REST Frigate.**

Les photos sont des données utilisateur sensibles. Elles doivent rester sous le contrôle de Vyzio, pas dépendre de la stabilité du volume Frigate. Le `FrigateRestClient` existant est étendu avec les opérations de gestion de bibliothèque. Un use case de re-synchronisation (`ResyncFaceLibraryUseCase`) peut reconstruire l'état Frigate complet depuis les photos Vyzio à tout moment.

**Modèle de stockage local Vyzio :**

```
/data/vyzio/
  faces/
    {profile_id}/
      {photo_id}.jpg     ← copie canonique Vyzio
```

**Contrat `IFrigateRestClient` étendu :**

```csharp
// Ajouts à l'interface existante
Task UploadFacePhotoAsync(string personName, string filename, byte[] imageJpeg, CancellationToken ct = default);
Task DeleteFacePhotoAsync(string personName, string filename, CancellationToken ct = default);
Task<IReadOnlyList<FrigateFaceLibraryEntry>> GetFaceLibraryAsync(CancellationToken ct = default);
```

**Modèle de données côté Vyzio :**

```sql
CREATE TABLE profile_photos (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,                  -- nom canonique dans /data/vyzio/faces/{profile_id}/
    frigate_synced  INTEGER NOT NULL DEFAULT 0,     -- 1 si la photo est présente dans la bibliothèque Frigate
    synced_at       TEXT,
    created_at      TEXT NOT NULL
);
```

**Règle de nommage dans Frigate :** le `personName` transmis à Frigate est le `Profile.Name` (nom affiché). En cas de renommage de profil, une re-sync supprime les photos de l'ancien nom et les réenvoie sous le nouveau nom.

**Activation de la reconnaissance dans `frigate.yml` :** la section `face_recognition` est ajoutée par le `CameraConfigWriter` dès qu'au moins un profil dispose de photos synchronisées.

## Conséquences

- ✅ Les photos restent sous contrôle de Vyzio — données utilisateur, supprimables intégralement depuis Vyzio
- ✅ Re-synchronisation possible après reset ou recréation du conteneur Frigate
- ✅ Couplage limité à l'API REST Frigate, pas à sa structure de fichiers interne
- ✅ Le statut `frigate_synced` permet d'afficher dans l'UI si une photo est effective dans la reconnaissance
- ⚠️ Deux copies des photos stockées — volume Vyzio + volume Frigate ; acceptable au vu du volume de données (photos de profil, pas de clips vidéo)
- ⚠️ Le renommage d'un profil déclenche une re-sync complète côté Frigate — à traiter dans `UpdateProfileUseCase`
