# Étude — socle de configuration : navigation, architecture de l'information, composants

> Document préparatoire, **jetable**. Il ne tranche rien : il établit le constat, pose les critères
> de décision et compare des propositions. Les choix retenus iront dans un ADR, et les attendus
> produit correspondants dans [`SPECS.md`](../SPECS.md) §7.
>
> Déclencheur : item « Refondre le socle de configuration » du [`BACKLOG`](../BACKLOG.md), et son
> voisin sur la bibliothèque de composants — les deux partagent la même cause.

---

## 1. Ce qui existe aujourd'hui

### 1.1 La barre de navigation

Six entrées, un seul niveau, aucune hiérarchie (`common/components/AppHeader.tsx`) :

| Entrée | Route | Ce que c'est réellement |
| --- | --- | --- |
| Accueil | `/` | Consultation : état système, live, détections récentes, moniteur |
| **Paramètres** | `/cameras` | **Découverte et ajout de caméras**, + fiche caméra, + réglages d'installation |
| Profils | `/profiles` | Configuration : personnes connues |
| **Alertes** | `/notifications` | **Configuration** des notifications (le nom évoque un objet consultable) |
| Historique | `/history` | Consultation : détections passées |
| **Expert** | `/expert` | **Frigate en iframe plein écran** |

Trois natures d'écran sont mélangées sans que rien ne les distingue : **consulter** (Accueil,
Historique), **configurer** (Paramètres, Profils, Alertes) et **s'échapper vers l'outil technique**
(Expert). Le libellé ne dit pas dans laquelle on entre.

### 1.2 Inventaire des réglages

Recensé dans le code, c'est la matière que la future arborescence doit ranger.

**Portée installation** (une seule valeur pour tout le système) :

- durées de conservation ×3 (`RecordingSettingsSection`) — *introduites par ADR-39, sans domicile* ;
- notifications : catégories notifiées, champs inclus dans le message, format, anti-spam (cooldown),
  plage horaire active ;
- canal Telegram : token, chat ID, confiance minimale, activation ;
- à venir (cités au backlog) : modèle d'inférence, seuil d'alerte stockage, seuil d'alerte CPU.

**Portée caméra** (`Cameras.Component.tsx`, panneau de détail) :

- identité et connexion : nom, host, port, chemin de flux, utilisateur, mot de passe ;
- détection : objets suivis, sensibilité au mouvement (+ épinglage), flux de détection ;
- conservation ×3 (surcharges) ;
- mode vie privée : 4 stratégies + planification horaire ;
- PTZ : positions enregistrées, calibration ;
- réglages image (si la caméra les expose) ;
- capacités vérifiées.

**Ni l'un ni l'autre** : profils (objets métier), historique (consultation).

### 1.3 Chiffres qui cadrent l'effort

- `Cameras.Component.tsx` : **1278 lignes** — le plus gros fichier du front, 184 kB de bundle à lui seul.
- `App.css` : **4091 lignes** de CSS global, un seul fichier.
- **6 points de rupture responsive différents** (480, 640, 720, 860, 900, 1100 px) : l'adaptation
  s'est faite au cas par cas, écran par écran.
- Composants partagés réellement génériques : **`Btn`, `Select`, `ConfirmModal`, `Toast`** — soit
  quatre. Tout le reste est du JSX + classes CSS écrits sur place.
- Aucune dépendance UI : ni Tailwind, ni Radix, ni équivalent.

---

## 2. Le diagnostic

Sept constats. Les deux premiers sont la cause ; les autres en découlent.

**① Il n'existe aucun endroit dont la fonction soit « régler l'installation ».** C'est la cause
racine. Quand ADR-39 a produit le premier réglage global, il n'y avait littéralement pas de case où
le mettre — il a atterri dans la barre latérale de l'écran Caméras, entre « Saisie manuelle » et la
liste des candidats. Renommer l'écran en « Paramètres » n'a fait que déplacer l'incohérence : c'est
désormais une page « Paramètres » dont la fonction principale est d'ajouter des caméras.

**② La navigation n'a qu'un seul niveau.** Il n'y a donc pas de place *libre* : tout nouveau réglage
doit s'inviter dans un écran existant, quel que soit son rapport avec lui. Le nombre de réglages va
croître fortement ; à structure constante, chaque ajout aggrave mécaniquement le désordre. C'est le
point qui rend la refonte urgente plutôt que cosmétique.

**③ Les noms mentent sur la nature de l'écran.** « Alertes » est un écran de réglages, mais son nom
promet une liste d'événements — que l'utilisateur trouvera en réalité sous « Historique ». « Expert »
n'a pas de périmètre défini : c'est un nom d'audience, pas de contenu.

**④ « Expert » expose Frigate en plein écran.** Une iframe sur l'interface Frigate, avec son nom dans
les messages d'erreur. C'est en contradiction directe avec le principe produit #2 (*Frigate invisible
et temporaire*), et ce n'est pas une dette d'implémentation : c'est un écran assumé dans la barre de
navigation principale.

**⑤ Le cycle enregistrer / appliquer / annuler n'a pas de vocabulaire.** Trois états se superposent :
la modification locale, l'enregistrement côté Vyzio, l'application au moteur de détection (ADR-38).
Chaque écran les traite différemment : la fiche de connexion a un bouton « Enregistrer », la
rétention enregistre à la sortie du champ sans bouton, « Appliquer » vit dans la barre latérale, loin
du réglage modifié. L'utilisateur ne peut ni voir **ce qu'il a changé**, ni annuler.

**⑥ L'aide se confond avec les réglages.** Les explications sont en texte courant, à la même échelle
typographique que les libellés et les valeurs. Sur le sélecteur de mode vie privée, quatre options
portent chacune une phrase complète ; le bloc de configuration Telegram contient un tutoriel entier.
Le résultat, sur un écran déjà dense, est que le bouton d'action passe inaperçu.

**⑦ Le mobile est une adaptation, pas une conception.** Six points de rupture ad hoc, un master-detail
à deux colonnes, un header à six liens. À noter : **SPECS §7.2 n'exige aujourd'hui que des actions
« faisables sur mobile et desktop »** — c'est strictement plus faible qu'une conception mobile-first.
Les SPECS doivent donc être mises à jour avec la direction retenue, sinon le code respectera la
spécification tout en ratant la cible.

### Le paradoxe à tenir

C'est la contrainte de conception, pas un problème à résoudre : une configuration **extrêmement
simple pour un utilisateur non-technicien** (principe #1), sans renoncer aux **réglages de niche**
qui couvrent les besoins réels et évitent la friction d'un système opaque (principe #4). Les deux
échecs symétriques : une interface qui cache tout et frustre, une interface qui montre tout et
ressemble à un NVR.

---

## 3. Critères de décision

Toute proposition ci-dessous est jugée là-dessus. Les trois premiers sont éliminatoires.

1. **Extensibilité** — ajouter un réglage doit avoir une réponse évidente à « il va où ? », sans
   arbitrage ni ADR à chaque fois.
2. **Portée lisible** — l'utilisateur doit savoir sans effort s'il règle *une caméra* ou *toute
   l'installation*. C'est le modèle posé par ADR-39 ; la navigation doit le rendre visible.
3. **Mobile-first** — la structure doit naître du petit écran, pas y survivre.
4. **Progressivité** — le courant d'abord, le niche accessible mais pas dans le chemin.
5. **Coût de transition** — refonte incrémentale ou big-bang ; combien d'écrans réécrits.
6. **Frigate invisible** — aucune structure de navigation ne doit exiger de le nommer.

---

## 4. Propositions — navigation et architecture de l'information

### Option A — Séparer *consulter* et *régler*

La barre principale ne garde que la consultation et l'action quotidienne ; **une seule entrée
« Réglages »** ouvre une arborescence à deux niveaux.

```
Accueil · Direct · Historique                              [⚙ Réglages]
                                                            ├── Caméras ──── <caméra> ─── Détection
                                                            │                             Conservation
                                                            │                             Vie privée
                                                            │                             Connexion…
                                                            ├── Enregistrement  (durées d'installation)
                                                            ├── Détection       (objets, sensibilité, modèle)
                                                            ├── Notifications   (canaux, format, horaires)
                                                            ├── Personnes       (profils)
                                                            └── Système         (stockage, ressources, avancé)
```

C'est le modèle des réglages d'iOS/Android et celui de Frigate lui-même. Chaque rubrique de réglages
d'installation a une page jumelle au niveau caméra, ce qui donne à la surcharge d'ADR-39 une forme
visible : *le même écran, un cran plus bas*.

**Pour** — répond aux six critères. Extensible sans limite (un réglage nouveau = une ligne dans une
rubrique existante, ou une rubrique de plus). La portée devient une position dans l'arbre, pas une
convention à apprendre. Structure nativement mobile : liste → sous-liste → page, un seul niveau
visible à la fois. « Expert » disparaît de la barre principale et devient *Réglages → Système →
Avancé*, ce qui règle ④ sans le supprimer.

**Contre** — c'est la refonte la plus lourde : la barre change, les six écrans changent de coquille,
le routage passe à deux niveaux, et `Cameras.Component.tsx` doit être démonté. Ajoute un clic sur les
réglages fréquents (atténuable par des raccourcis depuis l'Accueil).

### Option B — La caméra au centre

L'entité principale reste la caméra. Les réglages d'installation deviennent une entrée
**« Toutes les caméras »** en tête de la liste, dont chaque page a la même forme que la page caméra
correspondante.

```
Accueil · Caméras · Personnes · Historique
              └── ▸ Toutes les caméras   ← les valeurs d'ensemble
                  ▸ Entrée
                  ▸ Jardin
                  ▸ Garage
```

**Pour** — coût de transition le plus faible : c'est presque la structure actuelle, redressée. Rend
la chaîne installation → caméra littéralement lisible (le parent est en haut de la même liste). Bon
sur les critères 2 et 5.

**Contre** — **échoue sur le critère 1**. Les réglages qui ne sont pas *par caméra* — notifications,
stockage, ressources système, modèle d'inférence — n'ont toujours pas de domicile : les mettre sous
« Toutes les caméras » serait faux (une notification n'est pas un réglage de caméra), les laisser
dehors reproduit la dispersion actuelle. C'est la structure d'aujourd'hui avec un meilleur nom : elle
soulage le symptôme ① sans traiter ②.

### Option C — Navigation par intention

La barre nomme ce que l'utilisateur veut faire, pas les objets techniques : *Surveiller* · *Qui est
là* · *Être prévenu* · *Retrouver* · *Mon installation*.

**Pour** — le plus proche du principe #1 : zéro jargon, la barre parle la langue de l'utilisateur.
Séduisant pour la première prise en main.

**Contre** — **échoue sur le critère 1** pour une autre raison : les intentions ne se subdivisent pas
proprement. « Modifier le mot de passe d'une caméra » relève de quelle intention ? La conservation
sert *Retrouver* et coûte du disque à *Mon installation*. Un réglage nouveau ouvre un débat à chaque
fois — exactement ce qu'on cherche à supprimer. Et l'utilisateur qui revient cherche un objet
(« ma caméra du jardin »), pas une intention.

### Sur la progressivité (transverse, à combiner avec A ou B)

- **C1. Deux paliers explicites** — un interrupteur *Simple / Avancé* global. Lisible, mais l'état
  est global et invisible depuis la page où il agit : l'utilisateur cherche un réglage qui « a
  disparu ».
- **C2. Section « Avancé » repliée en bas de chaque page** — la progressivité est locale, toujours au
  même endroit, sans état à mémoriser. **Recommandé** : c'est aussi ce qui définit naturellement où
  atterrit un réglage de niche.
- **C3. Rien** — tout à plat, ordonné par fréquence d'usage. Tenable tant que les pages sont courtes ;
  ne le restera pas.

### Sur enregistrer / appliquer / annuler (constat ⑤, transverse)

Deux modèles cohérents ; le mélange actuel est le vrai défaut.

- **D1. Enregistrement immédiat partout** — pas de bouton, la valeur part à la sortie du champ (ce que
  fait ADR-39). Cohérent avec le mobile, où un bouton en bas de page est hors écran. Impose alors un
  **retour arrière par champ** — le mécanisme ↺ existe déjà — et une barre « configuration à
  appliquer » persistante, ancrée en bas d'écran plutôt qu'insérée au fil du contenu.
- **D2. Brouillon explicite** — modifications locales, barre d'actions collante *n modifications ·
  Annuler · Enregistrer*, et le détail de ce qui a changé. Répond directement à « l'utilisateur ne
  voit pas ce qu'il a modifié », au prix d'un état de brouillon à tenir partout.

D1 + retour arrière par champ est plus léger et prolonge l'acquis d'ADR-39 ; D2 est plus explicite
mais plus coûteux. **À trancher** — c'est le point de l'étude où la réponse est le moins évidente.

---

## 5. Propositions — composants d'interface

Déclencheur documenté : des `select` blancs sur blanc, corrigés au cas par cas alors que le problème
est systémique. Le fond du sujet : **4091 lignes de CSS global**, quatre composants partagés, aucun
token de contraste, aucun état focus/disabled garanti, aucune accessibilité vérifiée. Une refonte de
navigation va multiplier les écrans de formulaire — c'est le pire moment pour construire dessus.

Ce que le [DESIGN SYSTEM](../DESIGN%20SYSTEM.md) apporte déjà et qu'il faut **conserver quelle que
soit l'option** : la palette chaude et domestique, et la règle de forme *pilule = état, rectangle
arrondi = action*. Elle est porteuse de sens et aucune bibliothèque ne la fournira.

### Option E — Outiller la base maison

Extraire des primitives (`Field`, `SettingRow`, `Section`, `Disclosure`, `Tooltip`), ajouter des
tokens de contraste et d'états, découper `App.css` en CSS Modules colocalisés.

**Pour** — aucune dépendance, aucun changement de paradigme, la palette reste intacte, progressif
fichier par fichier.
**Contre** — accessibilité, focus, navigation clavier, comportement des popovers sur mobile : tout
reste à écrire et à tester à la main. C'est précisément le travail que ce projet n'a pas fait
jusqu'ici ; rien n'indique qu'il le fera mieux la prochaine fois.

### Option F — Adopter shadcn/ui

Radix Primitives + Tailwind, composants **copiés dans le dépôt** (pas une dépendance opaque),
rethématisés sur la palette Vyzio.

**Pour** — accessibilité et gestion du focus fournies et éprouvées ; couvre exactement ce dont une
refonte de réglages a besoin (Form, Tabs, Accordion, Popover, Sheet, Switch, Tooltip) ; la `Sheet`
mobile et l'`Accordion` sont littéralement les briques des options A et C2. Le code étant copié, il
n'y a pas d'enfermement.
**Contre** — impose **Tailwind**, donc deux systèmes de style cohabitent pendant toute la transition,
et le DESIGN SYSTEM doit être retranscrit en tokens Tailwind. C'est le coût principal, et il est réel.

### Option G — Headless seul (Radix / Base UI / Ark), sans Tailwind

Le comportement accessible vient de la bibliothèque, l'apparence reste en CSS Vyzio.

**Pour** — gagne l'accessibilité sans imposer Tailwind ; la palette et les tokens existants sont
réutilisés tels quels. Compromis médian honnête.
**Contre** — il faut écrire soi-même tout l'habillage de chaque composant : on récupère la moitié
difficile mais on garde la moitié volumineuse, et sans la discipline de tokens qui vient avec shadcn
on retombe sur le CSS global.

**Lecture de l'axe** : E ne traite pas la cause. F et G règlent la même moitié du problème ; le choix
entre eux est en réalité **« adopte-t-on Tailwind ? »**, décision structurante à poser franchement
plutôt qu'à faire passer dans le choix d'une bibliothèque.

---

## 6. Recommandation

**Option A** (séparer consulter et régler) **+ C2** (avancé replié par page) **+ F ou G** selon la
réponse sur Tailwind. Sur le cycle enregistrer/appliquer : **D1**, en prolongement d'ADR-39, sauf
argument contraire.

A est la seule option qui traite le constat ② — l'absence de second niveau — donc la seule qui tienne
quand le nombre de réglages doublera. B est plus économique mais laisse les réglages non-caméra sans
domicile, c'est-à-dire laisse le problème entier. C est intellectuellement le plus proche du principe
#1, mais son extensibilité est mauvaise et c'est justement l'extensibilité le sujet.

Le paradoxe simple/niche est tenu par **la profondeur**, pas par le masquage : la première page d'une
rubrique ne contient que le courant, le niche est un cran plus bas, toujours atteignable et jamais
caché. Rien n'est retiré à l'utilisateur avancé ; c'est l'ordre de rencontre qui change.

### Ordre d'exécution proposé

1. **Trancher** ce document : structure de navigation, Tailwind ou non, D1 ou D2.
2. **Aligner le cadrage** : ADR sur l'architecture de l'information ; ADR sur les composants ; SPECS
   §7.2 réécrit en mobile-first ; DESIGN SYSTEM mis à jour.
3. **Poser la coquille** : nouvelle barre, routage à deux niveaux, écrans existants branchés tels
   quels dessous — aucune régression fonctionnelle à cette étape.
4. **Migrer écran par écran** vers les nouveaux composants, en commençant par les réglages
   d'installation (les plus récents, les moins intriqués).
5. **Démonter `Cameras.Component.tsx`** en dernier : séparer découverte, onboarding, fiche caméra et
   réglages, et scinder l'union `CameraSelection` qui sert aujourd'hui à la fois de sélection d'objet
   et de routage d'écran.

### Questions ouvertes

- **Tailwind, oui ou non ?** Décision structurante, indépendante du choix de bibliothèque.
- **Que devient « Expert » ?** *Réglages → Système → Avancé* (proposé), ou suppression pure, ou
  maintien tel quel en assumant la contradiction avec le principe #2.
- **Les profils sont-ils un réglage ?** Ce sont des objets métier que l'utilisateur crée et
  consulte, pas des valeurs. Les ranger sous « Réglages » est discutable.
- **Un compte / une authentification** est prévu (SPECS §8) et n'a pas de place réservée dans les
  propositions ci-dessus.
- **D1 ou D2** sur le cycle enregistrer/appliquer/annuler.
