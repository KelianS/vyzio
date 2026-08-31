# ADR-06 — Base de données : SQLite

> Statut : Accepté

## Contexte

Vyzio stocke : profils produit, mapping avec les identités Frigate, événements de reconnaissance, règles de notification et sessions.

## Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **SQLite** | Zéro infra, fichier unique, backup simple | Concurrence en écriture limitée |
| PostgreSQL | Robustesse multi-process, scalabilité | Complexité d'installation et d'exploitation plus élevée |
| MariaDB/MySQL | Écosystème large | Surcoût opérationnel non nécessaire en local-first |

## Décision

**SQLite + EF Core** pour tous les déploiements.

```yaml
# vyzio.yml
database:
  connection_string: "Data Source=/data/vyzio.db"
```

- Zéro infrastructure supplémentaire : pas de conteneur dédié, pas de processus séparé
- Sauvegarde triviale : `cp vyzio.db vyzio.db.bak`
- EF Core + `EFCore.NamingConventions` (snake_case) + migrations automatiques au démarrage
- Les données biométriques calculées par Frigate restent dans Frigate ; Vyzio stocke uniquement les métadonnées métier et les références nécessaires à l'orchestration produit
- WAL mode activé pour la concurrence lecture/écriture

## Conséquences

- ✅ Zéro dépendance infra — plug & play sur mini-PC, Raspberry Pi, NAS
- ✅ Sauvegarde triviale (fichier unique)
- ✅ Empreinte RAM minimale
- ⚠️ 1 seul writer concurrent — acceptable : les services Vyzio sont dans le même processus
- ⚠️ Frigate utilise sa propre SQLite indépendante — aucun partage
