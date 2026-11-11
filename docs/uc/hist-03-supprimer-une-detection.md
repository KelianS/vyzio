# UC-HIST-03 · Supprimer une détection

| Champ | Valeur |
| --- | --- |
| **Acteur** | L'utilisateur ; ACCESS-01 dit ce que peut le résident |
| **Objectif** | **En tant qu'utilisateur**, je veux supprimer une detection de l'historique, avec sa video, afin de ne pas garder chez moi une scene que je ne veux pas conserver. |

## Conditions

**Préalables** :

- l'aperçu de la détection est ouvert dans l'historique (UC-HIST-01).

**Résultat en succès** : la détection et la vidéo de son passage ont disparu de tout Vyzio (HIST-10).

**Résultats en échec** :

- la détection reste, et l'utilisateur est invité à réessayer plus tard (E1) ;
- rien n'est effacé, ou l'effacement n'est que partiel, et la détection reste pour finir le travail (E3).

## Chemins

| ID | Libellé | Type | Déclencheur |
| --- | --- | --- | --- |
| N1 | Supprimer une détection | Nominal | L'utilisateur supprime la détection depuis son aperçu |
| A1 | Une autre détection du même passage perd sa vidéo | Alternative | Le passage effacé contient une autre détection |
| E1 | L'enregistrement du passage est en cours | Échec | Le passage de la détection s'enregistre encore |
| E2 | La détection n'existe plus | Échec | La détection a déjà disparu |
| E3 | La surveillance refuse ou ne répond pas | Échec | L'effacement échoue en tout ou en partie |

## Détail des chemins

### N1 · Supprimer une détection

1. L'utilisateur supprime la détection depuis son aperçu ouvert dans l'historique.
2. Une confirmation courte dit que la détection et sa vidéo seront effacées (HIST-10, UI-19).
3. Vyzio efface la détection et l'enregistrement de son passage (HIST-10) ; elle quitte le calcul du **Silence** (HIST-12), et ce qui reste sur le disque est dit par HIST-15.

### A1 · Une autre détection du même passage perd sa vidéo

1. Le passage effacé contient une autre détection : elle reste dans l'historique avec son aperçu, sans sa vidéo (HIST-10).
2. Son lecteur dit que la vidéo de ce moment a été supprimée (HIST-11).

### E1 · L'enregistrement du passage est en cours

1. Le passage de la détection s'enregistre encore : elle ne se supprime pas, et l'écran invite l'utilisateur à réessayer plus tard (HIST-13).

### E2 · La détection n'existe plus

1. La détection le dit, et quitte la liste (HIST-13).

### E3 · La surveillance refuse ou ne répond pas

1. Vyzio ne retire rien de son côté ; l'erreur dit si rien n'a été effacé ou si l'effacement n'est que partiel (HIST-14, UI-01).
2. La détection reste dans l'historique, et sa suppression se relance depuis elle pour finir le travail (HIST-14).

## Règles locales

- **HIST-10** · l'utilisateur doit pouvoir supprimer une detection, une a la fois, depuis son apercu ouvert dans l'historique, apres une confirmation courte qui dit que la detection et sa video seront effacees ; elle disparait alors de tout Vyzio (historique, historique d'une personne, accueil, journal d'envoi de ses notifications, reponses du canal de messagerie), et tout ce que la camera a enregistre pendant le passage qui la contient est efface aussi, video complete comme sequences de mouvement ; ce passage peut durer plus que la detection, et une autre detection du meme passage reste dans l'historique avec son apercu mais sans sa video ; les notifications deja envoyees restent la ou elles ont ete recues ;
- **HIST-12** · supprimer les notifications d'une detection les retire aussi du calcul du **Silence** : la detection suivante du meme type sur cette camera peut etre notifiee sans attendre la fin de l'espacement ;
- **HIST-13** · une detection ne se supprime pas tant que l'enregistrement de son passage est en cours, meme si elle-meme est terminee : elle reviendrait ; l'utilisateur est invite a reessayer une fois l'enregistrement du passage termine ; une detection qui n'existe plus le dit, et quitte la liste ;
- **HIST-14** · si la surveillance refuse ou ne repond pas, Vyzio ne retire rien de son cote et l'erreur suit UI-01 : sa phrase dit si rien n'a ete efface ou si l'effacement est seulement partiel, son detail ce qui l'etait deja ; une demande d'effacement restee sans reponse compte comme un effacement partiel ; tant que tout n'est pas efface, la detection reste dans l'historique et sa suppression se relance depuis elle pour finir le travail ;
- **HIST-15** · restent sur le disque de la machine sans plus etre affiches nulle part : la vignette de la detection et l'image du passage, sans echeance ; les visages gardes pour l'apprentissage de la reconnaissance, jusqu'a ce que de plus recents les remplacent.

## Points ouverts

Aucun.
