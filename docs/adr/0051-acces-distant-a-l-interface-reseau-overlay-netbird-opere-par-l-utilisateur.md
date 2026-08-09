# ADR-51 — Accès distant à l'interface : réseau overlay NetBird, guidé par Vyzio mais opéré par l'utilisateur

> Statut : Accepté

## Contexte

Atteindre le hub depuis l'extérieur est le dernier manque produit majeur, et le seul domaine où le
positionnement local-first est un désavantage frontal à l'usage face à Ring, Nest ou aux applications
constructeur. Le SAD inscrivait jusqu'ici un Cloudflare Tunnel — sans ADR, sans comparaison, et sans
implémentation.

La comparaison complète (cinq options, onze critères, dont quatre éliminatoires) est dans
[l'étude dédiée](../investigations/acces-a-distance.md) et n'est pas recopiée ici. Les trois faits qui
commandent la décision :

- **La redirection de port n'est plus une solution grand public en France.** Les quatre FAI partagent
  les adresses IPv4 par défaut ; chez certains, le menu de redirection disparaît de la box. Un
  parcours fondé dessus échoue chez une fraction imprévisible des clients.
- **Publier l'interface sur le web est incompatible avec la promesse.** Un tunnel de publication
  termine le TLS chez le fournisseur — qui voit donc les images de l'intérieur du logement, contre
  l'invariant privacy-first — et rend le service joignable par n'importe qui. Cloudflare **interdit
  de surcroît le streaming vidéo** hors de ses produits payants : le live et les clips de Vyzio sont
  exactement l'usage proscrit.
- **Opérer un relais est hors de portée aujourd'hui.** C'est la meilleure expérience possible (aucune
  application, aucun compte tiers, une URL qui marche partout) mais elle suppose une disponibilité
  24/7, de la bande passante facturée et une responsabilité juridique sur un flux vidéo intime, sans
  base installée pour la financer.

## Options comparées

1. **Tunnel de publication web** (Cloudflare Tunnel, celui du SAD). Écartée sur deux critères
   éliminatoires : le fournisseur déchiffre le trafic, et ses conditions d'utilisation interdisent la
   vidéo.
2. **Redirection de port + DNS dynamique.** Écartée : inopérante derrière le partage d'adresses
   IPv4, désormais la norme.
3. **Relais opéré par Vyzio** (modèle Nabu Casa). Écartée **pour l'instant, pas sur le fond** :
   c'est la cible produit, prématurée tant que Vyzio n'a pas la base installée qui la finance et
   l'astreinte qui la tient.
4. **Réseau overlay Tailscale.** Écartée à parité technique avec l'option 5 : plan de contrôle
   propriétaire et fermé, société américaine — contradiction avec l'argumentaire de souveraineté du
   produit — et plan gratuit réservé à l'usage non commercial, zone grise à lever avant de le placer
   dans une appliance vendue.
5. **Réseau overlay NetBird.** Retenue.

## Décision

**Vyzio n'opère aucune infrastructure d'accès distant** : ni relais, ni plan de contrôle, ni nom de
domaine. Il **guide**, il n'héberge pas.

Le chemin recommandé est un réseau overlay **NetBird**, sur un compte qui appartient à l'utilisateur.
Le produit l'assiste : l'interface explique la création du compte, demande la **clé d'appairage**
générée chez NetBird, la conserve chiffrée (`DataProtection`, comme les identifiants caméra),
raccorde le hub au réseau, puis affiche l'état de la connexion et l'adresse d'accès.

Ce partage de responsabilité est le cœur de la décision : l'utilisateur reste client de son
fournisseur de réseau, Vyzio ne s'interpose ni ne s'en porte garant — **aucun identifiant tiers ne
transite par Vyzio** — et le produit ne prétend pas que l'accès distant est un service Vyzio.

### NetBird plutôt que Tailscale

À propriétés techniques équivalentes (WireGuard, perçage de NAT, fonctionne derrière le partage
d'IPv4, chiffrement de bout en bout que le fournisseur ne peut pas lever), NetBird ajoute trois
choses qui comptent pour ce produit précisément : un **plan de contrôle open source et
auto-hébergeable**, une **juridiction européenne**, et **aucune clause d'usage non commercial** à
lever pour une appliance vendue. C'est la seule option qui fait de l'accès distant un argument de
vente au lieu d'une concession.

### Optionnel, et réversible sans trace

Rien dans le produit ne l'exige : les commandes par messagerie
([ADR-50](0050-le-canal-de-messagerie-devient-bidirectionnel-couche-de-commandes-agnostique-du-canal.md))
couvrent l'usage courant à distance. Un utilisateur qui ne veut pas de compte NetBird garde un
produit entier chez lui et informé partout. Retirer la clé rend le hub purement local, sans effet de
bord ailleurs.

### Le hub est un pair, jamais une passerelle

Vyzio **n'annonce pas le sous-réseau local** sur le réseau overlay. Seul le point d'entrée du produit
est joignable ; les caméras, le broker et le moteur de détection restent inatteignables depuis
l'extérieur. L'accès distant expose donc **exactement ce que le produit expose déjà en local**
(SAD §8.1), et pas un pied dans le réseau domestique.

### Vyzio pilote le pair, il ne le sous-traite pas à l'installateur

Le client de réseau overlay est **un conteneur que Vyzio démarre lui-même**, par le socket Docker
qu'il utilise déjà pour appliquer la configuration du moteur de détection — pas une ligne à ajouter
à la main dans un fichier de déploiement. C'est ce qui permet à l'activation d'être un réglage
ordinaire (SPECS §7.2) : on colle une clé, le pair apparaît ; on la retire, il disparaît.

Le pair **partage l'espace de noms réseau du conteneur qui sert l'interface**. C'est ce qui rend la
règle ci-dessus structurelle plutôt que déclarative : dans cet espace, il n'existe rien d'autre que
le point d'entrée du produit — même une erreur de configuration ne peut pas exposer davantage.
Le mode réseau *host* fonctionnerait aussi, plus simplement, mais rendrait joignable depuis le
réseau overlay **tout ce que la machine hôte écoute** par ailleurs : il n'est acceptable qu'en repli
documenté, jamais par défaut.

## Conséquences

- **L'absence de chiffrement du transport devient bloquante.** Le produit est servi en clair
  aujourd'hui (SAD §8.1) : sur le réseau domestique c'est un défaut, sur un réseau overlay c'est un
  contresens — on aurait chiffré le trajet entre le téléphone et la maison pour livrer l'interface
  en HTTP à l'arrivée, et l'identifiant de session avec. **Le transport chiffré est donc un
  prérequis à l'annonce de cet ADR**, pas un chantier parallèle. Le nom d'hôte overlay étant stable,
  il permet en prime une confiance durable côté navigateur, ce que l'adresse IP locale ne permet pas.
- **Vyzio gagne une responsabilité de cycle de vie** : démarrer, surveiller et arrêter un conteneur
  qui n'est pas le sien. La panne à traiter n'est pas « le VPN est lent » mais « le pair ne monte
  pas » — l'état doit se lire dans l'interface, sinon l'utilisateur conclura que c'est Vyzio qui est
  en panne.
- **Le VPN doit être actif sur le téléphone avant d'ouvrir l'interface.** Friction résiduelle
  assumée, et connue à l'usage réel. Horizon possible — **non décidé ici** : une application Android
  mince embarquant le client et la vue web, pour revenir à un geste unique.
- **L'écran Expert restera inaccessible à distance** : il pointe le navigateur vers le moteur de
  détection hors du chemin Vyzio, ce qui le casse déjà hors de la machine hôte. Un accès distant qui
  marche « sauf un écran » est un défaut visible ; le constat est au backlog, sa résolution est
  indépendante de cet ADR.
- **Vyzio ne peut pas garantir la joignabilité distante** : elle dépend d'un service tiers dont
  l'utilisateur est client. L'interface doit le dire plutôt que le masquer (principe #4), et rien
  dans le produit ne doit en dépendre (principe #3).
- **Le SAD est corrigé** : le Cloudflare Tunnel disparaît de l'isolation réseau et de la synthèse des
  choix technologiques.
- **Aucun revenu récurrent n'est adossé à cette décision**, ce qui préserve le « zéro abonnement
  obligatoire » du positionnement — et laisse le palier « relais Vyzio » (option 3) ouvrable plus
  tard sans rien casser de ce qui est décidé ici.
