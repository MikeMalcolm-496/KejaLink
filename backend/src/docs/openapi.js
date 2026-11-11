const jsonResponse = (description, schema) => ({
  description,
  ...(schema ? { content: { 'application/json': { schema } } } : {}),
});

const errorResponse = jsonResponse('Request failed. The response includes an error message and may include field validation details.', {
  type: 'object',
  properties: {
    error: { type: 'string' },
    fields: { type: 'object', additionalProperties: true },
  },
});

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
};

const operation = (summary, tags, options = {}) => ({
  summary,
  tags: [tags],
  responses: {
    ...(options.responses || { 200: jsonResponse('Successful response.') }),
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    500: errorResponse,
  },
  ...(options.description ? { description: options.description } : {}),
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.requestBody ? { requestBody: options.requestBody } : {}),
});

const jsonBody = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema: { type: 'object', ...schema } } },
});

const idPath = (summary, tags, methods) => ({
  parameters: [idParameter],
  ...Object.fromEntries(Object.entries(methods).map(([method, options]) => [
    method,
    operation(summary, tags, options),
  ])),
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'KejaLink API',
    version: '1.0.0',
    description: [
      'REST API for KejaLink property listings and viewing management.',
      'Interactive requests use the session cookie from the same browser. Log in through the KejaLink app first to call protected endpoints.',
      'The API requires the X-KejaLink: 1 header for state-changing requests; the documentation page adds it automatically.',
    ].join('\n\n'),
  },
  servers: [{ url: '/', description: 'This KejaLink server' }],
  tags: [
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Properties' },
    { name: 'My account' },
    { name: 'Agent' },
    { name: 'Admin' },
    { name: 'Reports' },
    { name: 'Payments' },
  ],
  paths: {
    '/api/health': {
      get: operation('Check API and database health', 'Health', {
        responses: {
          200: jsonResponse('API and database are available.', {
            type: 'object',
            properties: { ok: { type: 'boolean' }, database: { type: 'string' } },
          }),
          500: errorResponse,
        },
      }),
    },
    '/api/auth/me': {
      get: operation('Get the current session, if signed in', 'Authentication'),
    },
    '/api/auth/register': {
      post: operation('Register a client or agent account', 'Authentication', {
        requestBody: jsonBody({
          required: ['full_name', 'email', 'phone', 'password', 'password_confirm', 'terms'],
          properties: {
            full_name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            password: { type: 'string', format: 'password' },
            password_confirm: { type: 'string', format: 'password' },
            role: { type: 'string', enum: ['client', 'agent'] },
            terms: { type: 'boolean' },
            licence_no: { type: 'string', description: 'Required for agent registration.' },
            agency_name: { type: 'string' },
          },
        }),
        responses: { 201: jsonResponse('Account created.') },
      }),
    },
    '/api/auth/login': {
      post: operation('Sign in and start a session', 'Authentication', {
        requestBody: jsonBody({
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        }),
      }),
    },
    '/api/auth/forgot-password': {
      post: operation('Request an administrator-assisted password reset', 'Authentication', {
        description: 'Returns the same response whether or not the email belongs to an active account. Active accounts trigger an in-app notification to administrators.',
        requestBody: jsonBody({
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        }),
        responses: {
          200: jsonResponse('If the email is registered, an administrator has been notified.'),
          422: errorResponse,
          429: errorResponse,
        },
      }),
    },
    '/api/auth/2fa': {
      post: operation('Complete a two-factor sign-in', 'Authentication', {
        requestBody: jsonBody({ required: ['code'], properties: { code: { type: 'string' } } }),
      }),
    },
    '/api/auth/logout': {
      post: operation('End the current session', 'Authentication'),
    },
    '/api/auth/change-temporary-password': {
      post: operation('Replace an administrator-issued temporary password', 'Authentication', {
        requestBody: jsonBody({
          required: ['password', 'password_confirm'],
          properties: {
            password: { type: 'string', format: 'password' },
            password_confirm: { type: 'string', format: 'password' },
          },
        }),
      }),
    },
    '/api/properties': {
      get: operation('Search public property listings', 'Properties', {
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'location', in: 'query', schema: { type: 'string' } },
          { name: 'listing_type', in: 'query', schema: { type: 'string', enum: ['rent', 'sale'] } },
          { name: 'property_type', in: 'query', schema: { type: 'string', enum: ['apartment', 'house', 'land', 'commercial'] } },
          { name: 'min_price', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'max_price', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'bedrooms', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'popular'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'per_page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 30 } },
        ],
      }),
    },
    '/api/properties/locations': {
      get: operation('List location suggestions', 'Properties'),
    },
    '/api/properties/stats': {
      get: operation('Get public listing statistics', 'Properties'),
    },
    '/api/properties/{id}': idPath('Get property details and related listings', 'Properties', {
      get: {},
    }),
    '/api/properties/{id}/slots': idPath('Get viewing availability for a date', 'Properties', {
      get: {
        parameters: [{ name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }],
      },
    }),
    '/api/properties/{id}/favourite': idPath('Save or unsave a property (client session required)', 'Properties', {
      post: {},
    }),
    '/api/properties/{id}/viewings': idPath('Request a property viewing (client session required)', 'Properties', {
      post: {
        requestBody: jsonBody({
          required: ['date', 'time'],
          properties: { date: { type: 'string', format: 'date' }, time: { type: 'string', example: '10:00' } },
        }),
      },
    }),
    '/api/properties/{id}/inquiries': idPath('Send an inquiry to the listing agent (client session required)', 'Properties', {
      post: {
        requestBody: jsonBody({
          required: ['message'],
          properties: { message: { type: 'string', minLength: 10 } },
        }),
      },
    }),
    '/api/properties/{id}/report': idPath('Report a property listing (client session required)', 'Properties', {
      post: {
        requestBody: jsonBody({
          required: ['reason'],
          properties: { reason: { type: 'string', minLength: 10, maxLength: 255 } },
        }),
      },
    }),
    '/api/me/badges': { get: operation('Get account badges and pending action counts', 'My account') },
    '/api/me/profile': {
      put: operation('Update the signed-in user profile', 'My account', {
        requestBody: jsonBody({ properties: { full_name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, agency_name: { type: 'string' }, bio: { type: 'string' } } }),
      }),
    },
    '/api/me/password': {
      put: operation('Change the signed-in user password', 'My account', {
        requestBody: jsonBody({ required: ['current_password', 'password', 'password_confirm'], properties: { current_password: { type: 'string', format: 'password' }, password: { type: 'string', format: 'password' }, password_confirm: { type: 'string', format: 'password' } } }),
      }),
    },
    '/api/me/2fa': {
      get: operation('Get two-factor authentication setup status', 'My account'),
      post: operation('Enable two-factor authentication', 'My account', {
        requestBody: jsonBody({ required: ['code'], properties: { code: { type: 'string' } } }),
      }),
      delete: operation('Disable two-factor authentication', 'My account', {
        requestBody: jsonBody({ required: ['current_password'], properties: { current_password: { type: 'string', format: 'password' } } }),
      }),
    },
    '/api/me/notifications': {
      get: operation('List notifications', 'My account', {
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } }],
      }),
    },
    '/api/me/notifications/read': {
      post: operation('Mark one or all notifications as read', 'My account', {
        requestBody: jsonBody({ properties: { id: { type: 'integer', description: 'Omit to mark all as read.' } } }, false),
      }),
    },
    '/api/me/favourites': { get: operation('List saved properties (client session required)', 'My account') },
    '/api/me/viewings': {
      get: operation('List the signed-in client viewings', 'My account', {
        parameters: [{ name: 'tab', in: 'query', schema: { type: 'string', enum: ['upcoming', 'past'] } }],
      }),
    },
    '/api/me/viewings/{id}/cancel': idPath('Cancel a viewing (client session required)', 'My account', { patch: {} }),
    '/api/me/inquiries': { get: operation('List the signed-in client inquiries', 'My account') },
    '/api/agent/dashboard': { get: operation('Get agent dashboard metrics (agent session required)', 'Agent') },
    '/api/agent/listings': {
      get: operation('List the agent properties', 'Agent'),
      post: operation('Create a property listing (approved agent session required)', 'Agent', {
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { title: { type: 'string' }, listing_type: { type: 'string', enum: ['rent', 'sale'] }, property_type: { type: 'string', enum: ['apartment', 'house', 'land', 'commercial'] }, price: { type: 'integer' }, bedrooms: { type: 'integer' }, bathrooms: { type: 'integer' }, location: { type: 'string' }, description: { type: 'string' }, photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
        responses: { 201: jsonResponse('Listing created.') },
      }),
    },
    '/api/agent/listings/{id}': idPath('Get, update, or delete an agent listing', 'Agent', {
      get: { description: 'Requires an approved agent session.' },
      put: {
        description: 'Requires an approved agent session.',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { title: { type: 'string' }, listing_type: { type: 'string', enum: ['rent', 'sale'] }, property_type: { type: 'string', enum: ['apartment', 'house', 'land', 'commercial'] }, price: { type: 'integer' }, bedrooms: { type: 'integer' }, bathrooms: { type: 'integer' }, location: { type: 'string' }, description: { type: 'string' }, photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
      },
      delete: { description: 'Requires an approved agent session.' },
    }),
    '/api/agent/listings/{id}/status': idPath('Update listing status', 'Agent', { patch: {} }),
    '/api/agent/viewings': { get: operation('List agent viewing requests', 'Agent') },
    '/api/agent/viewings/{id}': idPath('Respond to or update a viewing request', 'Agent', { patch: {} }),
    '/api/agent/inquiries': { get: operation('List inquiries for agent listings', 'Agent') },
    '/api/agent/inquiries/{id}': idPath('Respond to an inquiry', 'Agent', { patch: {} }),
    '/api/admin/overview': { get: operation('Get platform overview (admin session required)', 'Admin') },
    '/api/admin/search': {
      get: operation('Search platform records (admin session required)', 'Admin', {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      }),
    },
    '/api/admin/agents': {
      get: operation('List agents for verification (admin session required)', 'Admin', {
        parameters: [{ name: 'tab', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } }],
      }),
    },
    '/api/admin/users': {
      get: operation('List users (admin session required)', 'Admin'),
      post: operation('Create a user (admin session required)', 'Admin', {
        requestBody: jsonBody({ required: ['full_name', 'email', 'phone', 'role'], properties: { full_name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, role: { type: 'string', enum: ['client', 'agent', 'admin'] } } }),
      }),
    },
    '/api/admin/users/{id}': idPath('Get or update a user (admin session required)', 'Admin', {
      get: {},
      put: { requestBody: jsonBody({ properties: { full_name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, role: { type: 'string', enum: ['client', 'agent', 'admin'] }, account_status: { type: 'string' } } }) },
    }),
    '/api/admin/listings': { get: operation('List and moderate properties (admin session required)', 'Admin') },
    '/api/admin/viewings': { get: operation('List all viewing requests (admin session required)', 'Admin') },
    '/api/admin/payments': {
      get: operation('List featured-listing payment requests (admin session required)', 'Admin'),
    },
    '/api/admin/payments/{id}': idPath('Review a featured-listing payment request (admin session required)', 'Admin', { patch: {} }),
    '/api/admin/audit': { get: operation('Get the platform audit log (admin session required)', 'Admin') },
    '/api/admin/admins': { get: operation('List administrators (super admin session required)', 'Admin') },
    '/api/admin/actions/{action}': {
      parameters: [{ name: 'action', in: 'path', required: true, schema: { type: 'string' } }],
      post: operation('Perform an administrative action', 'Admin', {
        requestBody: jsonBody({ properties: { id: { type: 'integer' }, reason: { type: 'string' }, action: { type: 'string' } }, additionalProperties: true }, false),
      }),
    },
    '/api/reports/{type}': {
      parameters: [{ name: 'type', in: 'path', required: true, schema: { type: 'string' } }],
      get: operation('Generate a report (agent or admin session required)', 'Reports', {
        parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }],
      }),
    },
    '/api/payments': {
      get: operation('List agent featured-listing payment requests', 'Payments'),
      post: operation('Start an M-Pesa payment or submit a manual payment reference', 'Payments', {
        description: 'Requires an approved agent session. The method is optional for backwards compatibility and defaults to manual; use mpesa or manual explicitly. M-Pesa requires phone; manual requires reference.',
        requestBody: jsonBody({
          required: ['property_id', 'days'],
          properties: {
            method: { type: 'string', enum: ['mpesa', 'manual'] },
            property_id: { type: 'integer' },
            days: { type: 'integer', enum: [7, 30] },
            phone: { type: 'string', description: 'Required for M-Pesa; Kenyan mobile number.' },
            reference: { type: 'string', description: 'Required for manual payment.' },
          },
        }),
      }),
    },
    '/api/payments/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } }],
      get: operation('Check the status of an M-Pesa payment (agent session required)', 'Payments'),
    },
    '/api/payments/mpesa-callback': {
      post: operation('Safaricom STK Push result callback', 'Payments', {
        description: 'Public callback endpoint for Daraja. Successful callbacks are verified through STK Query before a listing is featured.',
        requestBody: jsonBody({ properties: { Body: { type: 'object', additionalProperties: true } } }),
      }),
    },
  },
};
