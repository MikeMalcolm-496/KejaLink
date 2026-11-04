/** Payment requests for featuring an agent's listing. */
const config = require('../config/env');
const { query, queryOne, transaction } = require('../config/db');
const { Validator, toInt } = require('../utils/validator');
const { audit, notifyAdmins } = require('../utils/audit');

// GET /api/payments: the agent's history, packages and listings that can be featured
async function overview(req, res) {
  const id = req.user.user_id;
  const [history, listings] = await Promise.all([
    query(`select pm.*, p.title from payments pm left join properties p on p.property_id = pm.property_id
           where pm.agent_id = $1 order by pm.created_at desc limit 50`, [id]),
    query("select property_id, title, featured_until from properties where agent_id = $1 and listing_status in ('available','under_offer') order by title", [id]),
  ]);
  res.json({ history, listings, packages: config.featurePackages });
}

// POST /api/payments { property_id, days, reference }
async function start(req, res) {
  const reference = String(req.body.reference || '').trim();
  const days = toInt(req.body.days);
  const amount = config.featurePackages[days];
  const p = await queryOne("select * from properties where property_id = $1 and agent_id = $2 and listing_status in ('available','under_offer')",
    [toInt(req.body.property_id), req.user.user_id]);
  const v = new Validator({ ...req.body, reference });
  v.check('property_id', !p, 'Choose one of your active listings.')
    .check('days', !amount, 'Choose a package.')
    .required('reference', 'Payment reference')
    .length('reference', 'Payment reference', 3, 100).throwIfFailed();

  const pay = await transaction(async (tx) => {
    const payment = await tx.queryOne(`insert into payments (agent_id, property_id, payment_method, payment_reference, amount, feature_days)
      values ($1, $2, 'manual', $3, $4, $5) returning payment_id`,
    [req.user.user_id, p.property_id, reference, amount, days]);
    await notifyAdmins(tx, `Manual payment awaiting review: KES ${amount} for "${p.title}".`, '/admin/payments');
    return payment;
  });
  await audit(req, 'payment_submitted', 'payment', pay.payment_id, `KES ${amount} to feature "${p.title}" for ${days} days`);
  res.status(201).json({ payment_id: pay.payment_id, message: 'Payment submitted. Your listing will be featured after an admin confirms it.' });
}

module.exports = { overview, start };
