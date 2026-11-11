# KejaLink: Property Listing and Viewing Management System

**React + Node.js/Express + Supabase (PostgreSQL)**. A rebuild of the PHP version with the same purpose and features.

Licensed Kenyan agents list properties; clients search, save, ask questions and **book viewings** (the main transaction); admins verify agents, moderate the platform and run reports.

---

## Folder structure

```
KejaLink-JS/
├── database/            SQL for Supabase; existing deployments also run the numbered migrations
├── backend/             Express REST API
│   ├── src/
│   │   ├── server.js        app setup: middleware order, routes, serves the built React app
│   │   ├── config/          env.js (settings), db.js (PostgreSQL pool + transactions)
│   │   ├── middleware/      auth.js (login + roles), security.js (CSRF, headers, rate limit), errors.js
│   │   ├── routes/          URL → controller for each module
│   │   ├── controllers/     auth, property, me, agent, admin, report, payment
│   │   ├── services/        viewingService.js: the main transaction and its rules
│   │   └── utils/           validator, audit + notifications, crypto (2FA), storage
│   └── .env.example         every setting, explained
├── frontend/            React app (webpack + Babel, custom CSS only)
│   ├── src/
│   │   ├── App.js           all routes
│   │   ├── api/client.js    the only file that calls the API
│   │   ├── context/         AuthContext (who is logged in), ToastContext (pop-up messages)
│   │   ├── hooks/           useApi (load data), useForm (form state + errors), useTitle
│   │   ├── components/      layouts, listing card, icons (SVG), charts (SVG), modals, form fields
│   │   ├── pages/           public, auth, client, account, agent, admin pages
│   │   └── styles/          tokens.css (colours, type, spacing) + base/layout/components/pages
│   └── webpack.config.js
├── tests/e2e.test.js    automated browser tests (Playwright)
├── docs/screenshots/    screenshots of every main screen
├── MIGRATION_PLAN.md    how each PHP page/file maps to the new stack
└── DEPLOYMENT.md        putting it online (Render + Supabase)
```

## Setup (about 15 minutes)

You need **Node.js 18 or newer** (nodejs.org) and a free **Supabase** account.

### 1. Database (Supabase)
1. Create a project at supabase.com. Save the database password you choose.
2. Open **SQL Editor > New query**, paste and **Run** each file in `database/`, in order:
   `01_schema.sql` → `02_security_and_storage.sql` → `03_demo_data.sql` (demo data is optional).
3. Check: the last script shows **users 14, properties 15, viewings 18, property_images 43**.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `backend/.env`:
- `DATABASE_URL`: Supabase > **Connect** (top bar) > **Session pooler** URI, with your password filled in.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API (for photo uploads). Leave empty to store photos on your computer instead.
- `JWT_SECRET` and `APP_KEY`: run this twice and paste each result:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

```bash
npm start                   # → "Database connected (14 users)."
```

### 3. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm start                   # opens on http://localhost:3000 (API calls go to :5000)
```
For the presentation or hosting, run `npm run build` once. The backend then serves the whole site at **http://localhost:5000**.

## Demo accounts (password `Password@123`)

| Role | Email |
|---|---|
| Super admin | superadmin@kejalink.co.ke |
| Admin | admin@kejalink.co.ke |
| Agent | wanjiru@primehomes.co.ke, brian@skylinerealty.co.ke |
| Agent (awaiting verification) | kevin@nyumbanirealty.co.ke |
| Client | amina@example.com |
| Client (suspended) | john.kariuki@example.com |

The login page has a "Demo accounts" list that fills in the form (turn it off with `DEMO_MODE=false`).

## Marking scheme → where it is

| Requirement | Where |
|---|---|
| Database: entities, normalisation, relationships | `database/01_schema.sql`: 12 tables (3NF), foreign keys with cascade rules, CHECK constraints, partial unique indexes, trigger |
| Add / delete / edit / browse / search | Listings, users, viewings, inquiries, favourites; search with 6 filters, sorting, pagination |
| Help facilities, error messages | `/help` (searchable), "?" button on every panel page, field-level validation, friendly 403/404 and crash pages |
| Main transaction | Viewing booking: `backend/src/services/viewingService.js` (row lock, business rules, database guard against double booking) |
| Levels of access | Client, Agent, Admin, Super admin; login, logout, registration, user-requested admin-assisted password reset, forced password change |
| Reports | 7 reports (admins) / 4 (agents); PDF with company name, logo, date, filters, page numbers; CSV; filters; sorting |
| Frameworks, libraries, APIs | React, React Router, Express, pg, bcryptjs, jsonwebtoken, multer, pdfkit, qrcode, Supabase Storage, Safaricom M-Pesa Daraja STK Push/Query |
| Validation, exceptions, key trapping, recovery | Same rules in browser and server; error middleware with reference codes; transactions with rollback; upload clean-up; key trapping on numeric fields; unsaved-changes warning; double-submit protection |
| Creativity | Custom design system; live slot picker; M-Pesa STK Push with admin-reviewed manual-reference fallback for featured listings; affordability and mortgage calculators; photo lightbox; drag-and-drop uploads; SVG charts; notifications |
| Security | bcrypt; parameterised SQL; httpOnly SameSite JWT cookie; CSRF header guard; rate limiting; lockout; 2FA (TOTP) with AES-256-GCM-encrypted secrets; file content checks; Row Level Security; security headers |
| Audit trail | `audit_logs` + Admin > Activity log |
| Deployment | `DEPLOYMENT.md` (Render + Supabase) |

## Running the tests
With the backend serving a fresh build and fresh demo data:
```bash
npm i -g playwright && npx playwright install chromium
MPESA_ENV=simulate node tests/e2e.test.js
```
The E2E suite creates and changes database records. Run it only against a disposable database seeded with the demo data. On PowerShell, set `$env:MPESA_ENV='simulate'` before running `node tests/e2e.test.js`.

For an existing database, run `database/05_mpesa_payments.sql` after `database/04_manual_payments.sql` to add M-Pesa fields without deleting payment history. Do not run `database/01_schema.sql` against a database containing data; that schema script drops and recreates the tables.
