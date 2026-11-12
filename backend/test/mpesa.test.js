process.env.MPESA_ENV = 'sandbox';
process.env.MPESA_CONSUMER_KEY = 'test-consumer-key';
process.env.MPESA_CONSUMER_SECRET = 'test-consumer-secret';
process.env.MPESA_SHORTCODE = '174379';
process.env.MPESA_PASSKEY = 'test-passkey';
process.env.MPESA_CALLBACK_URL = '';

const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizePhone } = require('../src/utils/validator');
const mpesa = require('../src/utils/mpesa');

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('normalizes Kenyan phone formats for Daraja', () => {
  assert.equal(normalizePhone('0712345678'), '254712345678');
  assert.equal(normalizePhone('+254 712 345 678'), '254712345678');
});

test('sends an STK Push to Daraja using configured HTTPS callback', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/oauth/')) return jsonResponse({ access_token: 'test-token', expires_in: 3600 });
    return jsonResponse({ ResponseCode: '0', MerchantRequestID: 'merchant-1', CheckoutRequestID: 'checkout-1' });
  };

  try {
    const result = await mpesa.stkPush('254712345678', 500, 'KEJA3', 'Feature 7d', 'https://api.example.test/callback');
    assert.deepEqual(result, { merchantRequestId: 'merchant-1', checkoutRequestId: 'checkout-1' });
    assert.match(requests[0].url, /^https:\/\/sandbox\.safaricom\.co\.ke\/oauth\//);
    assert.equal(
      requests[0].options.headers.Authorization,
      `Basic ${Buffer.from('test-consumer-key:test-consumer-secret').toString('base64')}`,
    );
    assert.match(requests[1].url, /\/mpesa\/stkpush\/v1\/processrequest$/);
    assert.equal(requests[1].options.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(requests[1].options.body);
    assert.equal(body.BusinessShortCode, '174379');
    assert.equal(body.Password, Buffer.from(`174379test-passkey${body.Timestamp}`).toString('base64'));
    assert.match(body.Timestamp, /^\d{14}$/);
    assert.equal(body.TransactionType, 'CustomerPayBillOnline');
    assert.equal(body.PhoneNumber, '254712345678');
    assert.equal(body.PartyA, '254712345678');
    assert.equal(body.PartyB, '174379');
    assert.equal(body.Amount, 500);
    assert.equal(body.CallBackURL, 'https://api.example.test/callback');
    assert.equal(body.AccountReference, 'KEJA3');
    assert.equal(body.TransactionDesc, 'Feature 7d');
  } finally {
    global.fetch = originalFetch;
  }
});

test('interprets STK Query results for success and pending payments', async () => {
  const originalFetch = global.fetch;
  let response = { ResultCode: '0', ResultDesc: 'Payment confirmed' };
  global.fetch = async () => jsonResponse(response);

  try {
    const payment = { checkout_request_id: 'checkout-1' };
    assert.deepEqual(await mpesa.stkQuery(payment), {
      status: 'success',
      desc: 'Payment confirmed',
      receipt: null,
    });
    response = { ResultDesc: 'Still processing' };
    assert.deepEqual(await mpesa.stkQuery(payment), {
      status: 'pending',
      desc: 'Still processing',
      receipt: null,
    });
  } finally {
    global.fetch = originalFetch;
  }
});
