/**
 * validator.js: server-side form validation.
 *
 * The React forms validate too, but anyone can bypass the browser, so every
 * request body is validated again here before it touches the database.
 *
 *   const v = new Validator(req.body);
 *   v.required('email', 'Email').email('email');
 *   v.throwIfFailed();   // -> 422 with { fields: { email: '...' } }
 */
const { AppError } = require('../middleware/errors');
const { query } = require('../config/db');

const KENYAN_PHONE = /^(\+?254|0)(7|1)\d{8}$/;

class Validator {
  constructor(data) {
    this.data = data || {};
    this.errors = {};
  }

  value(field) {
    const v = this.data[field];
    return typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v);
  }

  add(field, message) {
    if (!this.errors[field]) this.errors[field] = message;   // keep the first error per field
    return this;
  }

  required(field, label) {
    return this.value(field) === '' ? this.add(field, `${label} is required.`) : this;
  }

  email(field) {
    const v = this.value(field);
    return v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? this.add(field, 'Enter a valid email address, e.g. jane@example.com.') : this;
  }

  phone(field) {
    const v = this.value(field);
    return v && !KENYAN_PHONE.test(v) ? this.add(field, 'Enter a Kenyan phone number, e.g. 0712345678.') : this;
  }

  name(field) {
    const v = this.value(field);
    return v && !/^[\p{L} .'-]{2,100}$/u.test(v) ? this.add(field, 'Names may only contain letters, spaces, apostrophes and hyphens.') : this;
  }

  length(field, label, min, max) {
    const v = this.value(field);
    if (!v) return this;
    if (v.length < min) return this.add(field, `${label} must be at least ${min} characters.`);
    if (v.length > max) return this.add(field, `${label} must be at most ${max} characters.`);
    return this;
  }

  /** At least 8 characters with an upper-case letter, a lower-case letter and a number. */
  password(field) {
    const v = this.data[field] || '';
    if (!v) return this;
    if (v.length < 8 || !/[A-Z]/.test(v) || !/[a-z]/.test(v) || !/\d/.test(v)) {
      return this.add(field, 'Password needs at least 8 characters, including an upper-case letter, a lower-case letter and a number.');
    }
    return this;
  }

  matches(field, other, message) {
    return (this.data[field] || '') !== (this.data[other] || '') ? this.add(other, message) : this;
  }

  oneOf(field, allowed, label) {
    return !allowed.includes(this.value(field)) ? this.add(field, `Choose a valid ${label}.`) : this;
  }

  number(field, label, min, max) {
    const v = this.value(field);
    if (v === '') return this;
    const n = Number(v);
    if (!Number.isFinite(n)) return this.add(field, `${label} must be a number.`);
    if (n < min || n > max) return this.add(field, `${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
    return this;
  }

  pattern(field, regex, message) {
    const v = this.value(field);
    return v && !regex.test(v) ? this.add(field, message) : this;
  }

  check(field, failed, message) {
    return failed ? this.add(field, message) : this;
  }

  /** Checks the database for an existing value. Table/column names come from our code, never from users. */
  async unique(field, table, column, message, exceptColumn, exceptId) {
    const v = this.value(field);
    if (!v || this.errors[field]) return this;
    let sql = `select 1 from ${table} where ${column} = $1`;
    const params = [v];
    if (exceptColumn) {
      sql += ` and ${exceptColumn} <> $2`;
      params.push(exceptId);
    }
    const rows = await query(sql + ' limit 1', params);
    return rows.length ? this.add(field, message) : this;
  }

  failed() {
    return Object.keys(this.errors).length > 0;
  }

  throwIfFailed() {
    if (this.failed()) throw new AppError(422, 'Please correct the highlighted fields.', this.errors);
  }
}

/** Convert 07XXXXXXXX / +2547XXXXXXXX to 2547XXXXXXXX (the format M-Pesa expects). */
function normalizePhone(phone) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  return p;
}

/** Safe positive integer from user input, or a default. */
function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

module.exports = { Validator, normalizePhone, toInt, KENYAN_PHONE };
