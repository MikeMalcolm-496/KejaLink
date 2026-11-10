# Deploying KejaLink (Render + Supabase, free tiers)

The database already lives on Supabase. You only need to host the Node.js server, which also serves the built frontend.

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
3. **Environment variables:** copy everything from `backend/.env.example` and fill in real values. In particular:
   - `NODE_ENV=production`
   - `DATABASE_URL` = the Supabase **Session pooler** URI
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (needed: Render's disk is wiped on every deploy, so photos must go to Supabase Storage)
   - `JWT_SECRET`, `APP_KEY` (two different random values)
   - `FRONTEND_URL` = the separately hosted frontend's exact origin (`https://kejalink-1-ft8q.onrender.com`, no trailing slash). Leave it unset only when the frontend and API use the same origin.
4. If the frontend is a separate Render service, set its build environment variable `API_BASE_URL` to the backend origin (`https://kejalink-ipe1.onrender.com`, no trailing slash), then redeploy it. This makes API requests, downloads, and local `/uploads/` images use the backend service. The default empty value keeps same-origin deployments working.
5. Deploy. Open `https://<your-app>.onrender.com/api/health` and check it says **"database": "connected"**.

The repository includes a [`render.yaml`](./render.yaml) Blueprint with the root directory and build/start commands. If a running service shows `Cannot GET /` while `/api/health` works, its deployment is serving the API without the built frontend. Update that service to use the settings above (or create/sync it as a Blueprint), then trigger a new deploy and confirm the build log runs `npm run build` successfully.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Payments and account recovery
Listing-feature payments are submitted with a payment reference and remain pending until an administrator reviews them. No payment gateway or email service is configured. Users who forget their password must contact an administrator; admin-issued temporary passwords must be shared securely and changed at first login.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
