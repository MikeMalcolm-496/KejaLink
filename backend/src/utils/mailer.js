/**
 * mailer.js: sends e-mail (password resets, account notices).
 * MAIL_MODE=log  saves each e-mail as an HTML file in storage/mail (demo, no internet)
 * MAIL_MODE=smtp sends for real with nodemailer (e.g. Gmail + App Password)
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('../config/env');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function template(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#1c1b19">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e4ded2">
<tr><td style="padding:22px 32px;font-size:22px;font-weight:bold;color:#173f35">KejaLink</td></tr>
<tr><td style="padding:0 32px 28px;font-size:15px;line-height:1.6"><h2 style="font-size:19px">${escapeHtml(title)}</h2>${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e4ded2;font-size:12px;color:#6b665c">${escapeHtml(config.company)} · Nairobi, Kenya</td></tr>
</table></td></tr></table></body></html>`;
}

/** Never throws: returns true if sent (or saved). */
async function sendMail(to, subject, bodyHtml) {
  const html = template(subject, bodyHtml);
  if (config.mail.mode !== 'smtp') {
    const file = path.join(__dirname, '..', '..', 'storage', 'mail', `${Date.now()}-${to.replace(/[^a-z0-9]/gi, '_')}.html`);
    fs.writeFileSync(file, `<!-- To: ${to} | Subject: ${subject} -->\n${html}`);
    return true;
  }
  try {
    const transport = nodemailer.createTransport({
      host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465,
      auth: { user: config.mail.user, pass: config.mail.pass },
    });
    await transport.sendMail({ from: config.mail.from, to, subject, html });
    return true;
  } catch (err) {
    console.error('Mail failed:', err.message);
    return false;
  }
}

module.exports = { sendMail, escapeHtml };
