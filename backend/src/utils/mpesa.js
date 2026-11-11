/**
 * Safaricom Daraja STK Push and Query API.
 * MPESA_ENV=simulate completes locally; sandbox/live require Daraja credentials.
 */
const crypto = require('crypto');
const config = require('../config/env');

const settings = config.mpesa;
const REQUEST_TIMEOUT_MS = 12000;
const TOKEN_REFRESH_MARGIN_MS = 30000;
let cachedToken = null;
let tokenExpiresAt = 0;
let tokenRequest = null;

const isSimulated = () => settings.env === 'simulate';
const baseUrl = () => (settings.env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

function timestamp() {
  const nairobi = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return nairobi.toISOString().replace(/\D/g, '').slice(0, 14);
}

function stkPassword(value) {
  return Buffer.from(`${settings.shortcode}${settings.passkey}${value}`).toString('base64');
}

function ensureCredentials() {
  const missing = [];
  if (!settings.consumerKey) missing.push('MPESA_CONSUMER_KEY');
  if (!settings.consumerSecret) missing.push('MPESA_CONSUMER_SECRET');
  if (!settings.shortcode) missing.push('MPESA_SHORTCODE');
  if (!settings.passkey) missing.push('MPESA_PASSKEY');
  if (missing.length) throw new Error(`Missing M-Pesa configuration: ${missing.join(', ')}.`);
}

async function responseJson(response, action) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`M-Pesa ${action} returned an invalid response.`);
  }
  if (!response.ok) {
    throw new Error(data.errorMessage || data.error_description || `M-Pesa ${action} failed (HTTP ${response.status}).`);
  }
  return data;
}

async function accessToken() {
  ensureCredentials();
  if (cachedToken && Date.now() < tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) return cachedToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const auth = Buffer.from(`${settings.consumerKey}:${settings.consumerSecret}`).toString('base64');
    let response;
    try {
      response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Could not reach M-Pesa OAuth: ${error.message}`);
    }

    const data = await responseJson(response, 'OAuth');
    if (!data.access_token) throw new Error('M-Pesa OAuth did not return an access token.');
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in || 3600) * 1000);
    return cachedToken;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function darajaPost(endpoint, body, action) {
  const bearer = await accessToken();
  let response;
  try {
    response = await fetch(`${baseUrl()}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Could not reach M-Pesa ${action}: ${error.message}`);
  }
  return responseJson(response, action);
}

async function stkPush(phone, amount, reference, description, fallbackCallbackUrl) {
  if (isSimulated()) {
    return {
      merchantRequestId: `SIM-${crypto.randomBytes(6).toString('hex')}`,
      checkoutRequestId: `ws_CO_SIM${crypto.randomBytes(10).toString('hex')}`,
    };
  }

  const callbackUrl = settings.callbackUrl || fallbackCallbackUrl;
  let parsedCallback;
  try {
    parsedCallback = new URL(callbackUrl);
  } catch {
    throw new Error('Set MPESA_CALLBACK_URL to a publicly reachable HTTPS callback URL.');
  }
  if (parsedCallback.protocol !== 'https:') {
    throw new Error('MPESA_CALLBACK_URL must use HTTPS.');
  }

  const ts = timestamp();
  const data = await darajaPost('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: settings.shortcode,
    Password: stkPassword(ts),
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: settings.shortcode,
    PhoneNumber: phone,
    CallBackURL: parsedCallback.toString(),
    AccountReference: reference.slice(0, 12),
    TransactionDesc: description.slice(0, 13),
  }, 'STK Push');

  if (String(data.ResponseCode) !== '0' || !data.MerchantRequestID || !data.CheckoutRequestID) {
    throw new Error(data.errorMessage || data.ResponseDescription || 'M-Pesa rejected the STK Push request.');
  }
  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

/** Returns a normalized status based on the STK Query result. */
async function stkQuery(payment) {
  if (isSimulated()) {
    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    if (ageMs < 5000) return { status: 'pending', desc: 'Waiting for PIN', receipt: null };
    if (payment.phone === '254700000000') {
      return { status: 'cancelled', desc: 'Request cancelled by user (simulated)', receipt: null };
    }
    return {
      status: 'success',
      desc: 'The service request is processed successfully (simulated).',
      receipt: `SIM${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    };
  }

  const ts = timestamp();
  const data = await darajaPost('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: settings.shortcode,
    Password: stkPassword(ts),
    Timestamp: ts,
    CheckoutRequestID: payment.checkout_request_id,
  }, 'STK Query');

  if (data.ResultCode === undefined || data.ResultCode === null) {
    return { status: 'pending', desc: data.errorMessage || data.ResultDesc || 'Still processing', receipt: null };
  }
  const code = String(data.ResultCode);
  return {
    status: code === '0' ? 'success' : code === '1032' ? 'cancelled' : 'failed',
    desc: data.ResultDesc || '',
    receipt: null,
  };
}

module.exports = { stkPush, stkQuery, isSimulated };
