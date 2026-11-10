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
   - Keep `FRONTEND_URL` set to the exact static-site origin, with no trailing slash, for CORS. The checked-in Blueprint currently uses `https://kejalink-1-ft8q.onrender.com`.
4. On the existing static-site service, remove `API_URL` and `API_BASE_URL` if present. Add a rewrite from `/api/*` to `https://kejalink-ipe1.onrender.com/api/*` before the catch-all rewrite from `/*` to `/index.html`. The Blueprint includes both rules, plus proxy rules for uploads and Swagger.
5. Deploy/sync the Blueprint and clear the static site's build cache. Open the frontend's root, `/login`, and `/register`; all should load. Confirm `/api/health` on both the frontend origin (proxied) and the backend origin returns `"database": "connected"`. The frontend uses relative API URLs, so it needs no API-origin environment variable.

If the existing Render frontend service is not managed by this Blueprint, remove `API_URL`/`API_BASE_URL` and add the same ordered proxy and SPA rewrite rules in that service's dashboard instead of creating a duplicate. These Render environment values are separate from the local `backend/.env` file. Do not put database credentials in frontend settings.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Payments and account recovery
Listing-feature payments are submitted with a payment reference and remain pending until an administrator reviews them. No payment gateway or email service is configured. Users who forget their password must contact an administrator; admin-issued temporary passwords must be shared securely and changed at first login.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
