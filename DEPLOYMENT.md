# Deploying KejaLink (Render + Supabase, free tiers)

The database already lives on Supabase. The Render Blueprint defines a Node.js API service and a static React frontend. The frontend uses same-origin relative `/api` requests; Render proxies those requests to the API service so session cookies remain first-party.

## 1. Put the code on GitHub
Create a repository and push the `KejaLink-JS` folder. `.gitignore` keeps `node_modules` and `.env` out.

## 2. Create a Render web service
1. Sign in at render.com → **New → Web Service** → connect the repository.
2. Settings:
   - **Root directory:** repository root (leave empty)
   - **Build command:** `npm run build` (creates `frontend/dist`, which is ignored by Git and must be generated during deploy)
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
   - **Instance type:** Free
3. **Environment variables:** use `backend/.env.example` as a reference and set the required values on the backend web service. In particular:
   - `NODE_ENV=production`
   - `DATABASE_URL` = the Supabase **Session pooler** URI
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (needed: Render's disk is wiped on every deploy, so photos must go to Supabase Storage)
   - `JWT_SECRET`, `APP_KEY` (two different random values)
   - `MPESA_ENV=simulate` initially. This mode is offline and never takes real money. For Daraja sandbox or live, set `MPESA_ENV` to the chosen mode and configure `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, and the public HTTPS `MPESA_CALLBACK_URL`. Never add Daraja secrets to the frontend service.
   - Keep `FRONTEND_URL` set to the exact static-site origin, with no trailing slash, for CORS. The checked-in Blueprint currently uses `https://kejalink-1-ft8q.onrender.com`.
4. On the existing static-site service, remove `API_URL` and `API_BASE_URL` if present. Add a **rewrite** from `/api/*` to `https://kejalink-ipe1.onrender.com/api/*` before the catch-all rewrite from `/*` to `/index.html`. The destination must retain `/api/*`; a rule that forwards only to the backend origin returns the API root for every frontend API request. The Blueprint includes both rules, plus proxy rules for uploads and Swagger.
5. Deploy/sync the Blueprint and clear the static site's build cache. Open the frontend's root, `/login`, and `/register`; all should load. Confirm `/api/health` on both the frontend origin (proxied) and the backend origin returns `"database": "connected"`. Also confirm `/api/properties/locations` on the frontend origin returns a JSON array, not `{"name":"KejaLink API","docs":"/api-docs"}`. If it returns the latter, the deployed static-site rewrite is dropping the `/api/...` path and must be fixed in the Render dashboard or by syncing the Blueprint. The frontend uses relative API URLs, so it needs no API-origin environment variable.

If the existing Render frontend service is not managed by this Blueprint, remove `API_URL`/`API_BASE_URL` and add the same ordered proxy and SPA rewrite rules in that service's dashboard instead of creating a duplicate. These Render environment values are separate from the local `backend/.env` file. Do not put database credentials in frontend settings.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Payments and account recovery
Agents can feature a listing with M-Pesa STK Push (Daraja `simulate`, `sandbox`, or `live`) or submit an offline payment reference for administrator review. The M-Pesa callback is exposed on the backend at `/api/payments/mpesa-callback`; successful callback claims are checked against the Daraja STK Query API and expected amount before a listing is featured. The agent page also polls payment status, which can recover a result if the callback is missed while the free-tier service sleeps. Simulation mode never contacts Safaricom or takes real money.

For an existing Supabase database, run `database/05_mpesa_payments.sql` after the existing manual-payment migration. This migration is safe to rerun and repairs a missing `payment_id` generator without changing existing IDs. Fresh installations get the M-Pesa columns and generated payment IDs from `database/01_schema.sql`. Do not rerun `01_schema.sql` on a database with data; it drops and recreates the tables.

Users who forget their password can submit a request from the login page; active-account requests create in-app notifications for administrators, who must verify the requester and securely provide a temporary password. The user must change it at first login. No email service is configured.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
