# ADR-31 — Override manuel du constructeur à l'onboarding

> Statut : Accepté
> Fonctionnement détaillé : [`../design/camera-discovery.md`](../design/camera-discovery.md).

## Contexte

La reconnaissance automatique du constructeur à la découverte (protocoles confirmés, OUI MAC, hostname — ADR-32) reste faillible par nature (§ 2.2/2.3 SPECS). L'utilisateur doit pouvoir corriger ou court-circuiter une détection ratée sans repasser par la déclaration capacité-par-capacité de l'ADR-22, réservée à une marque réellement inconnue de Vyzio.

## Décision

Le formulaire d'ajout/édition (`CameraOnboardingView.tsx`) expose un sélecteur de marque optionnel (`v380_pro` / `tplink_tapo` / `icsee` / aucune) qui alimente le champ `vendorFamily` du contrat `CreateCameraRequest`/`UpdateCameraRequest`. `SeedAndProbePresetsUseCase` (ADR-28) utilise ce champ pour emprunter le chemin preset plutôt que la détection à l'aveugle. Le champ étant déjà câblé de bout en bout, seule la surface UI est ajoutée — aucun endpoint ni logique métier supplémentaire.

Le sélecteur est **toujours éditable**, y compris quand aucune détection n'a abouti (caméra pas encore prête, flux non détecté) : c'est le recours direct pour corriger une reconnaissance automatique erronée.

## Conséquences

- ✅ L'utilisateur corrige une reconnaissance ratée en un clic ; la déclaration capacité-par-capacité (ADR-22) reste le recours pour une marque non répertoriée
- ✅ Aucun changement de contrat API ni de modèle de données — le champ existait déjà, seule l'UI manquait
