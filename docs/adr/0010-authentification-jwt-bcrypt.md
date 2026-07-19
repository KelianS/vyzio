# ADR-10 — Authentification : JWT + bcrypt

> Statut : Accepté

## Options comparées

| Option | Forces | Faiblesses |
|---|---|---|
| **JWT + refresh tokens (local)** | Local-first, autonome, simple à embarquer | Gestion sécurité à maintenir en interne |
| OAuth2/OIDC externe | Standard entreprise | Dépendance externe, moins adapté offline |
| Reverse-proxy auth uniquement | Simple dans certains déploiements | Moins portable pour une appliance grand public |

## Décision

**JWT access token (15 min) + refresh token révocable (7 jours, stocké SQLite)** avec bcrypt cost factor 12, implémenté via `Microsoft.AspNetCore.Authentication.JwtBearer`.

- Logout = suppression du refresh token en base → révocation effective
- Rate limiting login : 5 tentatives / 15 min par IP (`AspNetCoreRateLimit`)
- TLS : certificat auto-signé généré au premier démarrage (Trust On First Use)
