const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const openApiSpec = require('../src/docs/openapi');
const authController = require('../src/controllers/authController');

test('OpenAPI document describes the deployed API', () => {
  assert.equal(openApiSpec.openapi, '3.0.3');
  assert.deepEqual(openApiSpec.servers, [{ url: '/', description: 'This KejaLink server' }]);
  assert.ok(openApiSpec.paths['/api/health'].get);
  assert.ok(openApiSpec.paths['/api/auth/login'].post);
  assert.ok(openApiSpec.paths['/api/auth/forgot-password'].post);
  assert.ok(openApiSpec.paths['/api/payments/{id}'].get);
  assert.ok(openApiSpec.paths['/api/payments/mpesa-callback'].post);
  assert.ok(openApiSpec.paths['/api/properties'].get);
});

test('Swagger UI loads the OpenAPI document and supports API testing', () => {
  const swaggerHtml = fs.readFileSync(path.join(__dirname, '..', 'swagger.html'), 'utf8');

  assert.match(swaggerHtml, /value="\/api-docs\.json"/);
  assert.match(swaggerHtml, /tryItOutEnabled:\s*true/);
  assert.match(swaggerHtml, /X-KejaLink/);
});

test('session cookies are first-party compatible', () => {
  const { cookieOptions } = require('../src/middleware/auth');

  assert.equal(cookieOptions(30).sameSite, 'lax');
});

test('current-user responses cannot be cached', async () => {
  const headers = {};
  let body;
  const res = {
    set(name, value) { headers[name] = value; return this; },
    json(value) { body = value; return this; },
  };

  await authController.me({ user: null }, res);

  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(body.user, null);
});

test('registration rejects incomplete input before writing an account', async () => {
  await assert.rejects(
    authController.register({ body: {} }, {}),
    (error) => error.status === 422 && error.fields.email === 'Email is required.',
  );
});

test('password reset requests validate email before looking up an account', async () => {
  await assert.rejects(
    authController.forgotPassword({ body: { email: 'not-an-email' } }, {}),
    (error) => error.status === 422 && error.fields.email === 'Enter a valid email address, e.g. jane@example.com.',
  );
});
