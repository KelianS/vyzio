# ADR-04 — Communication Frigate → Vyzio : MQTT + API REST Frigate

> Statut : Accepté

## Contexte

Frigate publie nativement ses événements de détection et d'enrichissement sur MQTT et expose une API REST. Vyzio doit consommer ces événements pour appliquer ses règles métier, persister les événements utiles et déclencher les notifications.

## Topics MQTT Frigate utilisés

```
frigate/events            → Création/mise à jour d'une détection (person, car, etc.)
frigate/{camera}/motion   → État du mouvement (true/false)
frigate/stats             → Santé système Frigate
```

## Contrat d'entree Frigate retenu

Vyzio retient un **contrat d'entree volontairement borne** par rapport a l'ensemble des topics et champs Frigate disponibles. Le but est de limiter le couplage aux donnees necessaires a la solution cible retenue.

**Topic consomme dans l'architecture cible actuelle :**

- `frigate/events`

**Topics non consommes par Vyzio dans l'architecture cible actuelle :**

- `frigate/{camera}/motion` : utile pour du contexte, mais non requis par la solution retenue ;
- `frigate/stats` : reserve a l'observabilite et a l'administration, pas au flux metier Vyzio ;
- tout autre topic Frigate non documente dans le present contrat.

**Regles de filtrage cote Vyzio :**

- Vyzio ne consomme que les messages `frigate/events` possedant un objet `after` exploitable ;
- Vyzio applique un filtre configurable par l'utilisateur sur `after.label` pour determiner quels types de detection entrent dans le flux metier nominal ;
- la solution cible doit permettre au minimum d'activer ou desactiver des categories telles que `person`, `car`, `dog`, `cat` selon les capacites exposees par Frigate ;
- les champs inconnus sont ignores par le `FrigateAdapter` tant qu'un besoin n'a pas ete valide dans les SPECS/SAD.

**Champs Frigate requis pour entrer dans le domaine Vyzio :**

| Champ | Statut | Usage Vyzio |
|---|---|---|
| `type` | requis | cycle de vie Frigate (`new`, `update`, `end`) |
| `after.id` | requis | identifiant externe stable Frigate |
| `after.camera` | requis | nom logique de camera |
| `after.label` | requis | type de detection Frigate soumis au filtrage configurable Vyzio |
| `after.start_time` | requis | horodatage de debut de detection |

**Champs Frigate optionnels retenus :**

| Champ | Statut | Usage Vyzio |
|---|---|---|
| `after.sub_label` | optionnel | identite enrichie par Frigate si disponible |
| `after.score` | optionnel | score de detection |
| `after.top_score` | optionnel | fallback si `score` n'est pas present |
| `after.end_time` | optionnel | fin de detection |
| `after.has_clip` | optionnel | autorise ensuite un proxy clip |
| `after.has_snapshot` | optionnel | autorise ensuite un proxy snapshot/thumbnail |

**Ressources REST Frigate autorisees en complement :**

- `GET /api/events/{id}` pour completer un evenement deja connu ;
- `GET /api/events/{id}/thumbnail.jpg` ou ressource equivalente exposee par Frigate pour l'image ;
- `GET /api/events/{id}/clip.mp4` ou ressource equivalente exposee par Frigate pour le clip.

Vyzio ne persiste pas le payload Frigate brut en entier. Il conserve uniquement les champs utiles a ses regles, a ses notifications et a son exposition API.

**Evenement interne minimal publie par le `FrigateAdapter` :**

```json
{
  "source": "frigate",
  "frigate_event_id": "1715000000.123-abc",
  "lifecycle": "new",
  "camera": "front_door",
  "label": "dog",
  "identity": null,
  "confidence": 0.92,
  "occurred_at": "2024-05-06T12:13:20Z",
  "has_clip": true,
  "has_snapshot": true
}
```

**Regles de normalisation minimales :**

- `frigate_event_id` ← `after.id`
- `camera` ← `after.camera`
- `label` ← `after.label`
- `identity` ← `after.sub_label` si present, sinon `null`
- `confidence` ← `after.score`, sinon `after.top_score`, sinon `null`
- `occurred_at` ← `after.start_time` par defaut ; `after.end_time` peut etre retenu pour un message `end` s'il est present
- `has_clip` ← `after.has_clip ?? false`
- `has_snapshot` ← `after.has_snapshot ?? false`

**Consequences d'architecture :**

- le flux metier nominal repose sur un sous-ensemble configurable des labels Frigate, pilote par les preferences utilisateur ;
- le schema Vyzio n'a pas a modeliser tout le payload MQTT Frigate ;
- les futurs tests d'integration devront verifier ce contrat minimal plutot qu'un reflet integral des messages Frigate.

Exemple de payload `frigate/events` :
```json
{
  "type": "new",
  "after": {
    "id": "1715000000.123-abc",
    "camera": "front_door",
    "label": "person",
    "score": 0.92,
    "thumbnail": "/api/events/1715000000.123-abc/thumbnail.jpg",
    "has_clip": true,
    "start_time": 1715000000.123
  }
}
```

## Décision

- **MQTT** (broker Mosquitto dédié sur le réseau Docker interne) pour les événements temps réel
- **API REST Frigate** pour : thumbnails, clips, configuration caméras, flux live HLS

Le `FrigateAdapter` est le **seul composant d'infrastructure couplé à Frigate**. Il traduit les événements Frigate en événements du domaine Vyzio et les publie sur les topics MQTT Vyzio. Le reste des composants consomme uniquement les événements normalisés Vyzio.

```csharp
// Seul composant couplé à Frigate
public class FrigateAdapter : IHostedService
{
    // Souscrit MQTT frigate/events
  // Transforme FrigateEvent → DetectionEnrichedEvent (domaine Vyzio)
  // Publie via un bus d'événements Vyzio (MQTT)
}
```

## Conséquences

- ✅ Couplage limité à une seule classe — migration vers autre backend vidéo possible
- ✅ Broker MQTT dédié, explicite et réutilisable par Frigate puis Vyzio
- ⚠️ Format MQTT Frigate peut évoluer — versionner le `FrigateAdapter`
