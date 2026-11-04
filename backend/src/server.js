/**
 * server.js: starts the KejaLink API.
 *
 * Request pipeline (top to bottom):
 *   security headers -> JSON body -> cookies -> who is logged in (loadUser)
 *   -> CSRF guard -> route -> error handler
 *
 * In production it also serves the built React app (frontend/dist), so the
 * whole system runs from one address.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { pool } = require('./config/db');
const { securityHeaders, csrfGuard } = require('./middleware/security');
const { loadUser } = require('./middleware/auth');
const { notFound, errorHandler, asyncHandler } = require('./middleware/errors');
const { UPLOAD_DIR } = require('./utils/storage');

const app = express();
app.set('trust proxy', 1);              // correct client IP behind a hosting proxy (for audit logs)
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', loadUser, csrfGuard);
app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('select 1');
  res.json({ ok: true, database: 'connected' });
}));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/me', require('./routes/me'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api', notFound);

// Photos saved on this server (when Supabase Storage is not configured)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

// The built React app (npm run build in /frontend). Any other path returns index.html
// so React Router can show the right page.
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`KejaLink API running on http://localhost:${config.port}`);
  pool.query('select count(*) from users')
    .then((r) => console.log(`Database connected (${r.rows[0].count} users).`))
    .catch((err) => console.error('DATABASE CONNECTION FAILED:', err.message, '\nCheck DATABASE_URL in backend/.env'));
});

module.exports = app;
