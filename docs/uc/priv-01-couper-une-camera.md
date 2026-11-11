# UC-PRIV-01 · Couper une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux couper une camera instantanement, afin d'etre certain qu'aucune image de moi ou de mon foyer n'est capturee ni enregistree. **En tant qu'utilisateur**, je veux voir clairement quelle camera est en mode vie privee, afin de savoir a tout moment ce qui surveille et ce qui ne surveille pas. **En tant qu'utilisateur**, je veux que la camera soit vraiment eteinte et pas uniquement silencieuse, afin d'avoir la certitude qu'aucun flux n'est accessible, ni par Frigate, ni par Vyzio, ni par personne d'autre sur le reseau. **En tant qu'utilisateur**, je veux basculer plusieurs cameras en mode vie privee simultanement (ex. "tout eteindre d'un coup"), afin de ne pas devoir repeter l'action camera par camera. **En tant qu'utilisateur**, je veux que mon choix soit maintenu apres un redemarrage du systeme, afin de ne pas devoir reconfigurer la vie privee a chaque fois. |

## Conditions

**Préalables** :

- l'utilisateur est connecté (UC-ACCESS-02).

**Résultat en succès** : la caméra est en mode vie privée (PRIV-01, PRIV-02, PRIV-13), son badge dit ce qu'elle a répondu (PRIV-04), et l'état survit à un redémarrage (PRIV-08).

**Résultats en échec** :

- la caméra n'a pas suivi : l'enregistrement reste coupé, et le badge nomme ce qui n'a pas eu lieu (E1) ;
- Vyzio ne sait pas ce que la caméra a fait (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Couper une caméra | Nominal | L'utilisateur coupe une caméra |
| A1 | Couper plusieurs caméras d'un coup | Alternative | L'utilisateur coupe une sélection, ou toutes les caméras |
| A2 | Reprendre la surveillance | Alternative | L'utilisateur reprend la surveillance d'une caméra coupée |
| A3 | Reprendre la surveillance pendant une plage | Alternative | La caméra est coupée par une plage Vie privée |
| E1 | La caméra ne suit pas | Échec | La caméra refuse, ne répond pas, ou ne peut pas suivre sa stratégie |
| E2 | La demande est interrompue | Échec | La demande s'arrête avant la réponse de la caméra |

## Détail des chemins

### N1 · Couper une caméra

1. L'utilisateur coupe la caméra ; c'est une action, qui prend effet tout de suite (UI-16, PRIV-03).
2. Vyzio arrête l'enregistrement, la détection et les notifications de la caméra (PRIV-01, PRIV-02), et lui demande ce que sa stratégie ajoute (PRIV-10, PRIV-12).
3. Le badge dit ce que la caméra a répondu (PRIV-04) ; sa vignette l'affiche avec les mêmes mots, et la vue en direct ne s'ouvre plus (PRIV-06).

### A1 · Couper plusieurs caméras d'un coup

1. L'utilisateur coupe une sélection de caméras, ou toutes (PRIV-14).
2. Le chemin reprend à N1, pas 2, pour chaque caméra.

### A2 · Reprendre la surveillance

1. L'utilisateur reprend la surveillance de la caméra.
2. Vyzio restaure son flux sans autre intervention (PRIV-09) ; une caméra parquée revient sur sa position Surveillance (PRIV-12).

### A3 · Reprendre la surveillance pendant une plage

1. La caméra est coupée par une plage Vie privée (UC-SCHED-01) ; l'utilisateur reprend sa surveillance.
2. La plage ne la recoupe pas jusqu'à sa fin, et l'écran vie privée dit jusqu'à quand (PRIV-07).

### E1 · La caméra ne suit pas

1. La caméra refuse, ne répond pas, ou ne peut pas suivre sa stratégie.
2. L'enregistrement reste coupé ; le badge, la vignette et l'écran vie privée disent ce qui n'a pas eu lieu et quoi faire (PRIV-05).

### E2 · La demande est interrompue

1. La demande s'arrête avant la réponse de la caméra.
2. L'interface dit que Vyzio ne sait pas ce qu'elle a fait, sans prétendre qu'elle a refusé (PRIV-05).

## Règles locales

- **PRIV-14** · l'interface doit permettre d'activer ou de desactiver le mode vie privee sur plusieurs cameras simultanement (selection multiple ou action globale "tout couper / tout reactiver"), sans reload Frigate separe par camera — un seul rechargement pour l'ensemble de la selection.

## Points ouverts

Aucun.
