# Validation de compatibilite Frigate

## Objectif

Detecter automatiquement toute rupture de contrat utile entre Vyzio et une nouvelle release Frigate avant qu'elle n'arrive en production.

## Strategie recommandee

Utiliser trois niveaux de tests complementaires :

1. **Tests de contrat sur fixtures versionnees**
   Valident les payloads MQTT et REST reellement consommes par Vyzio a partir d'exemples JSON stockes dans le repo.

2. **Tests d'integration Vyzio**
   Valident le flux `Frigate payload -> adaptation -> persistence -> notification` avec SQLite reel et doubles controles sur les bords reseau.

3. **Smoke tests de compatibilite par version Frigate**
   A executer en CI ou pre-release avec un conteneur Frigate cible pour verifier qu'un payload reel de la version candidate reste compatible avec les contrats attendus.

## Ce qui est deja en place

- Fixtures MQTT versionnees sous `src/vyzio/Vyzio.Tests/Contracts/Fixtures/mqtt/`.
- Fixtures REST versionnees sous `src/vyzio/Vyzio.Tests/Contracts/Fixtures/rest/`.
- Tests de contrat sur `FrigateEventContractAdapter` et `FrigateRestClient`.
- Tests d'integration Vyzio sur le flux Frigate -> detection -> notification.

## Workflow pour une nouvelle release Frigate

1. Ajouter un nouveau dossier de fixtures versionne, par exemple `frigate-0.18`.
2. Capturer au minimum :
   - un evenement MQTT `new` pertinent ;
   - un evenement MQTT `update` pertinent ;
   - un payload REST `/api/events/{id}` avec `sub_label` sous forme string ;
   - un payload REST `/api/events/{id}` avec `sub_label` sous forme tableau ou absent.
3. Rejouer la suite de tests.
4. Si un test casse, traiter cela comme une rupture de contrat a analyser avant upgrade.

## Gate CI recommandee

La CI doit au minimum lancer le projet de tests avec les suites :

- `FrigateMqttContractFixtureTests`
- `FrigateRestContractFixtureTests`
- `FrigateNotificationFlowIntegrationTests`

Ces tests doivent rester obligatoires pour toute mise a jour de version Frigate ou de la couche d'integration Vyzio.