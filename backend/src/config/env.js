/**
 * env.js: reads settings from the .env file (see .env.example) in one place.
 * Every other file imports `config` instead of reading process.env directly.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = (key, fallback) => (process.env[key] !== undefined && process.env[key] !== '' ? process.env[key] : fallback);
const isProduction = env('NODE_ENV', 'development') === 'production';

const config = {
  port: Number(env('PORT', 5000)),
  isProduction,
  frontendUrl: env('FRONTEND_URL', ''),
  company: env('COMPANY_NAME', 'KejaLink Realty Solutions Ltd'),
  demoMode: env('DEMO_MODE', 'true') === 'true',              // shows demo accounts on the login page

  // Supabase: Project Settings > Database > Connection string (URI, "Session pooler")
  databaseUrl: env('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/kejalink'),
  databaseSsl: env('DATABASE_SSL', 'true') === 'true',

  // Supabase Storage for photos (Project Settings > API). Empty = save photos on this server's disk.
  supabaseUrl: env('SUPABASE_URL', ''),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY', ''),
  storageBucket: env('SUPABASE_BUCKET', 'property-images'),

  jwtSecret: env('JWT_SECRET', 'dev-only-secret-change-me'),
  // 32 random bytes, base64. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  appKey: env('APP_KEY', ''),

  loginRateLimit: Number(env('LOGIN_RATE_LIMIT', 20)),     // login attempts per IP per 15 minutes
  featurePackages: { 7: 500, 30: 1500 },                       // days -> price in KES
};

if (config.isProduction && (config.jwtSecret.startsWith('dev-only') || !config.appKey)) {
  console.error('Set JWT_SECRET and APP_KEY in .env before running in production.');
  process.exit(1);
}

module.exports = config;
