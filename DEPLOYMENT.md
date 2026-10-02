# SENJAPO — Mise en ligne sur Render

Ce guide met le site en ligne en **mode « bientôt disponible »** : toutes les pages sont
visibles et le tableau de bord fonctionne, mais les dons en ligne restent fermés
(`DONATIONS_ENABLED=false`) jusqu'au lancement officiel. Le fichier
[`render.yaml`](render.yaml) décrit toute l'installation ; Render la crée en une fois.

| Élément | Service Render | Adresse |
|---|---|---|
| Base PostgreSQL | `senjapo-db` (Basic, ~6 $/mois) | privée |
| API FastAPI | `senjapo-api` (Starter, ~7 $/mois) | `https://senjapo-api.onrender.com` (jamais appelée directement) |
| Site React | `senjapo` (Static Site, gratuit) | `https://senjapo.onrender.com`, puis votre domaine |

Prix indicatifs : vérifiez-les sur render.com au moment de souscrire.

Le site relaie `/api/*` vers l'API (règle `rewrite` dans `render.yaml`) : le navigateur ne
parle qu'à l'adresse du site, donc la connexion fonctionne **même sans nom de domaine**.

---

## 1. Ce qu'il faut avant de commencer

- Un compte **Render** (render.com, connexion avec GitHub conseillée) et une **carte
  bancaire internationale** pour les services payants.
- L'accès au dépôt GitHub privé `Bambis95/Amanah-giving` (déjà en place).
- Pour les emails (mot de passe oublié, confirmations) : l'adresse Gmail d'envoi et son
  **mot de passe d'application** (celui de `backend/.env`). Facultatif au premier jour.
- Les clés de paiement ne sont **pas** nécessaires tant que les dons sont fermés.

## 2. Créer les services

1. render.com → **New** → **Blueprint** → choisissez le dépôt `Amanah-giving`, branche `main`.
2. Render lit `render.yaml` et demande les valeurs suivantes :

| Variable | Valeur |
|---|---|
| `FRONTEND_URL` (API) | `https://senjapo.onrender.com` |
| `CORS_ORIGINS` (API) | laisser vide |
| `VITE_SITE_URL` (site) | `https://senjapo.onrender.com` (image d'aperçu WhatsApp) |
| `PAYDUNYA_*`, `STRIPE_SECRET_KEY` | laisser vide pour l'instant |
| `SMTP_USERNAME`, `EMAIL_FROM` | l'adresse Gmail d'envoi (ou vide) |
| `SMTP_PASSWORD` | le mot de passe d'application Gmail (ou vide) |

3. **Apply**. Le premier déploiement prend 5 à 10 minutes.
4. Vérifiez les adresses données par Render : si le nom `senjapo` ou `senjapo-api` était
   déjà pris, Render ajoute un suffixe (ex. `senjapo-api-x1y2.onrender.com`). Dans ce cas,
   corrigez la ligne `destination` de la règle `/api/*` dans `render.yaml` et `FRONTEND_URL`,
   puis poussez sur `main`.

## 3. Créer le premier administrateur

1. Sur le site en ligne : **Se connecter** → **Créer un compte** avec votre email.
2. Render → service **senjapo-api** → onglet **Shell** :
   ```bash
   python -m scripts.make_admin votre@email.com
   ```
3. Reconnectez-vous : vous arrivez sur le tableau de bord. Les présidents et membres du club
   se nomment ensuite depuis **Membres & comptes**.
4. **Propriétaire technique** (le prestataire, si le contrat le prévoit), une seule fois :
   ```bash
   python -m scripts.make_owner votre@email.com
   ```
   Le compte (déjà administrateur) est alors affiché à toute l'équipe comme propriétaire technique ;
   aucun autre compte ne peut changer son rôle ni le suspendre. Lui seul transfère ou abandonne ce
   statut (*Membres & comptes*), par exemple à la passation de fin de contrat. Le script refuse s'il
   y a déjà un propriétaire.

**Journal scellé** : chaque action du Journal est liée à la précédente par une empreinte SHA-256.
*Journal → Vérifier l'intégrité* recalcule la chaîne et signale toute entrée modifiée ou supprimée,
même directement dans la base. Le dernier sceau figure dans chaque export et chaque sauvegarde par
email : conservez ces emails, ils datent l'état du journal.

Le site démarre **sans campagne** (les campagnes de démonstration, aux montants inventés, ne
sont pas chargées en production). Ajoutez les vraies campagnes depuis le tableau de bord.

## 4. Vérifications après la mise en ligne

- [ ] `https://senjapo-api.onrender.com/database/health` répond `healthy`
- [ ] Le site s'affiche en HTTPS, `/donate` montre « Les dons en ligne arrivent bientôt »
- [ ] Création de compte, connexion, déconnexion automatique
- [ ] Formulaire de contact et d'adhésion : le message apparaît dans le tableau de bord
- [ ] Aperçu du lien dans WhatsApp (logo et titre SENJAPO)

## 5. Plus tard : brancher le nom de domaine

1. Service **senjapo** → *Settings* → **Custom Domains** → ajoutez `www.<votre-domaine>`
   (et le domaine nu, redirigé).
2. Chez le registraire, créez les enregistrements DNS affichés par Render ; le HTTPS s'active seul.
3. Mettez à jour `FRONTEND_URL` (API) et `VITE_SITE_URL` (site) avec la nouvelle adresse,
   puis redéployez le site. L'API n'a pas besoin de domaine propre.

## 6. Paiements avec PayTech

PayTech (paytech.sn) encaisse Wave, Orange Money, Free Money et la carte bancaire.

**Dans le tableau de bord PayTech** → *API & APN* :

| Champ | Valeur |
|---|---|
| URL de notification (IPN) | `https://senjapo-api.onrender.com/api/v1/payment/paytech/ipn` |
| URL de redirection en cas de succès | `https://senjapo.onrender.com/payment/success` |
| URL de redirection en cas d'annulation | `https://senjapo.onrender.com/payment/cancel` |

(Chaque paiement envoie aussi ses propres adresses ; celles-ci servent de secours.)

**Dans Render** → **senjapo-api** → **Environment** :

| Variable | Valeur |
|---|---|
| `PAYMENT_PROVIDER` | `paytech` |
| `PAYTECH_API_KEY` / `PAYTECH_API_SECRET` | les deux clés de la page *API & APN* (jamais dans un message ni dans Git) |
| `PAYTECH_ENV` | `test` d'abord (PayTech prélève 100 à 150 FCFA quel que soit le montant), `prod` une fois le compte activé par PayTech |
| `PAYTECH_IPN_URL` | `https://senjapo-api.onrender.com/api/v1/payment/paytech/ipn` |

Le passage en `prod` demande l'**activation du compte par PayTech** : email à
contact@paytech.sn, objet « Activation Compte PayTech », avec NINEA, pièce d'identité,
registre de commerce, statuts, justificatif de domicile, téléphone et description de l'activité.

## 7. Le jour du lancement des dons

Quand le compte marchand est validé :

1. Render → **senjapo-api** → **Environment** : clés de paiement de production
   (`PAYTECH_ENV` = `prod`), `DONATIONS_ENABLED` = `true`.
2. **Save changes** : l'API redémarre avec les nouvelles valeurs.
3. Faites un vrai petit don (500 FCFA) et vérifiez paiement, email, montant de la campagne,
   don visible dans le tableau de bord.

---

## Bon à savoir

- **Réglages en production** : dans l'onglet *Environment* de Render (l'écran *Paramètres*
  du tableau de bord écrit un fichier `.env` qui n'est pas utilisé sur Render).
- **Mises à jour** : chaque `git push` sur `main` redéploie automatiquement ; les migrations
  de la base (`alembic upgrade head`) s'appliquent avant le démarrage.
- **Sauvegardes** : vérifiez celles incluses dans l'offre de `senjapo-db` et faites un export
  avant chaque changement important (*Réglages du site → Télécharger toutes les données*).
  En plus, chaque semaine, les administrateurs reçoivent par email une **sauvegarde automatique**
  (fichiers CSV, sans les photos), si l'envoi d'emails est configuré. `BACKUP_EMAIL_DAYS` règle
  l'intervalle en jours (7 par défaut, `0` pour l'arrêter). Chaque envoi est inscrit au Journal.
- **Alertes paiement** : si un donateur ne peut pas atteindre la page de paiement (prestataire en
  panne, clés invalides), les administrateurs reçoivent un email, au plus un par heure.
- **Surveillance du site** (gratuit, 5 minutes) : créez un compte sur **uptimerobot.com**, puis deux
  moniteurs *HTTP(s)*, toutes les 5 minutes, avec votre email en contact d'alerte :
  1. `https://senjapo.onrender.com` (le site) ;
  2. `https://senjapo-api.onrender.com/health/full` (le serveur et la base de données : il répond
     une erreur 503 si la base ne répond plus).
  Vous êtes prévenu par email (ou SMS/application) dès qu'un des deux tombe, puis quand il revient.
  Remplacez les adresses quand le nom de domaine sera branché.
- **Finances** : le **trésorier** (rôle nommé par un administrateur) et les administrateurs tiennent
  les comptes dans *Tableau de bord → Finances* ; le président les consulte. Les dons en ligne y sont
  comptés automatiquement ; tout le reste (subventions, cotisations, espèces, dépenses) se saisit avec
  son justificatif. Une écriture ne s'efface jamais : elle s'annule avec un motif, visible dans le Journal.
- **Code de connexion** : les présidents et administrateurs reçoivent un code à 6 chiffres par
  email à chaque connexion. Si aucun email ne peut partir (SMTP absent ou en panne), la connexion
  se fait sans code et le **Journal** le signale (« Connexion sans code ») : vérifiez alors les
  réglages `SMTP_*`. `LOGIN_CODE_REQUIRED=false` désactive le code (déconseillé).
- **Emails** : Gmail limite l'envoi à quelques centaines par jour ; au-delà, passez à un
  service d'envoi (Brevo, Mailjet…) avec une adresse à votre nom de domaine.

---

## Développement local (rappel)

- Base : `docker compose up -d` (PostgreSQL dans le conteneur `amanah_postgres`).
- Backend : dans `backend/`, `venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000`
  (configuration dans `backend/.env`, modèle dans `backend/.env.example`).
- Frontend : dans `frontend/`, `pnpm install` puis `pnpm run dev` → http://localhost:3000.
- Tests : dans `backend/`, `venv\Scripts\python.exe -m pytest` (voir `backend/README.md`).
