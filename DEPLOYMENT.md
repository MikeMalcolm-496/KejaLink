# Deploying KejaLink (Render + Supabase, free tiers)

The database already lives on Supabase. Deploy one Render web service for the Node.js API and built frontend. This keeps login and API requests on the same origin.

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
3. **Environment variables:** use `backend/.env.example` as a reference and set the required values in Render. In particular:
   - `NODE_ENV=production`
   - `DATABASE_URL` = the Supabase **Session pooler** URI
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (needed: Render's disk is wiped on every deploy, so photos must go to Supabase Storage)
   - `JWT_SECRET`, `APP_KEY` (two different random values)
   - Leave `FRONTEND_URL` unset for this single-service, same-origin deployment.
4. Deploy. Open `https://<your-app>.onrender.com/api/health` and check it says **"database": "connected"**. Open the same service's root URL and `/login`; both should serve the app.

The repository includes a [`render.yaml`](./render.yaml) Blueprint with the root directory and build/start commands. If `/api/health` works but `/login` returns 404, the running service is stale or its build did not produce `frontend/dist`. Sync the Blueprint or update the service to use the settings above, trigger a new deploy, and confirm the build log runs `npm run build` successfully.

If you intentionally host the frontend on a separate static site, configure a Render rewrite from `/*` to `/index.html` so direct routes such as `/login` work. Set the frontend build variable `API_BASE_URL` to the backend origin and set backend `FRONTEND_URL` to the frontend's exact origin (no trailing slash), then redeploy both services. Do not put database credentials in frontend build variables.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Payments and account recovery
Listing-feature payments are submitted with a payment reference and remain pending until an administrator reviews them. No payment gateway or email service is configured. Users who forget their password must contact an administrator; admin-issued temporary passwords must be shared securely and changed at first login.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
