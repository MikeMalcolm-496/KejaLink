/**
 * reportController.js: the report engine for admins (all data) and agents (own data).
 *
 * Each report is defined once: SQL, columns, filters, sort options, summary.
 *   GET /api/reports/:type              -> JSON preview
 *   GET /api/reports/:type?format=pdf   -> PDF with company name, logo, date,
 *                                          who generated it, filters, summary,
 *                                          table and "Page X of Y"
 *   GET /api/reports/:type?format=csv   -> CSV for Excel
 */
const path = require('path');
const PDFDocument = require('pdfkit');
const config = require('../config/env');
const { query } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { audit } = require('../utils/audit');

const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo.png');
const AGENT_TYPES = ['listings', 'viewings', 'inquiries', 'payments'];
const STATUS_OPTIONS = {
  listings: ['available', 'under_offer', 'sold', 'rented', 'removed'],
  viewings: ['requested', 'confirmed', 'rescheduled', 'declined', 'completed', 'cancelled'],
  inquiries: ['open', 'replied', 'closed'],
  payments: ['pending', 'success', 'failed', 'cancelled'],
  users: ['active', 'suspended'],
};
const TITLES = {
  listings: 'Listings report', viewings: 'Viewings report', inquiries: 'Inquiries report', payments: 'Payments report',
  users: 'User registrations report', agents: 'Agent performance report', audit: 'Activity log report',
};
const label = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

function readFilters(req) {
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const type = req.params.type;
  return {
    type,
    from: isDate(req.query.from) ? req.query.from : '',
    to: isDate(req.query.to) ? req.query.to : '',
    status: (STATUS_OPTIONS[type] || []).includes(req.query.status) ? req.query.status : '',
    location: String(req.query.location || '').slice(0, 100),
    role: ['client', 'agent', 'admin', 'super_admin'].includes(req.query.role) ? req.query.role : '',
    sort: String(req.query.sort || ''),
    dir: req.query.dir === 'asc' ? 'asc' : 'desc',
  };
}

/** Build a report. agentId limits it to one agent. Returns { title, columns, rows, summary, sorts, sort }. */
async function buildReport(f, agentId) {
  const where = ['1=1'];
  const params = [];
  const p = (value) => { params.push(value); return `$${params.length}`; };
  const range = (col) => {
    if (f.from) where.push(`${col} >= ${p(f.from)}::date`);
    if (f.to) where.push(`${col} < ${p(f.to)}::date + 1`);
  };
  const scope = (col) => { if (agentId) where.push(`${col} = ${p(agentId)}`); };
  let sql; let columns; let sorts;

  switch (f.type) {
    case 'listings':
      range('p.created_at'); scope('p.agent_id');
      if (f.status) where.push(`p.listing_status = ${p(f.status)}`);
      if (f.location) where.push(`p.location ilike ${p('%' + f.location + '%')}`);
      sorts = { created: ['p.created_at', 'Date listed'], price: ['p.price', 'Price'], views: ['p.views_count', 'Views'], location: ['p.location', 'Location'], status: ['p.listing_status', 'Status'] };
      sql = `select p.property_id id, p.title, u.full_name agent, p.location, initcap(p.property_type) ptype, initcap(p.listing_type) ltype,
               p.price, p.listing_status status, p.views_count views,
               (select count(*) from viewings v where v.property_id = p.property_id)::int viewings, to_char(p.created_at, 'DD Mon YYYY') listed
             from properties p join users u on u.user_id = p.agent_id where {WHERE}`;
      columns = { id: 'ID', title: 'Property', agent: 'Agent', location: 'Location', ptype: 'Type', ltype: 'For', price: 'Price (KES)', status: 'Status', views: 'Views', viewings: 'Viewings', listed: 'Listed' };
      break;
    case 'viewings':
      range('v.scheduled_at'); scope('p.agent_id');
      if (f.status) where.push(`v.viewing_status = ${p(f.status)}`);
      if (f.location) where.push(`p.location ilike ${p('%' + f.location + '%')}`);
      sorts = { date: ['v.scheduled_at', 'Viewing date'], status: ['v.viewing_status', 'Status'], property: ['p.title', 'Property'], booked: ['v.created_at', 'Date booked'] };
      sql = `select v.viewing_id id, to_char(v.scheduled_at, 'DD Mon YYYY HH24:MI') scheduled, p.title property, p.location, c.full_name client,
               c.phone client_phone, a.full_name agent, v.viewing_status status, to_char(v.created_at, 'DD Mon YYYY') booked
             from viewings v join properties p on p.property_id = v.property_id join users c on c.user_id = v.client_id join users a on a.user_id = p.agent_id where {WHERE}`;
      columns = { id: 'ID', scheduled: 'Date & time', property: 'Property', location: 'Location', client: 'Client', client_phone: 'Client phone', agent: 'Agent', status: 'Status', booked: 'Booked on' };
      break;
    case 'inquiries':
      range('i.created_at'); scope('p.agent_id');
      if (f.status) where.push(`i.inquiry_status = ${p(f.status)}`);
      sorts = { date: ['i.created_at', 'Date sent'], response: ['response_hours', 'Response time'], status: ['i.inquiry_status', 'Status'] };
      sql = `select i.inquiry_id id, to_char(i.created_at, 'DD Mon YYYY HH24:MI') sent, p.title property, c.full_name client, a.full_name agent,
               i.inquiry_status status, round(extract(epoch from (i.replied_at - i.created_at)) / 3600, 1)::float response_hours
             from inquiries i join properties p on p.property_id = i.property_id join users c on c.user_id = i.client_id join users a on a.user_id = p.agent_id where {WHERE}`;
      columns = { id: 'ID', sent: 'Sent', property: 'Property', client: 'Client', agent: 'Agent', status: 'Status', response_hours: 'Reply time (h)' };
      break;
    case 'payments':
      range('pm.created_at'); scope('pm.agent_id');
      if (f.status) where.push(`pm.payment_status = ${p(f.status)}`);
      sorts = { date: ['pm.created_at', 'Date'], amount: ['pm.amount', 'Amount'], status: ['pm.payment_status', 'Status'] };
      sql = `select pm.payment_id id, to_char(pm.created_at, 'DD Mon YYYY HH24:MI') paid, a.full_name agent, coalesce(p.title, 'Deleted listing') property,
               case when pm.payment_method = 'mpesa' then 'M-Pesa' else 'Manual' end method,
               pm.feature_days days, pm.amount, coalesce(pm.payment_reference, '-') reference, pm.payment_status status
             from payments pm join users a on a.user_id = pm.agent_id left join properties p on p.property_id = pm.property_id where {WHERE}`;
      columns = { id: 'ID', paid: 'Date', agent: 'Agent', property: 'Listing', method: 'Method', days: 'Days', amount: 'Amount (KES)', reference: 'Reference', status: 'Status' };
      break;
    case 'users':
      range('u.created_at');
      if (f.status) where.push(`u.account_status = ${p(f.status)}`);
      if (f.role) where.push(`u.role = ${p(f.role)}`);
      sorts = { registered: ['u.created_at', 'Registered'], name: ['u.full_name', 'Name'], role: ['u.role', 'Role'], login: ['u.last_login_at', 'Last login'] };
      sql = `select u.user_id id, u.full_name name, u.email, u.phone, u.role, u.account_status status, coalesce(a.verification_status, '-') verification,
               to_char(u.created_at, 'DD Mon YYYY') registered, coalesce(to_char(u.last_login_at, 'DD Mon YYYY HH24:MI'), 'Never') last_login
             from users u left join agent_profiles a on a.agent_id = u.user_id where {WHERE}`;
      columns = { id: 'ID', name: 'Name', email: 'Email', phone: 'Phone', role: 'Role', status: 'Status', verification: 'Agent check', registered: 'Registered', last_login: 'Last login' };
      break;
    case 'agents': {
      const d1 = p(f.from || '1970-01-01'); const d2 = p(f.to || '2999-12-31');
      sorts = { listings: ['listings', 'Listings'], viewings: ['viewings', 'Viewings'], completed: ['completed', 'Completed'], reply: ['reply_rate', 'Reply rate'], name: ['u.full_name', 'Name'] };
      sql = `select u.full_name agent, coalesce(a.agency_name, 'Independent') agency, a.licence_no licence,
               (select count(*) from properties p where p.agent_id = u.user_id and p.created_at >= ${d1}::date and p.created_at < ${d2}::date + 1)::int listings,
               (select count(*) from viewings v join properties p on p.property_id = v.property_id where p.agent_id = u.user_id and v.scheduled_at >= ${d1}::date and v.scheduled_at < ${d2}::date + 1)::int viewings,
               (select count(*) from viewings v join properties p on p.property_id = v.property_id where p.agent_id = u.user_id and v.viewing_status = 'completed' and v.scheduled_at >= ${d1}::date and v.scheduled_at < ${d2}::date + 1)::int completed,
               (select round(100.0 * avg((i.inquiry_status <> 'open')::int)) from inquiries i join properties p on p.property_id = i.property_id where p.agent_id = u.user_id and i.created_at >= ${d1}::date and i.created_at < ${d2}::date + 1)::int reply_rate
             from users u join agent_profiles a on a.agent_id = u.user_id where a.verification_status = 'approved' and {WHERE}`;
      columns = { agent: 'Agent', agency: 'Agency', licence: 'Licence', listings: 'New listings', viewings: 'Viewings', completed: 'Completed', reply_rate: 'Inquiries answered (%)' };
      break;
    }
    case 'audit':
      range('l.created_at');
      if (f.location) { const t = p('%' + f.location + '%'); where.push(`(l.action ilike ${t} or l.details ilike ${t} or u.full_name ilike ${t})`); }
      sorts = { date: ['l.created_at', 'Date'], user: ['u.full_name', 'User'], action: ['l.action', 'Action'] };
      sql = `select to_char(l.created_at, 'DD Mon YYYY HH24:MI:SS') at, coalesce(u.full_name, 'Guest') "user", coalesce(u.role, '-') role, l.action,
               concat_ws(' #', l.entity_type, l.entity_id::text) record, coalesce(l.details, '') details, l.ip_address ip
             from audit_logs l left join users u on u.user_id = l.user_id where {WHERE}`;
      columns = { at: 'Date & time', user: 'User', role: 'Role', action: 'Action', record: 'Record', details: 'Details', ip: 'IP address' };
      break;
    default:
      throw new AppError(404, 'Unknown report type.');
  }

  // Sorting: only keys from `sorts` are accepted, so user input never becomes SQL.
  const sortKey = sorts[f.sort] ? f.sort : Object.keys(sorts)[0];
  const rows = await query(`${sql.replace('{WHERE}', where.join(' and '))} order by ${sorts[sortKey][0]} ${f.dir} nulls last limit 2000`, params);

  for (const r of rows) {
    if (r.status) r.status = label(r.status);
    if (r.role) r.role = label(r.role);
    if (r.verification) r.verification = label(r.verification);
    if (r.action) r.action = label(r.action);
    if ('response_hours' in r && r.response_hours === null) r.response_hours = '-';
    if ('reply_rate' in r && r.reply_rate === null) r.reply_rate = '-';
  }

  const summary = { Records: rows.length.toLocaleString() };
  const sum = (key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
  if (f.type === 'listings' && rows.length) {
    summary['Total value (KES)'] = sum('price').toLocaleString();
    summary['Average price (KES)'] = Math.round(sum('price') / rows.length).toLocaleString();
    summary['Total views'] = sum('views').toLocaleString();
  }
  if (f.type === 'viewings' && rows.length) {
    for (const s of ['Confirmed', 'Completed', 'Declined', 'Cancelled']) summary[s] = rows.filter((r) => r.status === s).length;
  }
  if (f.type === 'payments' && rows.length) {
    const ok = rows.filter((r) => r.status === 'Success');
    summary.Successful = ok.length;
    summary['Revenue (KES)'] = ok.reduce((a, r) => a + Number(r.amount), 0).toLocaleString();
  }
  if (f.type === 'inquiries' && rows.length) {
    const times = rows.map((r) => r.response_hours).filter((t) => typeof t === 'number');
    summary['Average reply time'] = times.length ? `${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)} h` : '-';
    summary['Still open'] = rows.filter((r) => r.status === 'Open').length;
  }
  for (const r of rows) {
    if (r.price !== undefined) r.price = Number(r.price).toLocaleString();
    if (r.amount !== undefined) r.amount = Number(r.amount).toLocaleString();
  }
  return { title: TITLES[f.type], columns, rows, summary, sorts: Object.fromEntries(Object.entries(sorts).map(([k, v]) => [k, v[1]])), sort: sortKey };
}

function filterText(f) {
  const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const parts = [`Period: ${f.from ? fmt(f.from) : 'start'} to ${f.to ? fmt(f.to) : 'today'}`];
  if (f.status) parts.push(`Status: ${label(f.status)}`);
  if (f.location) parts.push(`${f.type === 'audit' ? 'Search' : 'Location'}: ${f.location}`);
  if (f.role) parts.push(`Role: ${label(f.role)}`);
  return parts.join(' · ');
}

function sendCsv(res, report) {
  const cell = (v) => {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;                 // stop "CSV injection" (formulas in Excel)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    [`${config.company} - ${report.title}`], [`Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })}`], [],
    Object.values(report.columns),
    ...report.rows.map((r) => Object.keys(report.columns).map((k) => r[k])),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${report.title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.csv"`);
  res.send('﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n'));   // BOM so Excel reads UTF-8
}

function sendPdf(res, report, f, generatedBy) {
  const keys = Object.keys(report.columns);
  const landscape = keys.length > 6;
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.title.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.pdf"`);
  doc.pipe(res);

  const green = '#173f35';
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const header = () => {
    doc.image(LOGO, left, 30, { width: 34 });
    doc.fillColor(green).font('Helvetica-Bold').fontSize(14).text(config.company, left + 44, 32);
    doc.fillColor('#6b665c').font('Helvetica').fontSize(8).text('KejaLink Property Platform · Nairobi, Kenya · support@kejalink.co.ke', left + 44, 50);
    doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' })}\nBy: ${generatedBy}`,
      left, 32, { width, align: 'right' });
    doc.moveTo(left, 70).lineTo(left + width, 70).lineWidth(1.5).strokeColor(green).stroke();
    doc.y = 80;
  };
  header();
  doc.fillColor('#1c1b19').font('Helvetica-Bold').fontSize(16).text(report.title, left, doc.y);
  doc.font('Helvetica').fontSize(8.5).fillColor('#6b665c')
    .text(`${filterText(f)} · Sorted by ${report.sorts[report.sort]} (${f.dir === 'asc' ? 'ascending' : 'descending'})`);
  doc.moveDown(0.6);

  // Summary boxes
  const entries = Object.entries(report.summary);
  const boxW = Math.min(150, (width - (entries.length - 1) * 8) / entries.length);
  const boxY = doc.y;
  entries.forEach(([k, v], i) => {
    const x = left + i * (boxW + 8);
    doc.roundedRect(x, boxY, boxW, 36, 4).fill('#e8efe9');
    doc.fillColor('#4a4740').font('Helvetica').fontSize(7.5).text(k, x + 7, boxY + 6, { width: boxW - 14 });
    doc.fillColor(green).font('Helvetica-Bold').fontSize(11).text(String(v), x + 7, boxY + 18, { width: boxW - 14 });
  });
  doc.y = boxY + 48;

  // Table
  const colW = width / keys.length;
  const drawHead = () => {
    const y = doc.y;
    doc.rect(left, y, width, 18).fill(green);
    keys.forEach((k, i) => doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5).text(report.columns[k], left + i * colW + 4, y + 5, { width: colW - 8, lineBreak: false, ellipsis: true }));
    doc.y = y + 18;
  };
  drawHead();
  report.rows.forEach((r, idx) => {
    const texts = keys.map((k) => String(r[k] === null || r[k] === undefined ? '' : r[k]));
    doc.font('Helvetica').fontSize(7.5);
    const h = Math.max(16, ...texts.map((t) => doc.heightOfString(t, { width: colW - 8 }) + 8));
    if (doc.y + h > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      header();
      drawHead();
    }
    const y = doc.y;
    if (idx % 2 === 1) doc.rect(left, y, width, h).fill('#f6f4ef');
    texts.forEach((t, i) => doc.fillColor('#1c1b19').text(t, left + i * colW + 4, y + 4, { width: colW - 8 }));
    doc.moveTo(left, y + h).lineTo(left + width, y + h).lineWidth(0.5).strokeColor('#e4ded2').stroke();
    doc.y = y + h;
  });
  if (!report.rows.length) doc.fillColor('#6b665c').fontSize(9).text('No records match these filters.', left, doc.y + 10);

  // Footer with page numbers on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 28;
    doc.fillColor('#6b665c').font('Helvetica').fontSize(7.5);
    doc.text('KejaLink · Confidential', left, y, { lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, left, y, { width, align: 'right', lineBreak: false });
  }
  doc.end();
}

// GET /api/reports/:type
async function run(req, res) {
  const isAgent = req.user.role === 'agent';
  if (isAgent && !AGENT_TYPES.includes(req.params.type)) throw new AppError(403, 'Agents can run listings, viewings, inquiries and payments reports.');
  const f = readFilters(req);
  const report = await buildReport(f, isAgent ? req.user.user_id : null);
  const format = req.query.format;
  const by = `${req.user.full_name} (${label(req.user.role)})`;
  if (format === 'pdf' || format === 'csv') {
    await audit(req, 'report_generated', 'report', null, `${report.title} (${format.toUpperCase()}) ${filterText(f)}`);
    return format === 'pdf' ? sendPdf(res, report, f, by) : sendCsv(res, report);
  }
  res.json({ ...report, rows: report.rows.slice(0, 300), totalRows: report.rows.length, filterText: filterText(f), statusOptions: STATUS_OPTIONS[f.type] || [], company: config.company });
}

module.exports = { run, AGENT_TYPES, TITLES };
