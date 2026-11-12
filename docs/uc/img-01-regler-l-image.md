# UC-IMG-01 · Régler l'image d'une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux ajuster la luminosite, le contraste et la vision nocturne (IR) de mes cameras directement depuis Vyzio, afin de ne pas devoir ouvrir l'application du constructeur pour un simple reglage image. **En tant qu'utilisateur**, je veux que ce reglage soit une capacite testee comme les autres (PTZ, vie privee materielle), afin de ne pas me proposer un controle qui ne fonctionnera pas sur ma camera. |

## Conditions

**Préalables** :

- la capacité de réglages image de la caméra est vérifiée (IMG-01, IMG-03).

**Résultat en succès** : la caméra a pris la nouvelle valeur, relue sur elle (IMG-02).

**Résultats en échec** :

- le panneau n'apparaît pas (E1) ;
- le panneau est suspendu, avec un message explicite (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Régler un paramètre de l'image | Nominal | L'utilisateur change la luminosité, le contraste, la saturation ou la netteté |
| A1 | Régler la vision nocturne | Alternative | L'utilisateur change le mode de vision nocturne |
| E1 | La capacité n'est pas vérifiée | Échec | La capacité de réglages image n'est pas vérifiée |
| E2 | La caméra est hors ligne | Échec | La caméra cesse de répondre |

## Détail des chemins

### N1 · Régler un paramètre de l'image

1. L'utilisateur ouvre l'onglet « Image et pilotage » de la caméra (CAM-03) ; Vyzio y affiche les valeurs lues sur la caméra (IMG-02).
2. L'utilisateur change une valeur ; Vyzio l'écrit sur la caméra (IMG-02).

### A1 · Régler la vision nocturne

1. L'utilisateur choisit l'un des états de la vision nocturne (IMG-04) ; le chemin reprend à N1, pas 2.

### E1 · La capacité n'est pas vérifiée

1. Le panneau de contrôle ne s'affiche pas, quelle que soit la marque (IMG-03) ; la carte de la capacité dit comment en sortir (CAM-24).

### E2 · La caméra est hors ligne

1. Le panneau de réglages image est suspendu, avec un message explicite (CAM-08).

## Règles locales

- **IMG-01** · les reglages image (luminosite, contraste, saturation, nettete, mode vision nocturne infrarouge) sont une **capacite** au sens du catalogue (CAM-10, CAM-13) : independante de la marque, testee reellement avant d'etre proposee, jamais activee sur simple declaration ;
- **IMG-02** · les valeurs affichees et modifiables sont lues et ecrites en direct sur la camera — Vyzio ne stocke pas de copie locale des reglages, la camera reste la source de verite ;
- **IMG-03** · une camera dont la capacite reglages image n'est pas verifiee ne doit pas afficher le panneau de controle, quelle que soit sa marque ;
- **IMG-04** · le mode vision nocturne expose au minimum trois etats comprehensibles pour un non-technicien : automatique, force actif, force inactif.

## Points ouverts

Aucun.
