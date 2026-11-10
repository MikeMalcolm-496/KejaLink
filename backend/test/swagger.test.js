const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const openApiSpec = require('../src/docs/openapi');

test('OpenAPI document describes the deployed API', () => {
  assert.equal(openApiSpec.openapi, '3.0.3');
  assert.deepEqual(openApiSpec.servers, [{ url: '/', description: 'This KejaLink server' }]);
  assert.ok(openApiSpec.paths['/api/health'].get);
  assert.ok(openApiSpec.paths['/api/auth/login'].post);
  assert.ok(openApiSpec.paths['/api/properties'].get);
});

test('Swagger UI loads the OpenAPI document and supports API testing', () => {
  const swaggerHtml = fs.readFileSync(path.join(__dirname, '..', 'swagger.html'), 'utf8');

  assert.match(swaggerHtml, /value="\/api-docs\.json"/);
  assert.match(swaggerHtml, /tryItOutEnabled:\s*true/);
  assert.match(swaggerHtml, /X-KejaLink/);
});
