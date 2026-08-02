# ADR-43 — Grammaire des réglages : un réglage se déclare, il ne se dessine pas

> Statut : Accepté

## Contexte

[ADR-40](0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md) range
les réglages dans un arbre et
[ADR-41](0041-cycle-d-edition-des-reglages-brouillon-explicite-enregistrer-vaut-appliquer.md) fixe
comment on les valide. Ni l'un ni l'autre ne dit **à quoi ressemble un réglage** une fois arrivé sur
la page qui le porte. C'est pourtant là que se joue l'essentiel du ressenti, et c'est là que l'état
actuel est le plus incohérent.

Constaté sur les écrans existants :

- **le contrôle est choisi au cas par cas** — la sensibilité de détection est un jeu de boutons, le
  constructeur une liste déroulante, les objets suivis des cases à cocher toutes visibles, la
  confiance minimale un curseur, la rétention un champ numérique. Rien ne dit pourquoi ;
- **les tailles et les alignements ne se répondent pas** : les contrôles n'ont ni largeur commune ni
  colonne commune, donc les valeurs ne s'alignent pas verticalement et la page se lit ligne à ligne
  au lieu de se balayer ;
- **l'aide occupe la place des réglages** : les explications sont en texte courant, à la même échelle
  typographique que les libellés et les valeurs. Le sélecteur de mode vie privée porte quatre phrases
  complètes, le bloc Telegram un tutoriel entier ;
- **un même fait est parfois porté par deux contrôles** — le booléen d'enregistrement continu à côté
  d'une durée, corrigé par
  [ADR-39](0039-reglages-globaux-surchargeables-par-camera-retention-d-enregistrement.md), en était
  l'exemple.

La cause est la même partout : **rien n'oblige un réglage nouveau à ressembler aux précédents.**
Chaque ajout est un dessin libre, donc chaque ajout dérive un peu. Une charte écrite ne suffirait
pas — il en existe déjà une, le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md), et la dérive s'est produite
quand même.

Le problème s'aggrave mécaniquement : le nombre de réglages va croître fortement, et
l'héritage installation/caméra d'ADR-39 a vocation à s'étendre à la plupart des réglages de caméra,
ce qui ajoute à chaque ligne une provenance et un retour arrière à afficher.

## Options comparées

### Sur ce qui garantit la cohérence

1. **Un réglage est déclaré comme une donnée ; le composant en déduit le rendu.** Le développeur
   décrit *ce qu'est* le réglage — nature de la valeur, options, unité, portée — et n'a aucune prise
   sur le contrôle employé ni sur la mise en page.
2. **Une charte écrite, appliquée à la revue.** Écarté : c'est exactement le dispositif en place, et
   l'état constaté ci-dessus en est le résultat. Une règle qu'on peut enfreindre en écrivant du JSX
   ordinaire sera enfreinte, d'autant plus que l'enfreindre est plus rapide que la respecter.
3. **Un composant par réglage, libre mais revu.** Écarté : déplace le problème sans le traiter — la
   liberté reste totale, seul le moment du constat change.

### Sur le choix du contrôle

4. **Le contrôle est déduit de la nature de la valeur**, par une table fermée. Le même type de valeur
   produit toujours le même contrôle, dans toute l'application.
5. **Le contrôle est choisi par l'auteur de l'écran**, selon le contexte. Écarté : c'est la pratique
   actuelle. Elle produit deux réglages de même nature rendus différemment sur deux pages, ce qui
   oblige l'utilisateur à réapprendre à chaque écran.

### Sur l'aide

6. **L'aide vit derrière un déclencheur explicite**, sauf lorsqu'elle annonce un coût ou une
   conséquence irréversible, qui reste visible.
7. **L'aide reste en texte courant sous le réglage.** Écarté : c'est ce qui noie les noms et les
   valeurs aujourd'hui.
8. **L'aide au survol.** Écarté : inatteignable au doigt, donc inexistante sur la cible mobile
   ([ADR-40](0040-architecture-de-l-information-consulter-vs-regler-arborescence-a-deux-niveaux.md)).

## Décision

**Options 1, 4 et 6.**

### Un réglage se déclare, il ne se dessine pas

C'est le cœur de la décision, et le seul mécanisme qui empêche structurellement la dérive. Un réglage
est une **déclaration** : nom, nature de la valeur, options éventuelles, unité, aide, portée. Le
composant de rendu en déduit le contrôle, la mise en page, l'alignement, la provenance et le retour
arrière.

Le développeur qui ajoute un réglage **ne peut pas** choisir son apparence — non parce que c'est
interdit, mais parce que l'interface ne le lui propose pas. C'est la différence avec une charte : ici
le chemin le plus court est aussi le seul.

Dessiner un réglage à la main devient donc un acte visible en revue, et une exception à justifier —
non le comportement par défaut.

### La ligne de réglage a une anatomie fixe

L'unité de composition est la **ligne**, et elle est toujours faite des mêmes parties, dans le même
ordre :

**nom** · *déclencheur d'aide* · **contrôle** · *provenance* · *retour arrière*

Le contrôle occupe une **colonne de largeur commune** à toute l'application. C'est ce qui aligne les
valeurs verticalement et permet de balayer une page du regard au lieu de la lire ; c'est aussi ce qui
supprime le « jamais la même taille » constaté. Sur petit écran la ligne se plie en deux niveaux —
nom au-dessus, contrôle en dessous — mais la colonne du contrôle reste commune.

La **provenance** (valeur suivie ou propre au niveau courant) et le **retour arrière**, posés par
ADR-39, sont des parties de la ligne et non des ajouts optionnels : tout réglage surchargeable les
obtient sans que son auteur ait à y penser. C'est la condition pour généraliser l'héritage à la
plupart des réglages de caméra sans multiplier le travail par le nombre de réglages.

### Le contrôle se déduit de la nature de la valeur

Table fermée. Ajouter une ligne à cette table est une décision ; en dévier sur un écran n'en est pas
une.

| Nature de la valeur | Contrôle | Pourquoi |
| --- | --- | --- |
| Booléen | Interrupteur | L'état est lisible sans lire le libellé. |
| Choix exclusif, 2 à 4 options | Groupe segmenté, toutes visibles | Comparer coûte moins qu'ouvrir. |
| Choix exclusif, 5 options et plus | Liste déroulante | Au-delà, le segmenté déborde et casse la colonne. |
| Choix multiple, jusqu'à 7 options | Cases à cocher visibles | L'utilisateur doit voir ce qu'il ne prend pas. |
| Choix multiple, au-delà | Sélecteur avec recherche | Une liste longue se cherche, elle ne se parcourt pas. |
| Nombre avec unité | Champ numérique, unité en suffixe du contrôle | L'unité appartient à la valeur, jamais au libellé. |
| Nombre borné à sens continu | Curseur **et** valeur chiffrée | Un curseur seul empêche de viser et de relire. |
| Texte libre | Champ texte | Rare : à justifier, c'est souvent un choix mal identifié. |
| Secret | Champ masqué avec révélation | Il faut pouvoir relire ce qu'on a saisi. |

**Un fait, un contrôle.** Jamais deux contrôles pour une même réalité — c'est le défaut corrigé par
ADR-39, et la table ci-dessus le rend impossible à réintroduire par inadvertance.

### L'aide est disponible sans occuper la place

Le **nom du réglage doit se suffire**. L'explication vit derrière un déclencheur explicite, attaché
au nom, actionnable au doigt comme à la souris — jamais au survol seul, qui n'existe pas sur la
cible.

**Une seule exception, délibérée** : ce qui annonce un **coût** ou une **conséquence** reste visible
sans déclencheur — l'ordre de grandeur disque de la vidéo complète, l'interruption de la surveillance
à l'enregistrement (ADR-41), le caractère irréversible d'une suppression. Cacher un coût derrière un
geste supplémentaire est un piège, pas de la sobriété ; c'est le principe #4 qui l'impose.

Le texte courant entre deux réglages est proscrit. Une explication qui ne tient pas dans une
info-bulle relève de la [documentation utilisateur](../user/), qui est liée depuis la page.

### L'ordre dans la page est le même partout

Le plus courant en premier, le reste ensuite, et le rare dans le repli **Avancé** de fin de page
(ADR-40). L'ordre n'est pas laissé au hasard de l'ajout : un réglage nouveau se range selon sa
fréquence d'usage attendue, pas à la fin.

## Conséquences

- **Le catalogue des réglages devient lisible comme une donnée.** Chaque page de réglages est une
  liste de déclarations, ce qui rend visible d'un coup d'œil ce que l'installation expose — et rend
  possible d'en dériver autre chose que du rendu (documentation, recherche de réglage, tests).
- **La table des contrôles est fermée et vit dans cet ADR.** Le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md)
  la référence sans la recopier ; l'étendre est une modification d'ADR, ce qui est précisément le
  frein recherché.
- **L'héritage installation/caméra devient bon marché.** Provenance et retour arrière étant des
  parties de la ligne, généraliser le modèle d'ADR-39 à la plupart des réglages de caméra ne coûte
  plus qu'une propriété dans la déclaration. Cette généralisation reste un chantier distinct, mais
  cette décision en est le prérequis.
- **Les écrans existants sont non conformes**, y compris ceux livrés récemment. La reprise se fait
  écran par écran avec le reste du chantier ; aucun réglage nouveau n'est ajouté hors grammaire, sans
  quoi la dette se reconstitue pendant qu'on la rembourse.
- **Le rendu déclaratif est un composant Vyzio, pas une primitive** (frontière posée par
  [ADR-42](0042-socle-de-composants-d-interface-shadcn-ui-sur-radix-et-tailwind.md)) : il s'appuie sur
  les primitives accessibles sans jamais les modifier.
- **Un réglage qui n'entre pas dans la grammaire est un signal**, pas un cas particulier à traiter sur
  place : soit sa nature est mal identifiée, soit la table doit s'étendre. Les deux se règlent avant
  d'écrire l'écran, pas pendant.
