/**
 * Payment requests to feature an agent's listing.
 * M-Pesa STK Push is confirmed through Daraja; manual references require admin review.
 */
const config = require('../config/env');
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, normalizePhone, toInt } = require('../utils/validator');
const { audit, notify, notifyAdmins } = require('../utils/audit');
const mpesa = require('../utils/mpesa');

async function overview(req, res) {
  const id = req.user.user_id;
  const [history, listings] = await Promise.all([
    query(`select pm.*, p.title from payments pm left join properties p on p.property_id = pm.property_id
           where pm.agent_id = $1 order by pm.created_at desc limit 50`, [id]),
    query("select property_id, title, featured_until from properties where agent_id = $1 and listing_status in ('available','under_offer') order by title", [id]),
  ]);
  res.json({ history, listings, packages: config.featurePackages, simulated: mpesa.isSimulated() });
}

async function start(req, res) {
  const method = req.body.method || 'manual';
  const days = toInt(req.body.days);
  const amount = config.featurePackages[days];
  const property = await queryOne("select * from properties where property_id = $1 and agent_id = $2 and listing_status in ('available','under_offer')",
    [toInt(req.body.property_id), req.user.user_id]);
  const validator = new Validator({ ...req.body, method });
  validator.oneOf('method', ['mpesa', 'manual'], 'payment method')
    .check('property_id', !property, 'Choose one of your active listings.')
    .check('days', !amount, 'Choose a package.')
    .throwIfFailed();

  if (method === 'mpesa') return startMpesa(req, res, property, days, amount);
  return startManual(req, res, property, days, amount);
}

async function startMpesa(req, res, property, days, amount) {
  const phone = normalizePhone(req.body.phone);
  const validator = new Validator({ ...req.body, phone });
  validator.pattern('phone', /^254(7|1)\d{8}$/, 'Enter the Safaricom number that will pay, e.g. 0712345678.')
    .required('phone', 'Phone').throwIfFailed();

  const payment = await queryOne(`insert into payments (agent_id, property_id, payment_method, phone, amount, feature_days)
                                  values ($1, $2, 'mpesa', $3, $4, $5) returning *`,
  [req.user.user_id, property.property_id, phone, amount, days]);
  try {
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/mpesa-callback`;
    const result = await mpesa.stkPush(phone, amount, `KEJA${property.property_id}`, `Feature ${days}d`, callbackUrl);
    await query('update payments set merchant_request_id = $1, checkout_request_id = $2 where payment_id = $3',
      [result.merchantRequestId, result.checkoutRequestId, payment.payment_id]);
    await audit(req, 'payment_started', 'payment', payment.payment_id,
      `M-Pesa KES ${amount} to feature "${property.title}" for ${days} days`);
    res.status(201).json({
      payment_id: payment.payment_id,
      message: `Check your phone: enter your M-Pesa PIN to pay KES ${amount}.`,
    });
  } catch (error) {
    await query("update payments set payment_status = 'failed', result_desc = $1 where payment_id = $2",
      [String(error.message).slice(0, 255), payment.payment_id]);
    throw new AppError(502, `M-Pesa request failed: ${error.message} No money was taken.`);
  }
}

async function startManual(req, res, property, days, amount) {
  const reference = String(req.body.reference || '').trim();
  const validator = new Validator({ ...req.body, reference });
  validator.required('reference', 'Payment reference')
    .length('reference', 'Payment reference', 3, 100).throwIfFailed();

  const payment = await transaction(async (tx) => {
    const created = await tx.queryOne(`insert into payments (agent_id, property_id, payment_method, payment_reference, amount, feature_days)
      values ($1, $2, 'manual', $3, $4, $5) returning payment_id`,
    [req.user.user_id, property.property_id, reference, amount, days]);
    await notifyAdmins(tx, `Manual payment awaiting review: KES ${amount} for "${property.title}".`, '/admin/payments');
    return created;
  });
  await audit(req, 'payment_submitted', 'payment', payment.payment_id,
    `Manual KES ${amount} to feature "${property.title}" for ${days} days`);
  res.status(201).json({
    payment_id: payment.payment_id,
    message: 'Payment submitted. Your listing will be featured after an admin confirms it.',
  });
}

async function finalize(paymentId, status, description, receipt, req) {
  await transaction(async (tx) => {
    const payment = await tx.queryOne('select * from payments where payment_id = $1 for update', [paymentId]);
    if (!payment || payment.payment_status !== 'pending') return;

    await tx.query(`update payments set payment_status = $1, result_desc = $2,
      payment_reference = coalesce($3, payment_reference) where payment_id = $4`,
    [status, String(description || '').slice(0, 255), receipt, paymentId]);
    if (status === 'success' && payment.property_id) {
      await tx.query(`update properties set featured_until = greatest(coalesce(featured_until, now()), now()) + make_interval(days => $1)
                      where property_id = $2`, [payment.feature_days, payment.property_id]);
      await notify(tx, payment.agent_id,
        `Payment of KES ${Number(payment.amount)} received. Your listing is featured for ${payment.feature_days} days.`,
        '/agent/payments');
    }
    await audit(req, status === 'success' ? 'payment_success' : 'payment_failed',
      'payment', paymentId, `${description || ''}${receipt ? ` Receipt ${receipt}` : ''}`, payment.agent_id);
  });
}

async function status(req, res) {
  let payment = await queryOne('select * from payments where payment_id = $1 and agent_id = $2',
    [toInt(req.params.id), req.user.user_id]);
  if (!payment) throw new AppError(404, 'Payment not found.');

  if (payment.payment_status === 'pending' && payment.payment_method === 'mpesa' && payment.checkout_request_id) {
    try {
      const result = await mpesa.stkQuery(payment);
      if (result.status !== 'pending') {
        await finalize(payment.payment_id, result.status, result.desc, result.receipt, req);
      }
    } catch (error) {
      console.error('M-Pesa status query failed:', error.message);
    }
    payment = await queryOne('select * from payments where payment_id = $1', [payment.payment_id]);
  }
  res.json({ status: payment.payment_status, receipt: payment.payment_reference, desc: payment.result_desc });
}

async function callback(req, res) {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (callback?.CheckoutRequestID) {
      const payment = await queryOne(`select * from payments
        where checkout_request_id = $1 and payment_method = 'mpesa' and payment_status = 'pending'`,
      [callback.CheckoutRequestID]);
      if (payment) await verifyAndFinalizeCallback(payment, callback, req);
    }
  } catch (error) {
    console.error('M-Pesa callback processing failed:', error.message);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}

async function verifyAndFinalizeCallback(payment, callback, req) {
  const items = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
  const value = (name) => items.find((item) => item.Name === name)?.Value;
  const code = String(callback.ResultCode);
  const callbackStatus = code === '0' ? 'success' : code === '1032' ? 'cancelled' : 'failed';
  const receipt = value('MpesaReceiptNumber') ? String(value('MpesaReceiptNumber')) : null;
  const callbackAmount = Number(value('Amount'));

  if (callbackStatus === 'success'
      && (callbackAmount !== Number(payment.amount) || !receipt || receipt.length > 100)) {
    console.error(`M-Pesa callback did not match payment ${payment.payment_id}; leaving it pending.`);
    return;
  }

  const verified = await mpesa.stkQuery(payment);
  if (verified.status === 'pending' || verified.status !== callbackStatus) return;
  if (verified.status === 'success') {
    await finalize(payment.payment_id, 'success', callback.ResultDesc || verified.desc, receipt, req);
  } else {
    await finalize(payment.payment_id, verified.status, callback.ResultDesc || verified.desc, null, req);
  }
}

module.exports = { overview, start, status, callback };
