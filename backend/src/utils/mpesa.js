/**
 * mpesa.js: Safaricom M-Pesa Daraja API (Lipa na M-Pesa Online / STK Push).
 * Agents pay to "feature" a listing (shown first in search with a star).
 *
 *   1. Get an OAuth access token with the consumer key + secret.
 *   2. Send an STK Push: Safaricom shows a PIN prompt on the agent's phone.
 *   3. Safaricom POSTs the result to our callback URL.
 *      If the callback cannot reach us (e.g. localhost), the payment page
 *      polls our server, which asks Safaricom via the STK Query API.
 *
 * MPESA_ENV=simulate  no network: payment succeeds 5 seconds later (demo).
 *                     Phone 254700000000 simulates the user cancelling.
 * MPESA_ENV=sandbox   Daraja sandbox (test money).   MPESA_ENV=live  production.
 */
const crypto = require('crypto');
const config = require('../config/env');

const m = config.mpesa;
const baseUrl = () => (m.env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');
const isSimulated = () => !['sandbox', 'live'].includes(m.env);

function timestamp() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);   // Nairobi time
  return d.toISOString().replace(/\D/g, '').slice(0, 14);
}
const password = (ts) => Buffer.from(m.shortcode + m.passkey + ts).toString('base64');

async function token() {
  const auth = Buffer.from(`${m.consumerKey}:${m.consumerSecret}`).toString('base64');
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new Error('M-Pesa rejected the API keys. Check MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.');
  return data.access_token;
}

async function stkPush(phone, amount, reference, description, callbackUrl) {
  if (isSimulated()) {
    return { merchantRequestId: 'SIM-' + crypto.randomBytes(6).toString('hex'), checkoutRequestId: 'ws_CO_SIM' + crypto.randomBytes(10).toString('hex') };
  }
  const ts = timestamp();
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: m.shortcode, Password: password(ts), Timestamp: ts, TransactionType: 'CustomerPayBillOnline',
      Amount: amount, PartyA: phone, PartyB: m.shortcode, PhoneNumber: phone,
      CallBackURL: m.callbackUrl || callbackUrl, AccountReference: reference.slice(0, 12), TransactionDesc: description.slice(0, 13),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.ResponseCode !== '0') throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa did not accept the request.');
  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

/** Returns { status: pending|success|failed|cancelled, desc, receipt } */
async function stkQuery(payment) {
  if (isSimulated()) {
    if (Date.now() - new Date(payment.created_at).getTime() < 5000) return { status: 'pending', desc: 'Waiting for PIN', receipt: null };
    if (payment.phone === '254700000000') return { status: 'cancelled', desc: 'Request cancelled by user (simulated)', receipt: null };
    return { status: 'success', desc: 'The service request is processed successfully. (simulated)', receipt: 'SIM' + crypto.randomBytes(4).toString('hex').toUpperCase() };
  }
  const ts = timestamp();
  const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: m.shortcode, Password: password(ts), Timestamp: ts, CheckoutRequestID: payment.checkout_request_id }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.ResultCode === undefined) return { status: 'pending', desc: data.errorMessage || 'Still processing', receipt: null };
  const code = String(data.ResultCode);
  return { status: code === '0' ? 'success' : code === '1032' ? 'cancelled' : 'failed', desc: data.ResultDesc || '', receipt: null };
}

module.exports = { stkPush, stkQuery, isSimulated };
