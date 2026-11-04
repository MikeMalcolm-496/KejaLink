/**
 * errors.js: one consistent way to report problems to the frontend.
 *
 *  - AppError: an expected problem with a friendly message (wrong password,
 *    slot taken, ...). Sent to the user as-is with its HTTP status.
 *  - Anything else is unexpected: the details go to storage/logs/app.log with
 *    a reference code, and the user sees a generic message quoting that code.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AppError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;          // { fieldName: 'message' } for form errors
  }
}

/** Wrap async route handlers so thrown errors reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'That API endpoint does not exist.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, fields: err.fields });
  }
  // Errors from libraries that we can explain to the user
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Each photo must be 3 MB or smaller.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
  if (err.code === '23505') return res.status(409).json({ error: 'That record already exists.' });   // unique violation
  if (err.code === '23503') return res.status(409).json({ error: 'This record is still linked to other data.' });

  const ref = crypto.randomBytes(4).toString('hex').toUpperCase();
  const line = `[${new Date().toISOString()}] REF ${ref} ${req.method} ${req.originalUrl}\n${err.stack}\n\n`;
  fs.appendFile(path.join(__dirname, '..', '..', 'storage', 'logs', 'app.log'), line, () => {});
  console.error(line);
  res.status(500).json({ error: `Something went wrong on our side. Nothing was half-saved. Reference: ${ref}`, reference: ref });
}

module.exports = { AppError, asyncHandler, notFound, errorHandler };
