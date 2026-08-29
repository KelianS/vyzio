# ADR-54 — L'accès à l'interface est gardé par un compte propriétaire, session serveur en cookie

> Statut : Accepté

## Contexte

L'interface et l'API ne sont protégées par rien. Il n'existe ni écran de connexion, ni compte, ni
session : `/api/` répond à qui la demande, et le conteneur qui sert l'interface publie son port sur
le réseau local. Toute machine du domicile — un objet connecté, un invité sur le Wi-Fi, un appareil
compromis — peut donc regarder les caméras en direct, parcourir l'historique, couper le mode vie
privée et piloter une caméra motorisée.

C'est la seule chose du produit qui contredit frontalement sa promesse. Un produit qui refuse
d'envoyer une image sans consentement explicite mais la sert à qui la demande sur le réseau local ne
protège rien : il déplace la fuite d'un pas.

[SPECS](../SPECS.md) §8.2 l'exige depuis l'origine (« l'accès à l'interface et aux données doit être
protégé »). Le [SAD](../SAD.md) §9.1 annonçait même « JWT, rate limiting » comme mitigations en
place — elles ne l'étaient pas. Cet ADR tranche *comment* la barrière est posée.

Deux éléments d'architecture cadrent la décision avant même les options. **L'interface et l'API sont
sur la même origine** : le conteneur qui sert le SPA relaie `/api/` vers l'API, et rien d'autre n'est
publié ([SAD](../SAD.md) §8.1). **Le transport est en clair**, et il le restera à l'issue de ce
chantier.

## Options comparées

1. **Ne rien faire, et compter sur le réseau local.** Écartée : c'est l'état actuel, et il fait du
   réseau domestique une frontière de confiance — précisément ce qu'un réseau domestique n'est pas.
2. **Dispenser de connexion selon l'adresse IP** (« réseau de confiance »). Écartée : une adresse
   n'est pas une identité, et derrière un proxy elle se falsifie par un simple en-tête. Home
   Assistant a livré ce mode puis l'a déprécié pour cette raison ; rien ne justifie de le
   réintroduire.
3. **Déléguer l'authentification à un reverse proxy** que l'utilisateur installe devant Vyzio.
   Écartée : elle transforme la seule protection du produit en devoir de l'utilisateur, et le public
   visé ne configure pas un proxy (principe produit #1). Une installation par défaut resterait nue.
4. **Basic Auth, ou une clé d'API partagée dans la configuration.** Écartée : pas de déconnexion, pas
   de révocation, pas de changement de mot de passe sans redémarrage, et un secret qui finit recopié
   en clair dans un fichier de configuration. C'est une serrure à clé unique, jamais changée.
5. **Jeton JWT autonome, stocké dans le navigateur** (`localStorage`), envoyé en en-tête. Écartée
   pour deux raisons distinctes : un jeton lisible par le JavaScript de la page est volé par la
   moindre injection de script, là où un cookie `httpOnly` ne l'est pas ; et un jeton autonome **ne
   se révoque pas** — le jour où un téléphone est perdu, « déconnecter tous les appareils » est
   exactement la fonction qu'on cherche, et elle est impossible sans état côté serveur.
6. **Une matrice de permissions fines** (par écran, par caméra, par action). Écartée : c'est le point
   où ce genre de modèle s'enlise. Home Assistant s'en tient à un drapeau *administrateur* et n'a
   jamais sorti ses permissions par entité de l'expérimental ; Frigate a tranché *admin* / *viewer*.
   Deux rôles suffisent à tout ce qu'un foyer exprime.
7. **Livrer les comptes multiples tout de suite.** Écartée, mais seulement dans son calendrier :
   l'écran d'invitation et la liste des comptes se rajoutent plus tard sans rien casser. Ce qui ne se
   rattrape pas, en revanche, c'est la **forme** — une barrière écrite en booléen « connecté ou pas »
   oblige à repasser sur chaque route et chaque écran le jour où un rôle apparaît. L'axe est donc
   porté maintenant, la fonctionnalité non (voir la décision).
8. **Compte propriétaire créé au premier démarrage, session serveur dans un cookie `httpOnly`.**
   Retenue.

## Décision

**Option 8.** L'accès à l'interface devient une **frontière d'authentification** : une seule, tenue
par l'API, franchie par une session que le serveur peut révoquer.

### Le compte naît avec l'installation

Tant qu'aucun compte n'existe, le produit n'est pas installé : l'interface n'affiche que la création
du mot de passe du propriétaire, et l'API refuse tout le reste. C'est le seul instant où le produit
peut se verrouiller sans que personne ait à lire quoi que ce soit — une étape de l'installation, ni
un fichier de configuration, ni un mot de passe généré dans les journaux du conteneur, que ce public
ne lira jamais.

Le compte est **unique et sans identifiant à choisir** : il n'y a qu'un propriétaire, lui demander
d'inventer un nom d'utilisateur serait une friction sans contrepartie.

### Deux rôles, portés dès le premier jour ; le second compte, plus tard

Le rôle est une propriété du compte **dès la première migration**, avec une seule valeur peuplée. Ce
n'est pas de l'anticipation gratuite : ajouter un compte est bon marché à tout moment, alors que
transformer une barrière binaire en barrière à rôles impose de rouvrir chaque route et chaque écran,
et se paie en oublis qu'on découvre à l'usage.

| Rôle | Peut |
|---|---|
| **Propriétaire** | tout, dont ce que la case du dessous exclut |
| **Résident** | consulter le direct et l'historique, et **couper une caméra** (mode vie privée) |

La ligne n'est pas « voir / ne pas voir » : un résident voit déjà toutes les images, donc un rôle qui
lui en cacherait une partie ne protégerait rien. Elle est **utiliser / configurer**. Ce que le rôle
protège, ce sont les **secrets et la configuration** — identifiants de caméra, jetons de bot,
rétention, suppression de données, appairages — pas les images.

Le mode vie privée fait exception à toute lecture naïve du modèle : c'est l'acte le plus puissant du
produit, puisqu'il aveugle une caméra, et c'est pourtant celui qu'un résident doit pouvoir poser
**sans demander la permission** — sinon la promesse du produit ne tient pas. Contrepartie assumée :
un résident peut aveugler une caméra avant d'agir hors du champ. Dans un foyer, c'est la confiance
qu'on accorde en confiant une clé ; si elle est trahie, la réponse est **d'attribuer les coupures**,
jamais de retirer le droit.

Deux conséquences de forme, qui sont le vrai contenu de cette décision :

- **une route déclare ce qu'elle exige**, à l'endroit où elle est déclarée — jamais un test de rôle
  dispersé dans un service ;
- **l'interface interroge la session** sur ce qu'elle permet, via un point unique, au lieu de
  présumer que tout est permis.

### La session est un état du serveur, pas un jeton du client

Le cookie ne porte qu'une référence opaque ; la session vit en base, avec son appareil et sa date de
dernier usage. Cookie `httpOnly`, `SameSite=Lax`, et `Secure` dès que le transport sera chiffré.
Rien à ajouter dans le code d'appel de l'interface : même origine, le navigateur l'envoie seul.

La session est **longue et glissante** (de l'ordre du mois). Une application de caméras qu'on ouvre
depuis son téléphone et qui redemande un mot de passe chaque jour finit laissée ouverte ou
désinstallée : une session courte y produirait moins de sécurité réelle, pas plus.

### Ce que la barrière couvre

Tout, sauf deux exceptions nommées : la sonde de santé du conteneur, et les routes de création du
compte, qui cessent de répondre dès qu'il existe. En particulier, les images, aperçus et clips
relayés depuis le pipeline vidéo passent la même barrière que le reste — ce sont les données
sensibles du produit, et aujourd'hui une adresse d'aperçu se devine.

La connexion est **limitée en débit** ; le reste ne l'est pas.

### Deux portes, jamais un passe-partout

L'appairage d'une conversation ([ADR-50](0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md))
reste une frontière **séparée**, avec sa propre révocation : une session web n'appaire pas une
conversation, et une conversation appairée n'ouvre pas l'interface. Deux chemins d'entrée, deux
serrures, aucun secret partagé.

Une conversation est **plafonnée au rôle résident**, définitivement : aucune commande de
configuration n'entre dans le catalogue, quel que soit le rôle de qui a appairé. Un fil de discussion
est un canal qu'on ne maîtrise pas — un téléphone déverrouillé sur une table, un compte de messagerie
compromis, un historique lisible par l'application du canal. On y consulte et on coupe une caméra ;
on n'y règle rien, et surtout on n'y lit aucun secret. Ce plafond est une propriété du **catalogue de
commandes**, pas un contrôle à l'exécution : ce qui n'existe pas ne se contourne pas.

### Le mot de passe oublié se récupère par le disque

Ni question secrète, ni envoi de courriel : la remise à zéro se fait depuis la machine qui héberge
Vyzio. Qui a cet accès possède déjà les données ; c'est le seul secours qui n'ouvre pas une porte
dérobée sur le réseau.

## Conséquences

- **Le transport reste en clair, et le mot de passe circule donc en clair sur le réseau local.** Dit
  franchement plutôt que masqué : cette décision ne livre pas la confidentialité du trajet, elle
  livre l'identité. Un certificat auto-signé aurait mis un avertissement rouge devant un public non
  technicien — soit l'inverse de l'effet recherché. Le chiffrement reste traité comme le prérequis
  de l'accès distant ([ADR-51](0051-acces-distant-a-l-interface-reseau-overlay-netbird-opere-par-l-utilisateur.md)) ;
  après cet ADR, il devient le **seul** écart entre la cible et la réalité ([SAD](../SAD.md) §8.1).
- **Le premier écran du produit change.** Une installation neuve ouvre sur la création du mot de
  passe, avant l'ajout de la première caméra ([SAD](../SAD.md) §8.2).
- **Un écran qu'on ne peut pas franchir porte son aide sur place** : la connexion et la création du
  compte sont exactement le cas prévu par
  [ADR-53](0053-la-doc-utilisateur-vit-dans-l-interface-trois-niveaux-d-aide.md) — l'aide y vit dans
  l'état affiché, faute d'écran derrière lequel la replier.
- **Une session expirée doit se lire, pas se deviner.** Une réponse « non authentifié » ramène à la
  connexion en le disant ; un écran vide ou une erreur technique ferait passer une déconnexion pour
  une panne (principe produit #4).
- **Les tests de bout en bout franchissent la barrière.** Le harnais Playwright et son faux backend
  ouvrent une session ; c'est le coût assumé d'une barrière sans exception par environnement — une
  dispense en développement finirait tôt ou tard ailleurs.
- **Le modèle de données gagne un compte et des sessions**, et l'installation existante crée son mot
  de passe au premier démarrage qui suit la mise à jour.
- **Un rôle existe sans qu'aucun second compte n'existe.** État assumé le temps que le besoin
  apparaisse : le coût est une colonne et une déclaration par route, le gain est de ne jamais avoir à
  auditer l'ensemble des routes et des écrans après coup.
- **Une coupure de vie privée devra dire qui l'a posée** le jour où un second compte existe. Le
  produit sait déjà attribuer un acte venu d'une conversation
  ([ADR-50](0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md)) ;
  c'est la même exigence, étendue à l'interface.
- **Le catalogue de commandes est désormais borné par une règle**, et non plus seulement par
  l'arbitrage cas par cas d'[ADR-50](0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md) :
  une commande qui configure ou révèle un secret n'y entre pas.
