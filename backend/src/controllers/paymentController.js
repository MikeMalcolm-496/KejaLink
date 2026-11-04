/**
 * paymentController.js: featuring a listing with M-Pesa.
 */
const config = require('../config/env');
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, normalizePhone, toInt } = require('../utils/validator');
const { audit, notify } = require('../utils/audit');
const mpesa = require('../utils/mpesa');

// GET /api/payments: the agent's history, packages and listings that can be featured
async function overview(req, res) {
  const id = req.user.user_id;
  const [history, listings] = await Promise.all([
    query(`select pm.*, p.title from payments pm left join properties p on p.property_id = pm.property_id
           where pm.agent_id = $1 order by pm.created_at desc limit 50`, [id]),
    query("select property_id, title, featured_until from properties where agent_id = $1 and listing_status in ('available','under_offer') order by title", [id]),
  ]);
  res.json({ history, listings, packages: config.featurePackages, simulated: mpesa.isSimulated() });
}

// POST /api/payments { property_id, days, phone }
async function start(req, res) {
  const phone = normalizePhone(req.body.phone);
  const days = toInt(req.body.days);
  const amount = config.featurePackages[days];
  const p = await queryOne("select * from properties where property_id = $1 and agent_id = $2 and listing_status in ('available','under_offer')",
    [toInt(req.body.property_id), req.user.user_id]);
  const v = new Validator({ ...req.body, phone });
  v.check('property_id', !p, 'Choose one of your active listings.')
    .pattern('phone', /^254(7|1)\d{8}$/, 'Enter the Safaricom number that will pay, e.g. 0712345678.')
    .check('days', !amount, 'Choose a package.').throwIfFailed();

  const pay = await queryOne('insert into payments (agent_id, property_id, phone, amount, feature_days) values ($1, $2, $3, $4, $5) returning *',
    [req.user.user_id, p.property_id, phone, amount, days]);
  try {
    const callback = `${req.protocol}://${req.get('host')}/api/payments/mpesa-callback`;
    const r = await mpesa.stkPush(phone, amount, `KEJA${p.property_id}`, `Feature ${days}d`, callback);
    await query('update payments set merchant_request_id = $1, checkout_request_id = $2 where payment_id = $3', [r.merchantRequestId, r.checkoutRequestId, pay.payment_id]);
    await audit(req, 'payment_started', 'payment', pay.payment_id, `KES ${amount} to feature "${p.title}" for ${days} days`);
    res.status(201).json({ payment_id: pay.payment_id, message: `Check your phone: enter your M-Pesa PIN to pay KES ${amount}.` });
  } catch (err) {
    await query("update payments set payment_status = 'failed', result_desc = $1 where payment_id = $2", [err.message.slice(0, 255), pay.payment_id]);
    throw new AppError(502, `M-Pesa request failed: ${err.message} No money was taken.`);
  }
}

/** Record the result exactly once (the callback and polling may both arrive). */
async function finalize(paymentId, status, desc, receipt, req) {
  await transaction(async (tx) => {
    const pay = await tx.queryOne('select * from payments where payment_id = $1 for update', [paymentId]);
    if (!pay || pay.payment_status !== 'pending') return;      // already handled
    await tx.query('update payments set payment_status = $1, result_desc = $2, mpesa_receipt = coalesce($3, mpesa_receipt) where payment_id = $4',
      [status, String(desc).slice(0, 255), receipt, paymentId]);
    if (status === 'success' && pay.property_id) {
      await tx.query(`update properties set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => $1)
                      where property_id = $2`, [pay.feature_days, pay.property_id]);
      await notify(tx, pay.agent_id, `Payment of KES ${Number(pay.amount)} received. Your listing is featured for ${pay.feature_days} days.`, '/agent/payments');
    }
    await audit(req, status === 'success' ? 'payment_success' : 'payment_failed', 'payment', paymentId, desc + (receipt ? ` Receipt ${receipt}` : ''), pay.agent_id);
  });
}

// GET /api/payments/:id: polled every 3 s by the payment page
async function status(req, res) {
  let pay = await queryOne('select * from payments where payment_id = $1 and agent_id = $2', [toInt(req.params.id), req.user.user_id]);
  if (!pay) throw new AppError(404, 'Payment not found.');
  if (pay.payment_status === 'pending' && pay.checkout_request_id) {
    try {
      const r = await mpesa.stkQuery(pay);
      if (r.status !== 'pending') await finalize(pay.payment_id, r.status, r.desc, r.receipt, req);
    } catch (err) {
      console.error('STK query failed:', err.message);
    }
    pay = await queryOne('select * from payments where payment_id = $1', [pay.payment_id]);
  }
  res.json({ status: pay.payment_status, receipt: pay.mpesa_receipt, desc: pay.result_desc });
}

// POST /api/payments/mpesa-callback: called by Safaricom, not by users (no login, no CSRF header)
async function callback(req, res) {
  const cb = req.body && req.body.Body && req.body.Body.stkCallback;
  if (cb && cb.CheckoutRequestID) {
    const pay = await queryOne("select * from payments where checkout_request_id = $1 and payment_status = 'pending'", [cb.CheckoutRequestID]);
    if (pay) {
      const items = (cb.CallbackMetadata && cb.CallbackMetadata.Item) || [];
      const receipt = (items.find((i) => i.Name === 'MpesaReceiptNumber') || {}).Value || null;
      const code = String(cb.ResultCode);
      await finalize(pay.payment_id, code === '0' ? 'success' : code === '1032' ? 'cancelled' : 'failed', cb.ResultDesc || '', receipt ? String(receipt) : null, req);
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });   // Safaricom expects this reply
}

module.exports = { overview, start, status, callback };
