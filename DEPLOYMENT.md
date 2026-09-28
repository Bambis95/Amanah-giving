# Amanah Giving — Mise en ligne sur Render

Ce guide met le site en ligne en **mode « bientôt disponible »** : toutes les pages sont
visibles, mais les dons restent fermés (`DONATIONS_ENABLED=false`) jusqu'au lancement
officiel. Le fichier [`render.yaml`](render.yaml) décrit toute l'installation ; Render la
crée en une fois.

| Élément | Service Render | Adresse finale (exemple) |
|---|---|---|
| Base PostgreSQL | `amanah-db` (Basic, ~6 $/mois) | — (privée) |
| API FastAPI | `amanah-api` (Starter, ~7 $/mois) | `https://api.amanahgiving.org` |
| Site React | `amanah-site` (Static Site, gratuit) | `https://www.amanahgiving.org` |

Prix indicatifs : vérifiez-les sur render.com au moment de souscrire.

---

## 1. Ce qu'il faut avant de commencer

- Un **nom de domaine** (par ex. `amanahgiving.org`). Il est indispensable : la connexion
  utilise un cookie sécurisé qui ne fonctionne que si le site et l'API partagent le même
  domaine (`www.` et `api.`). Avec les adresses `onrender.com`, les pages s'affichent mais
  la connexion au compte et à l'admin ne marche pas.
- Un compte **GitHub** (gratuit) et un compte **Render** (carte bancaire internationale).
- Vos clés **PayDunya** (tableau de bord PayDunya → Intégrations) et le **mot de passe
  d'application Gmail** utilisé pour les emails (celui de `backend/.env`).

## 2. Mettre le code sur GitHub (dépôt privé)

1. Sur github.com : **New repository** → nom `amanah-giving` → **Private** → *Create*
   (sans README ni .gitignore).
2. Dans le dossier du projet :
   ```bash
   git remote add origin https://github.com/<votre-compte>/amanah-giving.git
   git push -u origin main
   ```
Les fichiers `.env` (mots de passe, clés) sont exclus par `.gitignore` et ne partent pas
sur GitHub. Les secrets de production se saisissent uniquement dans Render.

## 3. Créer les services sur Render

1. render.com → **New** → **Blueprint** → autorisez l'accès au dépôt `amanah-giving`.
2. Render lit `render.yaml` et demande les valeurs secrètes :

| Variable | Valeur |
|---|---|
| `FRONTEND_URL` | `https://www.amanahgiving.org` |
| `CORS_ORIGINS` | `https://amanahgiving.org` |
| `VITE_API_BASE_URL` (site) | `https://api.amanahgiving.org` |
| `VITE_SITE_URL` (site) | `https://www.amanahgiving.org` (image d'aperçu sur WhatsApp) |
| `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_PUBLIC_KEY`, `PAYDUNYA_TOKEN` | vos clés PayDunya **de test** |
| `PAYDUNYA_CALLBACK_URL` | `https://api.amanahgiving.org/api/v1/payment/paydunya/ipn` |
| `STRIPE_SECRET_KEY` | laisser vide (cartes indisponibles) |
| `SMTP_USERNAME`, `EMAIL_FROM` | votre adresse Gmail |
| `SMTP_PASSWORD` | le mot de passe d'application Gmail |

3. **Apply**. Le premier déploiement prend quelques minutes. La clé de session
   (`JWT_SECRET_KEY`) est générée automatiquement par Render.

## 4. Brancher le nom de domaine

1. Service **amanah-site** → *Settings* → **Custom Domains** → ajoutez
   `www.amanahgiving.org` (Render propose aussi la redirection depuis `amanahgiving.org`).
2. Service **amanah-api** → *Settings* → **Custom Domains** → ajoutez `api.amanahgiving.org`.
3. Chez votre registraire, créez les enregistrements DNS que Render affiche (en général des
   `CNAME` vers `….onrender.com`, et un enregistrement pour le domaine nu).
4. Attendez la vérification : Render active le **HTTPS** tout seul.

## 5. Créer le premier administrateur

1. Sur le site en ligne : **Se connecter** → **Créer un compte** avec votre email.
2. Render → service **amanah-api** → onglet **Shell** :
   ```bash
   python -m scripts.make_admin votre@email.com
   ```
3. Reconnectez-vous : vous arrivez sur `/admin`. Les administrateurs suivants se nomment
   depuis l'onglet **Utilisateurs** du tableau de bord.

Le site démarre **sans projet** (les projets de démonstration, avec des montants inventés,
ne sont pas chargés en production). Ajoutez vos vrais projets depuis l'admin.

## 6. Vérifications après la mise en ligne

- [ ] `https://api.amanahgiving.org/database/health` répond `healthy`
- [ ] Le site s'affiche en HTTPS, `/donate` montre « Les dons en ligne arrivent bientôt »
- [ ] Création de compte, connexion, déconnexion automatique, mot de passe oublié (email reçu)
- [ ] Formulaire de contact : le message apparaît dans l'admin
- [ ] Pages Confidentialité et Conditions accessibles depuis le pied de page

## 7. Le jour du lancement

À faire seulement quand l'association est déclarée et le compte PayDunya réel validé :

1. Render → **amanah-api** → **Environment** :
   - `PAYDUNYA_MODE` = `live` et les 4 clés PayDunya **de production** ;
   - `DONATIONS_ENABLED` = `true`.
2. **Save changes** : l'API redémarre avec les nouvelles valeurs.
3. Faites un vrai petit don (500 FCFA) et vérifiez : paiement, email de confirmation,
   montant ajouté au projet, don visible dans l'admin.
4. Complétez les pages légales (forme juridique, numéro d'enregistrement, hébergeur :
   Render Services, Inc.).

---

## Bon à savoir

- **Réglages en production** : modifiez les variables dans l'onglet *Environment* de Render.
  L'écran *Paramètres* de l'admin écrit dans un fichier `.env` qui n'est pas utilisé sur Render.
- **Mises à jour du site** : chaque `git push` sur `main` redéploie automatiquement ; les
  migrations de la base (`alembic upgrade head`) s'appliquent avant le démarrage.
- **Sauvegardes** : vérifiez dans la page de la base (`amanah-db`) les sauvegardes incluses
  dans votre offre, et faites en plus un export régulier avant chaque changement important.
- **Journaux** : onglet *Logs* du service `amanah-api` (niveau `INFO` : les détails des
  donateurs n'y figurent pas).
- **Emails** : Gmail limite l'envoi à quelques centaines d'emails par jour. Au-delà, passez à
  un service d'envoi (Brevo, Mailjet…) avec une adresse à votre nom de domaine.

---

## Développement local (rappel)

- Base : `docker compose up -d` (PostgreSQL dans le conteneur `amanah_postgres`).
- Backend : dans `backend/`, `venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000`
  (configuration dans `backend/.env`, modèle dans `backend/.env.example`).
- Frontend : dans `frontend/`, `pnpm install` puis `pnpm run dev` → http://localhost:3000.
- Tests : dans `backend/`, `venv\Scripts\python.exe -m pytest` (voir `backend/README.md`).
