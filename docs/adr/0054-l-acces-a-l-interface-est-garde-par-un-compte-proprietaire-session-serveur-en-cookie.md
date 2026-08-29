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
6. **Comptes multiples avec rôles dès maintenant.** Écartée : un foyer, un propriétaire. Des rôles
   sans besoin exprimé produiraient des écrans de gestion que personne n'ouvre.
7. **Compte propriétaire créé au premier démarrage, session serveur dans un cookie `httpOnly`.**
   Retenue.

## Décision

**Option 7.** L'accès à l'interface devient une **frontière d'authentification** : une seule, tenue
par l'API, franchie par une session que le serveur peut révoquer.

### Le compte naît avec l'installation

Tant qu'aucun compte n'existe, le produit n'est pas installé : l'interface n'affiche que la création
du mot de passe du propriétaire, et l'API refuse tout le reste. C'est le seul instant où le produit
peut se verrouiller sans que personne ait à lire quoi que ce soit — une étape de l'installation, ni
un fichier de configuration, ni un mot de passe généré dans les journaux du conteneur, que ce public
ne lira jamais.

Le compte est **unique et sans identifiant à choisir** : il n'y a qu'un propriétaire, lui demander
d'inventer un nom d'utilisateur serait une friction sans contrepartie. Le modèle de données porte
néanmoins le compte comme une entité à part entière, pour qu'un second utilisateur soit un ajout et
non une reprise de schéma.

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
