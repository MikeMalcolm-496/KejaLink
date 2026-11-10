# Deploying KejaLink (Render + Supabase, free tiers)

The database already lives on Supabase. The Render Blueprint defines a Node.js API service and a static React frontend. The frontend calls the API using `API_BASE_URL`; the API allows the frontend origin using `FRONTEND_URL`.

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
   - Set `FRONTEND_URL` to the exact static-site origin, with no trailing slash. The checked-in Blueprint currently uses `https://kejalink-1-ft8q.onrender.com`.
4. Ensure the static-site service's **Rewrite** rule maps `/*` to `/index.html`; otherwise direct React routes such as `/login` return 404. The Blueprint includes this rule.
5. Deploy/sync the Blueprint. Open the frontend's root and `/login`; both should load. Open `https://<your-api>.onrender.com/api/health` and confirm `"database": "connected"`. The frontend static service must have `API_BASE_URL` set to the API origin.

If the existing Render frontend service is not managed by this Blueprint, apply the rewrite and `API_BASE_URL` in that service's dashboard instead of creating a duplicate. Keep the actual frontend URL in backend `FRONTEND_URL`; these Render environment values are separate from the local `backend/.env` file. Do not put database credentials in frontend build variables.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Payments and account recovery
Listing-feature payments are submitted with a payment reference and remain pending until an administrator reviews them. No payment gateway or email service is configured. Users who forget their password must contact an administrator; admin-issued temporary passwords must be shared securely and changed at first login.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
