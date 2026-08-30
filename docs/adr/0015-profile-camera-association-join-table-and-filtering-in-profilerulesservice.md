# ADR-15 — Association profil-caméra : table de jointure + filtrage dans ProfileRulesService

> Statut : Accepté

## Contexte

L'utilisateur veut pouvoir restreindre la reconnaissance à des profils spécifiques par caméra : "reconnaître Alice et Bob uniquement sur la caméra de la porte d'entrée, pas sur la caméra du jardin". Cela implique de modéliser une association N×M entre profils et caméras, et de décider où et comment ce filtre s'applique dans l'architecture.

## Point clé : la reconnaissance Frigate est globale

La bibliothèque de reconnaissance faciale de Frigate est **globale** — elle ne supporte pas de restriction par caméra. Si Alice est dans la bibliothèque, Frigate peut la reconnaître sur n'importe quelle caméra. La restriction par caméra est donc nécessairement une **règle métier Vyzio**, appliquée après réception de l'événement enrichi, pas dans la configuration Frigate.

## Options comparées

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A — Table de jointure `profile_camera_links`** | Table many-to-many explicite avec `profile_id`, `camera_id`, `enabled` | Requêtable, extensible (futurs attributs par lien), source de vérité claire | Migration + entité supplémentaire |
| **B — JSON sur Camera** | Colonne `recognized_profile_ids_json` sur `cameras` | Un seul endroit à lire pour construire la config | Difficile de requêter "sur quelles caméras est Alice ?", JSON en base côté caméra |
| **C — JSON sur Profile** | Colonne `linked_camera_ids_json` sur `profiles` | Symétrique à l'option B | Même limitation que B, sens inversé |
| **D — Aucune association Vyzio — toujours reconnaître sur toutes les caméras** | La bibliothèque Frigate contient tous les profils, pas de filtre Vyzio | Zéro complexité | Ne répond pas au besoin produit ; risque de faux positifs sur des caméras non pertinentes |

## Décision

**Option A retenue : table de jointure `profile_camera_links` + filtrage dans `ProfileRulesService`.**

La table de jointure est la représentation naturelle d'une relation many-to-many avec état (`enabled`). Elle permet de répondre proprement aux deux sens de la requête ("quels profils sur cette caméra ?" et "sur quelles caméras ce profil ?"). Le filtrage est appliqué dans `ProfileRulesService` lors de la résolution des règles : un événement enrichi avec un `sub_label` Frigate n'est mappé vers un profil Vyzio que si le lien profil-caméra correspondant est actif.

**Modèle de données :**

```sql
CREATE TABLE profile_camera_links (
    id          TEXT PRIMARY KEY,
    profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    camera_id   TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    UNIQUE (profile_id, camera_id)
);
CREATE INDEX idx_pcl_camera ON profile_camera_links(camera_id, enabled);
CREATE INDEX idx_pcl_profile ON profile_camera_links(profile_id, enabled);
```

**Comportement par défaut :** un profil sans aucun lien défini est reconnaissable sur **toutes** les caméras (`null` associations = pas de restriction). Ce comportement est intentionnel pour minimiser la friction lors de la création d'un premier profil. L'utilisateur peut affiner en ajoutant des liens explicites.

**Règle de résolution dans `ProfileRulesService` :**

```
sub_label Frigate reçu sur caméra X
  → chercher un profil Vyzio dont le Name correspond au sub_label
  → vérifier si ce profil a des liens actifs définis
    → s'il n'en a pas : reconnaissance valide sur toutes les caméras
    → s'il en a : reconnaissance valide seulement si un lien actif existe pour la caméra X
  → si valide : mapper l'événement vers le profil, appliquer les règles d'alerte
  → si invalide : conserver l'identité Frigate brute sans mapper vers un profil Vyzio
```

**Impact sur la bibliothèque Frigate :** aucun. La bibliothèque Frigate contient toujours les photos de tous les profils. Le filtrage est exclusivement applicatif côté Vyzio.

## Conséquences

- ✅ Requêtes propres dans les deux sens (par profil, par caméra)
- ✅ `enabled` permet de désactiver temporairement un lien sans supprimer l'association
- ✅ Compatible avec le comportement par défaut "reconnaître partout" — pas de friction à la création
- ✅ Extensible : on peut ajouter un `alert_override` par lien sans changer la structure globale
- ⚠️ Le `ProfileRulesService` doit charger les liens actifs par caméra lors de chaque évaluation — à mettre en cache court (TTL ~30s) pour éviter une requête SQLite par événement
- ⚠️ La suppression d'une caméra ou d'un profil doit supprimer les liens en cascade (`ON DELETE CASCADE` dans le schéma)
