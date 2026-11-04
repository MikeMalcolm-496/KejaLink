# Deploying KejaLink (Render + Supabase, free tiers)

The database already lives on Supabase. You only need to host the Node.js server, which also serves the built React app.

## 1. Put the code on GitHub
Create a repository and push the `KejaLink-JS` folder. `.gitignore` keeps `node_modules` and `.env` out.

## 2. Create a Render web service
1. Sign in at render.com → **New → Web Service** → connect the repository.
2. Settings:
   - **Root directory:** *(leave empty)*
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
3. **Environment variables:** copy everything from `backend/.env.example` and fill in real values. In particular:
   - `NODE_ENV=production`
   - `DATABASE_URL` = the Supabase **Session pooler** URI
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (needed: Render's disk is wiped on every deploy, so photos must go to Supabase Storage)
   - `JWT_SECRET`, `APP_KEY` (two different random values)
   - `APP_URL=https://<your-app>.onrender.com`
4. Deploy. Open `https://<your-app>.onrender.com/api/health` and check it says **"database": "connected"**.

The free tier sleeps after 15 minutes without visitors; the first request after that takes about 30 seconds. Open the site a minute before presenting.

## 3. Real M-Pesa (Daraja sandbox)
1. Register at developer.safaricom.co.ke, create an app with **Lipa Na M-Pesa Sandbox**, and note the consumer key, consumer secret and sandbox passkey (shortcode `174379`).
2. On Render set `MPESA_ENV=sandbox`, the three values above, and
   `MPESA_CALLBACK_URL=https://<your-app>.onrender.com/api/payments/mpesa-callback`.
3. If the callback cannot reach the server, the payment page still finishes: the server asks Safaricom for the result (STK Query) every few seconds.

## 4. Real e-mail (password resets)
Set `MAIL_MODE=smtp` with an SMTP account, e.g. Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<gmail>`, `SMTP_PASS=<App Password>` (Google Account → Security → App passwords).
In `log` mode, e-mails are saved in `backend/storage/mail/` and the reset link is shown on screen, which is useful for demos.

## Maintenance
- **Backups:** Supabase → Database → Backups (daily on paid plans), or export the tables from the Table Editor as CSV.
- **Errors:** users see a reference code; find it in `backend/storage/logs/app.log` or in the Render logs.
- **Security:** rotate `JWT_SECRET` to log everyone out; rotate the database password in Supabase if it leaks.
