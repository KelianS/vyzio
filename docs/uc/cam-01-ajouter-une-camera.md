# UC-CAM-01 · Ajouter une caméra

| Champ | Valeur |
| --- | --- |
| **Acteur** | Le propriétaire |
| **Objectif** | **En tant qu'utilisateur**, je veux que Vyzio m'aide a connecter mes cameras sans devoir connaitre leur configuration reseau. **En tant qu'utilisateur**, je veux que Vyzio distingue mes cameras des autres appareils du reseau et m'explique quoi activer, afin de finir l'integration sans connaissance technique du constructeur. **En tant qu'utilisateur**, je veux trouver pendant l'ajout ce que la marque de ma camera demande de preparer dans son application, afin de ne pas chercher la notice ailleurs. **En tant qu'utilisateur**, je veux pouvoir integrer une camera qui ne supporte pas le RTSP nativement (ex. camera sur batterie ICSee/XMEye), afin de ne pas etre bloque par les limitations du protocole du fabricant. |

## Conditions

**Préalables** :

- le propriétaire est connecté (UC-ACCESS-02) ;
- la caméra est branchée sur le réseau de la maison.

**Résultat en succès** : la caméra est créée, sa page est ouverte sur « Connexion », et elle entre en surveillance une fois son flux fonctionnel et les changements appliqués.

**Résultats en échec** :

- le candidat reste à préparer : aucune caméra n'est créée, le candidat reste visible avec ce qu'il faut préparer (E1) ;
- la caméra est créée mais reste « À configurer » tant que son flux ne fonctionne pas (E2).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Ajouter une caméra découverte | Nominal | L'utilisateur ouvre l'ajout d'une caméra |
| A1 | Saisir l'adresse à la main | Alternative | La caméra n'est pas dans la liste des candidats |
| A2 | Préparer la caméra dans l'application de sa marque | Alternative | Le candidat choisi est à préparer |
| A3 | Lire la notice d'une marque | Alternative | L'utilisateur choisit une marque dans la liste |
| A4 | Ajouter une caméra dont le protocole natif n'est pas RTSP | Alternative | Le flux du candidat ne passe que par un protocole propriétaire |
| E1 | Le candidat reste à préparer | Échec | Après « Réessayer », aucun protocole ne porte encore son flux |
| E2 | Le flux ne fonctionne pas encore | Échec | La caméra est créée mais son flux n'a jamais fonctionné |

## Détail des chemins

### N1 · Ajouter une caméra découverte

1. L'utilisateur ouvre l'ajout d'une caméra (CAM-39) et lance la recherche ; la confirmation dit quelles plages d'adresses seront interrogées, et d'où vient chacune (CAM-29).
2. Vyzio liste les candidats, chacun avec son libellé de confiance et les signaux observés (CAM-30, CAM-31, CAM-32, CAM-34).
3. L'utilisateur choisit un candidat prêt (CAM-37), saisit son nom et son compte, puis confirme.
4. Vyzio crée la caméra de ce seul accès (CAM-39, CAM-26) et ouvre sa page sur « Connexion » (CAM-40, CAM-03).
5. La page lance « Détecter automatiquement » et dit ce qui répond (UC-CAM-02).
6. L'utilisateur règle ce qu'il veut ; le reste garde ses valeurs par défaut (CAM-06).
7. Le flux fonctionnant, l'utilisateur applique les changements (UI-13) : la caméra entre en surveillance (CAM-05).

### A1 · Saisir l'adresse à la main

1. La caméra n'est pas dans la liste, par exemple hors des plages balayées (CAM-29, CAM-41).
2. L'utilisateur saisit son adresse, son nom et son compte, puis confirme.
3. Le chemin reprend à N1, pas 4.

### A2 · Préparer la caméra dans l'application de sa marque

1. Le candidat choisi est à préparer (CAM-37, CAM-33).
2. L'ajout garde l'étape qui dit quoi préparer : la notice de la marque (CAM-35, CAM-38) et « Réessayer ».
3. L'utilisateur prépare la caméra dans l'application de sa marque, puis choisit « Réessayer ».
4. Le candidat est prêt : le chemin reprend à N1, pas 3.

### A3 · Lire la notice d'une marque

1. L'utilisateur choisit une marque dans la liste de l'écran d'ajout, pour un candidat à préparer comme pour une adresse saisie (CAM-38).
2. Vyzio affiche sa notice, et rien d'autre ; le chemin reprend là où il était.

### A4 · Ajouter une caméra dont le protocole natif n'est pas RTSP

1. Le flux du candidat ne passe que par un protocole propriétaire (CAM-36).
2. Le candidat est présenté prêt (CAM-37) et suit le même parcours que N1 (CAM-18).

### E1 · Le candidat reste à préparer

1. Après « Réessayer », aucun protocole ne porte encore le flux du candidat (CAM-37).
2. L'étape qui dit quoi préparer reste affichée, et le candidat reste visible (CAM-33).

### E2 · Le flux ne fonctionne pas encore

1. La caméra est créée, mais son flux n'a jamais fonctionné.
2. Elle reste « À configurer » partout où son état s'affiche (CAM-04), et « Appliquer les changements » dit ce qui reste à faire (CAM-05) ; sa carte du flux vidéo dit comment en sortir (CAM-24).

## Règles locales

- **CAM-29** · la decouverte balaie les plages d'adresses configurees par defaut, plus le /24 de l'adresse IPv4 privee par laquelle le tableau de bord est ouvert (un tableau de bord ouvert par un nom, localhost, une adresse IPv6 ou celle de l'acces a distance n'ajoute rien) ; la confirmation qui precede la recherche previent que chaque adresse des plages qui seront balayees va etre interrogee, et liste ces plages et d'ou vient chacune (plages configurees, adresse du tableau de bord) ; l'ecran d'ajout ne les reaffiche pas apres la recherche ; les plages ne s'y modifient pas : une camera hors de ces plages s'ajoute en saisissant son adresse ;
- **CAM-30** · la decouverte reseau doit distinguer au minimum une camera confirmee, une camera probable et un equipement non qualifie ;
- **CAM-31** · chaque candidat detecte doit exposer au minimum un libelle de confiance compréhensible et une explication courte des signaux observes ; sa marque ne s'affiche, en texte, que lorsqu'un signal tres sur la designe (une reponse que seul le protocole proprietaire de cette marque donne), jamais devinee d'un port ouvert, d'un nom d'hote ou d'une page web, et aucun candidat ne porte de pastille de marque, connue ou inconnue ;
- **CAM-32** · le niveau de confiance doit rester explicable : Vyzio ne doit pas afficher une precision arbitraire ou un score opaque sans justification lisible ;
- **CAM-33** · une camera detectee mais non encore exploitable doit rester visible dans un parcours d'assistance plutot que disparaitre silencieusement ;
- **CAM-34** · une camera confirmee doit etre clairement distinguable d'un simple equipement reseau joignable, afin d'eviter les faux positifs dans le parcours d'ajout ;
- **CAM-35** · le produit doit guider l'utilisateur quand RTSP ou ONVIF doivent etre actives, avec la notice du constructeur (CAM-38) ;
- **CAM-36** · pour les cameras dont le protocole natif n'est pas RTSP, le systeme doit proposer un mode d'integration alternatif transparent pour l'utilisateur, sans exiger de manipulation technique manuelle ;
- **CAM-37** · un candidat de la decouverte est presente comme pret des que son flux video est joignable par l'un des protocoles qui savent le porter (RTSP ou un protocole proprietaire), et son ajout ne reprend que son adresse, la detection de sa page retrouvant le reste ; il reste a preparer seulement quand aucun ne le permet, et l'ajout garde alors l'etape qui dit quoi preparer (notice du constructeur, « Réessayer ») ;
- **CAM-38** · l'ecran d'ajout propose la liste des marques dont Vyzio a une notice, pour un candidat a preparer comme pour une adresse saisie a la main, parce que ce que demande la marque (ex. creer le compte de la camera dans son application) vient avant l'ajout ; choisir une marque affiche sa notice, et rien d'autre : ce choix n'est pas enregistre et ne change ni la detection ni les capacites ; quand un signal tres sur designe la marque, sa notice est choisie d'office ; sinon la liste reste sur « Autre marque », qui affiche une aide generale courte (ouvrir l'application de la camera, y creer un compte pour Vyzio, activer la video locale si elle le propose) ; la marque n'est jamais un choix a faire pour ajouter la camera ;
- **CAM-39** · l'ajout d'une camera tient en un ecran simple : la decouverte reseau et l'acces (nom, adresse, compte) ; choisir une camera decouverte ou saisir son adresse, puis confirmer, cree la camera de ce seul acces, sans port, protocole, chemin, flux ni marque a choisir, et sans verification prealable (voir [ADR-04](../adr/0004-the-camera-model.md)) ;
- **CAM-40** · l'ajout mene aussitot sur la page de la camera, ouverte sur sa connexion : c'est la que se regle une nouvelle camera, avec les memes ecrans que pour toute camera, sans assistant a part ; a l'arrivee, la page lance « Détecter automatiquement » si la camera n'a jamais ete detectee, et dit ce qui repond ;
- **CAM-41** · la detection automatique est souhaitee quand elle est possible, avec une saisie manuelle en secours ;
- **CAM-60** · le detail technique d'un candidat liste chaque port ouvert trouve ; un port ne porte le nom d'un protocole que si la camera l'a confirme sans compte, sinon il se lit « non identifie » : un port ouvert ne nomme jamais un protocole a lui seul.

## Points ouverts

Aucun.
