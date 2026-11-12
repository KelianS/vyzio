# UC-NOTIF-02 · Configurer un canal de notification

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux configurer mes destinations de notification depuis l'interface, afin de ne jamais modifier un fichier a la main. **En tant qu'utilisateur**, je veux etre guide pour configurer un canal, tester l'envoi et comprendre les compromis du canal choisi. **En tant qu'utilisateur**, je veux que mes images ne quittent pas mon reseau sans mon accord explicite. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02).

**Résultat en succès** : le canal est configuré, vérifié et testé depuis l'interface (NOTIF-16, NOTIF-17), ses réglages persistants (NOTIF-06).

**Résultats en échec** : la vérification échoue, le canal reste non configuré, et l'erreur se lit à deux niveaux (E1).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Configurer et tester un canal | Nominal | Le propriétaire choisit un canal à configurer |
| A1 | Activer un canal qui dépend d'un service externe | Alternative | Le canal a besoin d'une dépendance réseau externe |
| A2 | Activer un canal qui ne sait pas recevoir | Alternative | Le canal ne reçoit pas de commandes |
| E1 | La vérification du canal échoue | Échec | Ce que le canal demande est refusé ou injoignable |

## Détail des chemins

### N1 · Configurer et tester un canal

1. Le propriétaire choisit un canal ; l'écran est le même pour tous les canaux (NOTIF-05), et dit ses capacités et ses limites avant l'activation (NOTIF-18).
2. Il saisit ce que le canal demande ; Vyzio le vérifie et dit s'il est configuré (NOTIF-17).
3. Il envoie un test, puis active le canal (NOTIF-16).

### A1 · Activer un canal qui dépend d'un service externe

1. Le canal a besoin d'une dépendance réseau externe : l'interface le dit, et le propriétaire l'accepte explicitement (NOTIF-04, SEC-01).
2. Le chemin reprend à N1, pas 2.

### A2 · Activer un canal qui ne sait pas recevoir

1. L'interface dit, avant l'activation, que ce canal ne recevra pas de commandes (NOTIF-19).
2. Le chemin reprend à N1, pas 2.

### E1 · La vérification du canal échoue

1. Ce que le canal demande est refusé ou injoignable.
2. Le canal reste non configuré (NOTIF-17), et l'erreur se lit à deux niveaux (UI-01).

## Règles locales

- **NOTIF-16** · la configuration des canaux retenus doit etre lisible, modifiable et testable depuis l'interface Vyzio ;
- **NOTIF-17** · chaque canal propose doit etre couvert de bout en bout : saisie de ce qu'il demande, verification, etat configure / non configure, test d'envoi ;
- **NOTIF-18** · les capacites et limites d'un canal doivent etre explicites dans l'interface avant activation ;
- **NOTIF-19** · un canal qui ne sait pas recevoir reste un canal de notification a part entiere ; l'interface doit le dire avant l'activation, et ne jamais laisser croire qu'on pourra lui parler.

## Points ouverts

Aucun.
