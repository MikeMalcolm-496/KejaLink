/** server.js: starts the KejaLink API and serves the built React app in production. */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config/env');
const { pool } = require('./config/db');
const { securityHeaders, csrfGuard } = require('./middleware/security');
const { loadUser } = require('./middleware/auth');
const { notFound, errorHandler, asyncHandler } = require('./middleware/errors');
const { UPLOAD_DIR } = require('./utils/storage');
const openApiSpec = require('./docs/openapi');
const swaggerAssetsDir = path.dirname(require.resolve('swagger-ui-dist/swagger-ui-bundle.js'));

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({
  origin: config.frontendUrl || false,
  credentials: true,
}));
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api-docs.json', (req, res) => res.json(openApiSpec));
app.use('/swagger-ui-assets', express.static(swaggerAssetsDir, { maxAge: '1d' }));
app.get('/swagger', (req, res) => res.redirect('/swagger.html'));
app.get('/swagger.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'swagger.html')));

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

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const hasFrontend = fs.existsSync(path.join(dist, 'index.html'));
if (hasFrontend) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.use((req, res, next) =>
    req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next());
} else {
  app.get('/', (req, res) => res.status(503).type('text').send(
    'KejaLink frontend is not built. Deploy from the repository root with "npm run build" before starting the server.',
  ));
}

app.use(errorHandler);

const port = process.env.PORT || config.port;
app.listen(port, '0.0.0.0', () => {
  console.log(`KejaLink running on port ${port}`);
  console.log(hasFrontend ? 'Frontend: serving frontend/dist' : `Frontend NOT FOUND at ${dist}`);
  pool.query('select count(*) from users')
    .then((r) => console.log(`Database connected (${r.rows[0].count} users).`))
    .catch((err) => console.error('DATABASE CONNECTION FAILED:', err.message));

});

module.exports = app;