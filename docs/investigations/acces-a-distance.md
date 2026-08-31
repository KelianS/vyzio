# Étude — accès à Vyzio depuis l'extérieur du domicile

> Document préparatoire, **jetable**. Il ne tranche rien : il établit le constat, pose les critères
> de décision et compare des solutions. Le choix retenu ira dans un ADR, et l'attendu produit
> correspondant dans [`SPECS.md`](../SPECS.md).
>
> Déclencheur : idée « Accès à Vyzio depuis l'extérieur ».
> Faits réseau et prix relevés en **août 2026** — les offres des fournisseurs bougent vite, à
> revérifier avant de décider.

---

## 1. Pourquoi c'est le point produit le plus important

Une caméra de surveillance sert d'abord à **savoir ce qui se passe chez soi quand on n'y est pas**.
Aujourd'hui, Vyzio ne répond à ce besoin qu'à moitié : les notifications sortent (Telegram, avec
l'image), mais **tout le reste du produit s'arrête à la porte du domicile**. Live, historique,
enregistrements, mode vie privée, PTZ : rien n'est joignable depuis un réseau mobile.

Le concurrent direct (Ring, Nest, Arlo, et même les apps constructeur ICSee / Reolink) résout ce
point **par défaut, sans que l'utilisateur ait rien à faire**. C'est le seul domaine où le
positionnement local-first est aujourd'hui un désavantage frontal à l'usage, et pas seulement un
argument de vente.

### Ce que dit — et surtout ne dit pas — le cadrage actuel

- **SPECS** : aucune user story. Le mot « extérieur » n'y apparaît pas. §5.3 ne traite que le sens
  inverse (fonctionner *sans* Internet). **C'est le trou principal** : le besoin n'est pas écrit.
- **SAD** §9.2 : le schéma d'isolation réseau montre `Internet (optionnel) └─► Cloudflare Tunnel
  ──► 8443`, et l'annexe A liste « Accès distant images : URL signée HMAC + tunnel opt-in ».
  Un choix y figure donc déjà — **sans ADR, sans comparaison, et sans que rien ne soit implémenté**.
  Cette étude existe notamment pour vérifier s'il tient (§6.3 : il ne tient pas tel quel).

---

## 2. Ce qui existe aujourd'hui dans Vyzio

| Élément | État | Conséquence pour l'accès distant |
| --- | --- | --- |
| Point d'entrée | Un seul service publié, celui qui sert l'interface (SAD §8.1) | Surface minimale : une seule chose à joindre |
| TLS | **Aucun** — le produit est servi en clair ; le certificat auto-signé de l'annexe A du SAD n'est qu'une cible | Prérequis bloquant : chiffrer le trajet pour livrer du HTTP à l'arrivée n'aurait aucun sens |
| Authentification | JWT + bcrypt, rate limiting login ([ADR-10](../adr/0010-authentication-jwt-and-bcrypt.md)) | Une auth existe — mais dimensionnée pour un LAN de confiance |
| Frigate | lié à `127.0.0.1`, jamais routable ([ADR-11](../adr/0011-non-technical-ux-strategy-simplified-vyzio-hub-plus-advanced-frigate.md)) | Rien d'autre que Vyzio n'a à sortir |
| Live | polling JPEG ~1 fps via Vyzio ([ADR-16](../adr/0016-live-stream-access-polling-latest-jpg-through-vyzio-frigate-never-exposed.md)) | Peu gourmand aujourd'hui — mais le backlog prévoit un vrai flux vidéo, ce qui change l'ordre de grandeur du débit sortant |
| Clips | proxy Vyzio authentifié ([ADR-17](../adr/0017-event-clip-access-an-authenticated-streaming-vyzio-proxy.md)) | Idem : vidéo, donc débit |
| Notifications | Telegram, image incluse | **Seul canal déjà « distant » qui fonctionne** |

Point notable : **l'architecture est déjà prête**. Un seul port HTTPS, un seul processus à joindre,
Frigate hermétique. La question est donc uniquement *comment* atteindre ce port depuis l'extérieur —
pas *quoi* exposer.

---

## 3. Les contraintes de terrain (elles éliminent des solutions à elles seules)

### 3.1 Le CGNAT est désormais la norme en France

Bouygues, SFR et Free partagent les adresses IPv4 depuis des années ; **Orange est passé au partage
par défaut en janvier 2025** pour l'ADSL et la fibre. Sur les box 4G/5G, l'adresse est quasi
systématiquement partagée. Chez SFR, quand la connexion est en CGNAT, **le menu de redirection de
ports disparaît purement et simplement de l'interface de la box**.

Conséquence directe : **la redirection de port n'est plus une solution grand public en France**.
Elle marche encore chez une partie des abonnés, elle est impossible chez les autres, et l'utilisateur
n'a aucun moyen simple de savoir dans quel camp il est. Une solution qui en dépend produit un
parcours qui échoue chez une fraction imprévisible des clients — l'inverse du plug & play.

L'IPv6 rétablit l'adressabilité entrante et est largement déployé chez les FAI français, mais reste
inégal côté réseau mobile et côté Wi-Fi public : on ne peut pas en faire l'unique chemin.

### 3.2 Le public n'est pas technicien

Rappel du principe produit #1. Toute solution se juge en **nombre de gestes hors du produit** :
créer un compte tiers, installer une seconde application, configurer un routeur, acheter un nom de
domaine. Chacun de ces gestes est un décrochage.

### 3.3 C'est de la vidéo, et elle est intime

Deux effets. Techniquement : le débit sortant devient significatif dès qu'on quitte le JPEG 1 fps —
et certains fournisseurs **interdisent contractuellement** le transport de vidéo (§6.3). Sur la
promesse : faire transiter les images de l'intérieur d'un logement par un tiers, même chiffrées,
contredit frontalement l'invariant privacy-first. Le critère n'est pas « est-ce chiffré » mais
**« le tiers peut-il déchiffrer ? »**, c'est-à-dire *où se termine le TLS*.

### 3.4 Zéro abonnement obligatoire

Pilier du positionnement ([`BUSINESS_PLAN`](../BUSINESS_PLAN.md) §3 : vente matérielle, abonnement
support **opt-in**). Une solution dont le fonctionnement nominal exige un paiement récurrent
contredit l'argumentaire commercial contre Ring/Nest/Arlo.

---

## 4. Comment font les autres

Quatre familles, du plus « produit » au plus « homelab ».

### 4.1 Le P2P cloud constructeur — Reolink, Hikvision/Dahua, ICSee, Synology QuickConnect

L'appareil s'enregistre au démarrage auprès de serveurs du constructeur avec un identifiant unique
(UID). L'application mobile demande à ces serveurs de mettre les deux en relation : on tente d'abord
une connexion directe par perçage de NAT (STUN), et **on bascule sur un relais du constructeur quand
ça échoue**. Chez Synology, toutes les connexions QuickConnect — y compris les flux Surveillance
Station — transitent par les serveurs Synology quand le direct n'aboutit pas.

**Ce qu'on en retient** : c'est le seul modèle qui donne l'expérience « je branche, ça marche de
partout, zéro configuration ». C'est aussi celui qui a **exactement les défauts que Vyzio dénonce** :
dépendance à un service tiers, et — quand le relais est traversé sans chiffrement de bout en bout —
un tiers qui voit passer les images. Des vulnérabilités publiées sur le P2P Reolink rappellent que
cette surface est un vrai risque, pas un risque théorique.

### 4.2 Le relais du projet — Home Assistant / Nabu Casa

Le modèle de référence pour un produit local-first : l'instance à la maison **ouvre une connexion
sortante** vers un relais opéré par l'éditeur, qui achemine les requêtes du navigateur. Pas de
redirection de port, pas de certificat à gérer, un nom de domaine fourni. Nabu Casa affirme que le
trafic est chiffré de bout en bout et qu'ils ne peuvent pas le lire.

C'est un **abonnement payant qui finance le projet** — et il est frappant que le projet open source
local-first le plus abouti du marché ait choisi de faire de l'accès distant son produit payant.
Signal à retenir : c'est *le* service pour lequel les utilisateurs de self-hosted acceptent de payer.

### 4.3 Les réseaux overlay — Tailscale, NetBird, ZeroTier, WireGuard

Le consensus homelab actuel. Chaque appareil (le hub *et* le téléphone) rejoint un réseau privé
chiffré ; le plan de contrôle du fournisseur ne sert qu'à l'annuaire et au perçage de NAT, **le
trafic reste de pair à pair** (avec repli sur un relais chiffré si le direct échoue). Fonctionne
derrière CGNAT sans toucher au routeur.

C'est la recommandation dominante pour Frigate lui-même : la documentation communautaire pousse
Tailscale comme choix par défaut, en notant qu'il se configure en une dizaine de minutes et
fonctionne depuis un réseau mobile sans redirection de port ni DynDNS.

**Le coût est ailleurs** : il faut une application de plus sur le téléphone, et un compte chez le
fournisseur du plan de contrôle.

### 4.4 La publication web — Cloudflare Tunnel, reverse proxy + redirection de port

On publie l'interface sur une URL publique. Le tunnel (connexion sortante) contourne le CGNAT, gère
le certificat, et permet d'ajouter une couche d'authentification devant. Très répandu chez les
utilisateurs Frigate pour l'accès mobile.

Deux réserves de fond, développées en §6.3 : **c'est une exposition publique** (le service est
joignable par n'importe qui, seule l'authentification protège), et le fournisseur **termine le TLS**
— il voit donc les images en clair.

---

## 5. Critères de décision

Les quatre premiers sont **éliminatoires** : une solution qui en rate un est écartée, quels que
soient ses mérites par ailleurs.

| # | Critère | Ce qu'on mesure |
| --- | --- | --- |
| **E1** | **Fonctionne derrière CGNAT** | Sans intervention sur la box, chez les 4 FAI français, y compris box 4G/5G (§3.1) |
| **E2** | **Le tiers ne peut pas voir les images** | Où se termine le TLS. Chiffré de bout en bout, ou terminé chez le fournisseur ? |
| **E3** | **Pas d'abonnement obligatoire** | Le parcours nominal fonctionne-t-il sans paiement récurrent ? (§3.4) |
| **E4** | **La vidéo est contractuellement autorisée** | Les CGU du fournisseur permettent-elles ce trafic ? |
| 5 | **Friction pour un non-technicien** | Nombre de gestes hors Vyzio : compte tiers, appli supplémentaire, DNS, routeur |
| 6 | **L'accès local ne dépend pas de l'extérieur** | Si le service tiers tombe ou si Internet est coupé, le LAN continue (principe #3) |
| 7 | **Surface d'exposition** | Le service devient-il joignable par des inconnus, ou seulement par des appareils autorisés ? |
| 8 | **Souveraineté / juridiction** | Où est opéré le plan de contrôle, sous quel droit — argument commercial explicite du produit |
| 9 | **Charge d'exploitation pour Vyzio** | Faut-il opérer une infrastructure, l'astreindre, en répondre au support ? |
| 10 | **Réversibilité** | Changer de fournisseur coûte quoi ? Le plan de contrôle est-il auto-hébergeable ? |
| 11 | **Lien cliquable depuis une notification** | Une alerte Telegram peut-elle mener à l'événement dans Vyzio, depuis n'importe où ? |

Le critère 11 est le plus sous-estimé : c'est le geste réel de l'utilisateur (« je reçois une
alerte → je veux voir »). Une solution qui donne accès au produit mais pas un lien qui s'ouvre
tout seul rate le parcours principal.

---

## 6. Comparaison des solutions

### 6.1 Option A — Réseau overlay managé (Tailscale)

Un client Tailscale sur le hub, un sur le téléphone, les deux liés au même compte.

- **E1 CGNAT** ✅ — c'est sa raison d'être ; gère les cas où WireGuard nu échoue.
- **E2 Privacy** ✅ — chiffrement WireGuard de bout en bout entre les deux appareils. Tailscale
  coordonne mais ne détient pas les clés de données ; même en repli sur relais, le trafic reste
  chiffré.
- **E3 Gratuit** ✅ pour un foyer — le plan Personal couvre largement un domicile (à date : 6
  utilisateurs). ⚠️ **Mais il est explicitement réservé à l'usage non commercial.** À vérifier
  juridiquement : un particulier utilisant Tailscale chez lui reste dans les clous, mais **Vyzio ne
  peut pas préinstaller ni revendre une appliance qui en dépend** sans clarifier ce point.
- **E4 Vidéo** ✅ — aucune restriction de contenu.
- **Friction** ⚠️ — une application de plus, un compte de plus, sur *chaque* téléphone du foyer.
  C'est le vrai coût produit. Atténuation notable : le certificat HTTPS valide fourni sur le domaine
  `ts.net` supprime l'avertissement du navigateur, ce que ne fait pas le certificat auto-signé actuel.
- **Local-first** ✅ — panne du plan de contrôle : les tunnels déjà établis survivent, et le LAN
  n'est de toute façon pas concerné.
- **Exposition** ✅✅ — **le meilleur du lot** : rien n'est publié. Seuls les appareils du réseau
  privé peuvent seulement *tenter* de se connecter.
- **Souveraineté** ❌ — société américaine, plan de contrôle propriétaire et fermé (seul le client
  est open source). Contradiction directe avec l'argumentaire « pas de dépendance à un acteur US ».
- **Exploitation Vyzio** ✅ — rien à opérer.
- **Réversibilité** ⚠️ — le protocole est standard, mais le plan de contrôle n'est pas
  auto-hébergeable officiellement (Headscale est une réimplémentation communautaire).
- **Lien notification** ✅ — l'URL `ts.net` fonctionne partout, à condition que le VPN soit actif.

### 6.2 Option B — Réseau overlay auto-hébergeable (NetBird)

Même modèle technique (WireGuard, perçage de NAT, repli sur relais), mais **plan de contrôle
entièrement open source** (AGPLv3) et auto-hébergeable — management, signal et relais réunis dans un
binaire unique depuis la v0.65 (février 2026). Société allemande, hébergement UE.

- **E1 / E2 / E4** ✅ — identiques à l'option A.
- **E3 Gratuit** ✅ — et sans la zone grise commerciale : l'auto-hébergement lève la question.
- **Friction** ⚠️ — même coût qu'en A (appli + compte). En version managée, c'est équivalent à
  Tailscale ; en auto-hébergé, la friction se déplace **de l'utilisateur vers Vyzio** (§9).
- **Souveraineté** ✅ — juridiction européenne en managé, **totale** en auto-hébergé. C'est le seul
  candidat qui transforme l'accès distant en argument de vente au lieu d'une concession.
- **Exploitation Vyzio** ❌ en auto-hébergé — Vyzio devient opérateur d'un service critique :
  disponibilité, mises à jour de sécurité, astreinte, support. À ne pas sous-estimer.
- **Réversibilité** ✅✅ — la meilleure : le plan de contrôle peut être repris.
- **Maturité** ⚠️ — écosystème plus jeune que Tailscale, moins de retours terrain sur les clients
  mobiles. À valider par un essai réel avant de s'engager.

### 6.3 Option C — Tunnel de publication web (Cloudflare Tunnel)

C'est **l'option inscrite au SAD §9.2**. L'étude conclut qu'elle ne passe pas les critères
éliminatoires.

- **E1 CGNAT** ✅ — connexion sortante, contourne le CGNAT.
- **E2 Privacy** ❌ **éliminatoire** — Cloudflare **termine le TLS** : les images de l'intérieur du
  domicile transitent en clair dans son infrastructure. Incompatible avec l'invariant privacy-first,
  qui interdit de transmettre des images sans consentement explicite.
- **E4 Vidéo** ❌ **éliminatoire** — Cloudflare **interdit le streaming vidéo via son CDN** depuis
  l'origine ; les seules voies autorisées sont ses produits payants (Stream, ou Stream Delivery
  réservé aux offres Enterprise). Le live et les clips de Vyzio tombent précisément dans ce qui est
  interdit. Un produit ne peut pas être bâti sur un usage que les CGU du fournisseur proscrivent.
- **Exposition** ❌ — l'interface devient joignable par le monde entier ; seule l'authentification
  protège. Sur un produit qui filme l'intérieur d'un logement, c'est un changement de nature du
  risque, pas un réglage.
- **Friction** ⚠️ — sans domaine à soi : sous-domaine aléatoire, non mémorisable et instable. Avec
  domaine : achat + configuration DNS, hors de portée du public visé.
- **Souveraineté** ❌ — acteur US.

**Verdict** : écartée pour l'accès au produit. Le SAD §9.2 et l'annexe A doivent être corrigés — ils
inscrivent aujourd'hui une solution que ni la promesse produit ni les CGU du fournisseur ne
permettent. *Nuance* : rien n'interdit d'y recourir plus tard pour du trafic non-vidéo (une page
d'appairage, un webhook), ce qui est un tout autre besoin.

### 6.4 Option D — Relais Vyzio (modèle Nabu Casa)

Vyzio opère son propre relais : le hub ouvre une connexion sortante, l'utilisateur se connecte à
`https://<son-id>.vyzio.fr`.

- **E1** ✅ — connexion sortante.
- **E2** ✅ *à condition* de concevoir le relais en aveugle (chiffrement de bout en bout, le relais
  ne fait que transporter des octets opaques). C'est un choix d'architecture, pas un acquis : le
  faire de travers reproduit exactement le modèle constructeur dénoncé en §4.1.
- **E3** ⚠️ — techniquement gratuit possible, mais la bande passante vidéo a un coût réel et
  récurrent. En pratique cela **devient** un abonnement (c'est le modèle Nabu Casa), ce qui n'est pas
  interdit tant qu'il reste **opt-in** et qu'un chemin gratuit existe à côté.
- **Friction** ✅✅ — **la meilleure de toutes** : aucune application supplémentaire, aucun compte
  tiers, une URL qui marche dans n'importe quel navigateur. C'est la seule option qui égale
  l'expérience Ring/Nest.
- **Souveraineté** ✅✅ — infrastructure française, argument commercial direct.
- **Exploitation** ❌❌ — **le point qui tue à ce stade** : opérer un relais, c'est de la
  disponibilité 24/7, de la bande passante facturée, un plan de continuité, et une responsabilité
  juridique sur un flux vidéo intime. Hors de portée d'un projet qui n'a pas encore de base
  installée.
- **Local-first** ⚠️ — attention au piège : le relais ne doit jamais devenir le chemin par défaut y
  compris à la maison, sinon une panne du service casse un produit qui se vend comme fonctionnant
  hors ligne.

**Verdict** : la meilleure cible produit, prématurée aujourd'hui. À garder comme horizon — et
noter qu'elle est **compatible avec l'option B** : NetBird auto-hébergé aujourd'hui, c'est déjà la
moitié de l'infrastructure d'un relais Vyzio demain.

### 6.5 Option E — Redirection de port + DynDNS (baseline)

Mentionnée pour être écartée explicitement : **échoue E1** (impossible derrière CGNAT, donc chez une
part croissante et imprévisible des foyers français), friction élevée (configuration du routeur,
DynDNS, certificat), et exposition publique maximale. C'est la solution historique du homelab, pas
celle d'un produit grand public en 2026. Elle peut rester documentée comme chemin avancé pour les
utilisateurs qui la maîtrisent déjà — jamais comme parcours par défaut.

### 6.6 Synthèse

| | A — Tailscale | B — NetBird | C — Cloudflare | D — Relais Vyzio | E — Port forwarding |
| --- | :---: | :---: | :---: | :---: | :---: |
| **E1** CGNAT | ✅ | ✅ | ✅ | ✅ | ❌ |
| **E2** Tiers aveugle | ✅ | ✅ | ❌ | ✅ (par conception) | ✅ |
| **E3** Sans abonnement | ⚠️ non-commercial | ✅ | ✅ | ⚠️ | ✅ |
| **E4** Vidéo autorisée | ✅ | ✅ | ❌ | ✅ | ✅ |
| Friction utilisateur | ⚠️ appli + compte | ⚠️ appli + compte | ⚠️ DNS | ✅✅ rien | ❌ routeur |
| Exposition | ✅✅ nulle | ✅✅ nulle | ❌ publique | ⚠️ URL publique | ❌ publique |
| Souveraineté | ❌ US | ✅ UE / totale | ❌ US | ✅✅ FR | ✅ |
| Charge Vyzio | ✅ nulle | ⚠️ à ❌ | ✅ nulle | ❌❌ | ✅ nulle |
| Réversibilité | ⚠️ | ✅✅ | ⚠️ | ✅ | ✅ |
| **Statut** | **Viable** | **Viable** | **Écartée** (E2, E4) | **Viable, différée** | **Écartée** (E1) |

---

## 7. Ce que l'étude fait apparaître au passage

- **Le palier zéro est déjà là et n'est pas exploité.** Telegram fonctionne déjà de partout. Enrichir
  la notification (contexte, et à terme des commandes en retour — items déjà au backlog) couvre le
  besoin dominant « qu'est-ce qui se passe chez moi » **sans aucun problème réseau**. C'est le
  meilleur rapport valeur/effort de tout ce document, et c'est indépendant du choix ci-dessus.
- **Le certificat auto-signé devient bloquant** dès qu'on sort du LAN : un avertissement de sécurité
  rouge au premier accès distant, sur un produit de surveillance, détruit la confiance. Toute option
  retenue doit fournir un certificat valide (les options A et B le font nativement).
- **Le mode Expert restera cassé à distance** quelle que soit l'option : il pointe le navigateur vers
  Frigate sur `:5000`, hors du tunnel Vyzio (constat déjà au backlog). Un accès distant qui « marche
  sauf un écran » est un défaut visible.
- **Le vrai flux vidéo change les termes.** Passer du JPEG 1 fps ([ADR-16](../adr/0016-live-stream-access-polling-latest-jpg-through-vyzio-frigate-never-exposed.md))
  à un flux continu multiplie le débit sortant. Cela ne change rien aux options A/B (pair à pair,
  pas de coût de transit), mais c'est déterminant pour D. Décider de l'accès distant **avant** le
  flux vidéo est donc le bon ordre.

---

## 8. Ce que l'étude a produit

La direction est tranchée en deux décisions, qui sont désormais le foyer du sujet :

- **[ADR-50](../adr/0050-the-messaging-channel-becomes-bidirectional-a-channel-agnostic-command-layer.md)**
  — le canal de messagerie devient bidirectionnel, par une couche de commandes agnostique du canal.
  C'est ce qui rend l'accès réseau optionnel.
- **[ADR-51](../adr/0051-remote-access-to-the-interface-netbird-overlay-network-operated-by-the-user.md)**
  — l'accès distant à l'interface passe par un réseau overlay NetBird, guidé depuis Vyzio mais opéré
  par l'utilisateur (option B ci-dessus). Le relais Vyzio (option D) reste l'horizon, non retenu
  aujourd'hui.

Attendus produit correspondants : [SPECS](../SPECS.md) §5.4 et §7. Exécution :
[issue #63](https://github.com/KelianS/vyzio/issues/63). Le SAD a été corrigé du Cloudflare Tunnel qu'il
inscrivait (§1).

Cette étude ne conserve donc que ce que les ADR ne portent pas : le relevé de terrain, les critères,
et les options écartées avec leur mesure.

---

## Sources

Réseau et terrain français — [Orange passe au partage d'IPv4 par défaut](https://www.macg.co/ailleurs/2025/01/orange-partage-son-tour-par-defaut-les-ipv4-pour-les-abonnes-adsl-et-fibre-148513) ·
[CGNAT et disparition du NAT entrant (communauté SFR)](https://communaute.red-by-sfr.fr/t5/Box-d%C3%A9codeur-TV/Conseils-pour-acc%C3%A9der-%C3%A0-son-r%C3%A9seau-local-depuis-l-ext%C3%A9rieur/td-p/507179)

Pratiques homelab et Frigate — [Tailscale vs WireGuard vs Cloudflare Tunnel pour homelab](https://homelabaddiction.com/tailscale-vs-wireguard-vs-cloudflare-tunnel-for-homelabs-which-remote-access-model-actually-fits-your-setup/) ·
[Frigate — accès live/enregistrements depuis l'extérieur](https://github.com/blakeblackshear/frigate/discussions/13131) ·
[Frigate — Cloudflare cloudflared](https://github.com/blakeblackshear/frigate/discussions/4247) ·
[go2rtc — WebRTC via STUN/TURN](https://github.com/AlexxIT/go2rtc/issues/554)

Modèles produit — [Nabu Casa — à propos de l'accès distant](https://support.nabucasa.com/hc/en-us/articles/26469707849629-About-Home-Assistant-remote-access) ·
[Home Assistant — accès distant](https://www.home-assistant.io/docs/configuration/remote/) ·
[Synology QuickConnect (relais)](https://vboxx.eu/blog/synology-quickconnect/) ·
[Fonctionnement du P2P Reolink](https://community.reolink.com/topic/87/how-does-the-reolink-uid-actually-work) ·
[Vulnérabilités P2P Reolink (Nozomi)](https://www.nozominetworks.com/blog/new-reolink-p2p-vulnerabilities-show-iot-security-camera-risks)

Fournisseurs — [Cloudflare — restriction sur la diffusion de vidéo](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/) ·
[Tailscale — plans gratuits et usage non commercial](https://tailscale.com/docs/account/manage-plans/free-plans-discounts) ·
[NetBird vs Tailscale — plan de contrôle auto-hébergeable](https://netbird.io/knowledge-hub/tailscale-vs-netbird) ·
[Alternatives open source à Tailscale (2026)](https://itprotutorials.com/tailscale-alternatives-2026/)
