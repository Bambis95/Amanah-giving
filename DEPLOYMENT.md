# 🚀 Amanah Giving — Guide de Déploiement SaaS Pro

> Plateforme professionnelle de collecte de dons (Stripe, Orange Money, Wave)
> Contact : Khadimbaeft@gmail.com — +221 77 939 43 44 — Dakar, Sacré Cœur 3 Mermoz

---

## 📦 Contenu du projet

```
app/
├── frontend/     # Application React + TypeScript + Vite + Tailwind + shadcn/ui
├── backend/      # API Python FastAPI + SQLAlchemy + PostgreSQL
├── DEPLOYMENT.md # Ce guide
└── start_app_v2.sh
```

**Fonctionnalités incluses :**
- ✅ Page d'accueil avec statistiques, projets en vedette, témoignages
- ✅ Formulaire de don (montants prédéfinis ou personnalisés, FCFA)
- ✅ Paiement **Stripe Checkout** (carte bancaire, conversion FCFA → EUR)
- ✅ Paiements **Orange Money** et **Wave** avec référence de don générée
- ✅ Page de succès avec vérification automatique du paiement Stripe
- ✅ Page projets avec barres de progression et filtres par catégorie
- ✅ Formulaire de contact enregistré en base de données
- ✅ Authentification intégrée (gestion des dons par utilisateur)

---

## 🖥️ 1. Développement local

### Prérequis
- Node.js ≥ 18 + pnpm (`npm i -g pnpm`)
- Python ≥ 3.10
- **PostgreSQL 14+** — base de données officielle du projet (via Docker ou installation native)

### Frontend
```bash
cd app/frontend
pnpm install
pnpm run dev          # http://localhost:5173
pnpm run build        # génère dist/
```

### Backend
```bash
cd app/backend
pip install -r requirements.txt
python main.py        # http://127.0.0.1:8000 (docs: /docs)
```

### 🗄️ Base de données PostgreSQL (configuration recommandée)

PostgreSQL est la base de données officielle du projet (sécurité, transactions
atomiques, sauvegardes fiables). Le backend s'y connecte automatiquement dès que
`DATABASE_URL` est définie — aucun changement de code n'est nécessaire.

**Option A — Docker (la plus simple pour le développement local) :**
```bash
cd app
docker compose up -d          # démarre PostgreSQL 16 sur le port 5432
```
Puis dans `app/backend/.env` :
```env
DATABASE_URL=postgresql+asyncpg://amanah:amanah_secret@localhost:5432/amanah_giving
```

**Option B — PostgreSQL natif sous Windows :**
1. Installez PostgreSQL 16 depuis https://www.postgresql.org/download/windows/
   (notez le mot de passe `postgres` choisi à l'installation)
2. Créez la base de données : ouvrez **pgAdmin 4**, clic droit sur *Bases de données*
   → *Créer* → *Base de données* → nom : `amanah_giving`
   (ou en ligne de commande : `createdb -U postgres amanah_giving`)
3. Dans `app/backend/.env` :
```env
DATABASE_URL=postgresql+asyncpg://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/amanah_giving
```

**Option C — PostgreSQL managé dans le cloud (production) :**
Neon, Supabase ou Railway (offres gratuites disponibles). Copiez l'URL de
connexion dans `DATABASE_URL` en utilisant le pilote `+asyncpg` et
`?sslmode=require`.

> 💡 Sans `DATABASE_URL`, le backend retombe sur SQLite (`app.db`) : utile pour
> un test rapide sans base, mais **à ne jamais utiliser en production**.
> Les tables sont créées automatiquement au premier démarrage, avec les données
> de démonstration.

### Variables d'environnement backend (fichier `.env` dans `app/backend/`)
```env
DATABASE_URL=postgresql+asyncpg://amanah:amanah_secret@localhost:5432/amanah_giving
STRIPE_SECRET_KEY=sk_live_xxx        # ou sk_test_xxx pour tester
FRONTEND_URL=https://votre-domaine.com
PYTHON_BACKEND_URL=https://api.votre-domaine.com
```

> 💡 Sans `FRONTEND_URL`, les redirections Stripe pointent par défaut vers
> `http://localhost:5173`. **À définir impérativement en production.**

---

## 🌍 2. Mise en production avec votre nom de domaine

### Option A — VPS (recommandé, contrôle total)
1. Louer un VPS (Ubuntu 22.04) chez OVH, Scaleway, DigitalOcean…
2. Installer Nginx, Certbot, Python, Node :
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```
3. **Frontend** : `pnpm run build` puis servir `dist/` via Nginx :
   ```nginx
   server {
       server_name votre-domaine.com www.votre-domaine.com;
       root /var/www/amanah/frontend/dist;
       location / {
           try_files $uri /index.html;
       }
       location /api/ {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```
4. **Backend** : lancer avec `uvicorn main:app --host 127.0.0.1 --port 8000`
   via `systemd` ou `pm2`/`supervisor`.
5. **HTTPS gratuit** :
   ```bash
   sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
   ```
6. **DNS** (chez votre registrar) :
   - `A` → `@` → IP du VPS
   - `A` → `www` → IP du VPS

### Option B — Plateformes managées (rapide)
| Composant | Service suggéré | Réglage |
|-----------|-----------------|---------|
| Frontend  | Vercel / Netlify | Build: `pnpm run build`, dossier: `dist` |
| Backend   | Railway / Render | Start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Database  | Neon / Supabase / Railway Postgres | Copier l'URL dans `DATABASE_URL` |

Puis chez le registrar : `CNAME` frontend + `CNAME` backend (ex. `api.`).

---

## 💳 3. Configuration Stripe (paiements carte)

1. Créer un compte sur [dashboard.stripe.com](https://dashboard.stripe.com).
2. Récupérer la **clé secrète de production** (`sk_live_...`).
3. Définir `STRIPE_SECRET_KEY` dans l'environnement du backend.
4. Définir `FRONTEND_URL=https://votre-domaine.com`.
5. (Optionnel) Activer les **webhooks** Stripe vers
   `https://api.votre-domaine.com/api/v1/payment/verify` pour la confirmation
   en temps réel.
6. Tester avec une carte de test (`4242 4242 4242 4242`) en mode `sk_test_` avant
   de passer en production.

**Flux de paiement :**
```
Donateur → /donate → POST /api/v1/payment/create-checkout
        → redirection Stripe Checkout → paiement
        → /payment/success?session_id=... → POST /api/v1/payment/verify
        → don marqué "paid", montant ajouté au projet
```

**Orange Money / Wave :** instructions affichées à l'écran avec le numéro
+221 77 939 43 44 et une référence unique `DON-<id>` à vérifier manuellement.

---

## ✅ 4. Checklist avant lancement

- [ ] Base PostgreSQL active et `DATABASE_URL` configurée (jamais SQLite en production)
- [ ] Nom de domaine acheté et DNS configuré
- [ ] HTTPS actif (Certbot ou SSL plateforme)
- [ ] `STRIPE_SECRET_KEY` de **production** définie
- [ ] `FRONTEND_URL` = domaine final (redirections Stripe correctes)
- [ ] Test de don complet en mode production (1 € / 656 FCFA minimum)
- [ ] Sauvegardes base de données activées
- [ ] Coordonnées vérifiées sur la page Contact

---

## 🛠️ 5. Dépannage rapide

| Problème | Cause probable | Solution |
|----------|----------------|----------|
| Redirection Stripe vers localhost | `FRONTEND_URL` absente | Définir la variable d'env |
| Erreur "Stripe authentication failed" | Clé invalide | Vérifier `STRIPE_SECRET_KEY` |
| CORS bloqué | Origine non autorisée | Le backend autorise `.*` par défaut, vérifier le reverse-proxy |
| 500 sur `/api/v1/payment/*` | Voir logs backend | `app/backend/logs/app_*.log` |
| "connection refused" / erreur asyncpg | PostgreSQL non démarré | `docker compose up -d` ou vérifier `DATABASE_URL` |
| Mot de passe PostgreSQL refusé | Identifiants incorrects | Vérifier le mot de passe saisi à l'installation (`pg_hba.conf`) |

---

*Plateforme prête pour la production — Amanah Giving © 2026*
