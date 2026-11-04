/**
 * crypto.js: encryption of 2FA secrets and TOTP codes (Google Authenticator).
 *
 * ENCRYPTION: a 2FA secret must be readable by the server to check codes, so
 * it cannot be hashed like a password. It is encrypted with AES-256-GCM using
 * APP_KEY from .env. Someone who steals the database alone cannot read it.
 *
 * TOTP (RFC 6238): code = HMAC-SHA1(secret, floor(time / 30 s)) cut to 6 digits.
 * The phone and the server compute it independently; equal codes prove the
 * user holds the phone that scanned the QR code.
 */
const crypto = require('crypto');
const config = require('../config/env');

function key() {
  // In development without APP_KEY, derive a key from the JWT secret so the demo still works.
  const k = config.appKey ? Buffer.from(config.appKey, 'base64') : crypto.createHash('sha256').update(config.jwtSecret).digest();
  if (k.length !== 32) throw new Error('APP_KEY must be 32 random bytes, base64-encoded.');
  return k;
}

/** Returns base64(iv | tag | ciphertext). The tag detects any tampering. */
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(stored) {
  try {
    const raw = Buffer.from(stored, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function newTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

function base32Decode(secret) {
  let bits = '';
  for (const c of secret.replace(/[^A-Z2-7]/gi, '').toUpperCase()) bits += BASE32.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step % 2 ** 32, 4);
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[19] & 0x0f;
  const value = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(value % 1000000).padStart(6, '0');
}

/** Accepts the current code and one step either side (±30 s clock drift). */
function verifyTotp(secret, code) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const now = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(totpCode(secret, now + d)), Buffer.from(clean)));
}

function totpUri(secret, email) {
  return `otpauth://totp/${encodeURIComponent('KejaLink:' + email)}?secret=${secret}&issuer=KejaLink&digits=6&period=30`;
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

module.exports = { encrypt, decrypt, newTotpSecret, totpCode, verifyTotp, totpUri, sha256 };
