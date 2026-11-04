/**
 * audit.js: the audit trail and in-app notifications.
 *
 * audit(req, action, ...) records WHO did WHAT to WHICH record, WHEN, and
 * FROM WHERE (IP address and browser). Every module calls it.
 * adminAction() also writes the formal moderation record (admin_actions).
 * notify() puts a message behind the bell icon of a user.
 */
const { query } = require('../config/db');

async function audit(req, action, entityType = null, entityId = null, details = null, userId = undefined) {
  try {
    const uid = userId !== undefined ? userId : req.user ? req.user.user_id : null;
    await query(
      `insert into audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [uid, action, entityType, entityId, details ? String(details).slice(0, 500) : null,
        (req.ip || '').slice(0, 45), (req.get('user-agent') || 'unknown').slice(0, 255)],
    );
  } catch (err) {
    // Logging must never break the user's action.
    console.error('Audit log failed:', err.message);
  }
}

/** db can be the pool helpers or a transaction (tx) so the record is part of the same transaction. */
async function adminAction(db, req, type, targetUserId, targetPropertyId, reason) {
  await db.query(
    `insert into admin_actions (admin_id, action_type, target_user_id, target_property_id, reason)
     values ($1, $2, $3, $4, $5)`,
    [req.user.user_id, type, targetUserId || null, targetPropertyId || null, reason || null],
  );
  await audit(req, type, targetPropertyId ? 'property' : 'user', targetPropertyId || targetUserId, reason);
}

async function notify(db, userId, message, link = null) {
  await db.query('insert into notifications (user_id, message, link) values ($1, $2, $3)',
    [userId, String(message).slice(0, 255), link]);
}

/** Notify every active admin (e.g. new agent to verify, listing reported). */
async function notifyAdmins(db, message, link) {
  const admins = await db.query("select user_id from users where role in ('admin','super_admin') and account_status = 'active'");
  for (const a of admins) await notify(db, a.user_id, message, link);
}

module.exports = { audit, adminAction, notify, notifyAdmins };
