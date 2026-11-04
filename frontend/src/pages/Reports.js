/**
 * Reports: one page for admins (7 reports, all data) and agents (4 reports, own data).
 * Preview on screen, then download as PDF (logo, company, date, page numbers) or CSV.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Alert, EmptyState, Field, Loading } from '../components/ui';
import { api, downloadUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import useTitle from '../hooks/useTitle';
import { label, nairobiDate, roleLabel } from '../utils/format';

const TYPES = {
  listings: 'Listings by status', viewings: 'Viewings (bookings)', inquiries: 'Inquiries & response times', payments: 'Payments',
  users: 'User registrations', agents: 'Agent performance', audit: 'Activity log (audit trail)',
};
const AGENT_TYPES = ['listings', 'viewings', 'inquiries', 'payments'];

export default function Reports({ scope }) {
  useTitle('Reports');
  const { user } = useAuth();
  const types = scope === 'agent' ? AGENT_TYPES : Object.keys(TYPES);
  const [query] = useSearchParams();   // e.g. /admin/reports?type=users&from=... from the overview shortcut
  const [f, setF] = useState({ type: types.includes(query.get('type')) ? query.get('type') : types[0], from: query.get('from') || nairobiDate(-180), to: query.get('to') || nairobiDate(0), status: '', location: query.get('location') || '', role: '', sort: '', dir: 'desc' });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, ...(k === 'type' ? { status: '', sort: '' } : {}) });

  const generate = async (e) => {
    if (e) e.preventDefault();
    setBusy(true); setError(null);
    try { setReport(await api.get(`/reports/${f.type}`, f)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (query.get('type')) generate(); }, []);   // opened from a shortcut: show it straight away
  const params = Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== 'type'));

  return (
    <>
      <div className="page-head"><div><h1>Reports</h1><p>Choose a report, filter and sort it, then download it as a PDF or Excel (CSV) file.</p></div></div>
      <form className="card mb-6" onSubmit={generate}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <Field label="Report type" name="type"><select id="type" className="select" value={f.type} onChange={set('type')}>{types.map((t) => <option key={t} value={t}>{TYPES[t]}</option>)}</select></Field>
          <Field label="From" name="from"><input id="from" type="date" className="input" value={f.from} onChange={set('from')} /></Field>
          <Field label="To" name="to"><input id="to" type="date" className="input" value={f.to} onChange={set('to')} /></Field>
          {report && report.statusOptions.length > 0 && (
            <Field label="Status" name="status"><select id="status" className="select" value={f.status} onChange={set('status')}><option value="">All</option>{report.statusOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
          )}
          {f.type === 'users' ? (
            <Field label="Role" name="role"><select id="role" className="select" value={f.role} onChange={set('role')}><option value="">All roles</option>{['client', 'agent', 'admin', 'super_admin'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></Field>
          ) : ['listings', 'viewings', 'audit'].includes(f.type) && (
            <Field label={f.type === 'audit' ? 'Search text' : 'Location'} name="location"><input id="location" className="input" maxLength={100} value={f.location} onChange={set('location')} placeholder={f.type === 'audit' ? 'User, action or detail' : 'e.g. Kilimani'} /></Field>
          )}
          {report && (
            <Field label="Sort by" name="sort">
              <div className="input-group">
                <select id="sort" className="select" value={f.sort || report.sort} onChange={set('sort')}>{Object.entries(report.sorts).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                <select className="select" aria-label="Direction" style={{ maxWidth: 100 }} value={f.dir} onChange={set('dir')}><option value="desc">Desc</option><option value="asc">Asc</option></select>
              </div>
            </Field>
          )}
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="file" />}Generate report</button>
        <span className="xsmall muted" style={{ marginLeft: 12 }}>Tip: generate once to see the status and sort options for that report.</span>
      </form>
      {error && <Alert type="error">{error}</Alert>}
      {busy && !report && <Loading />}
      {report && (
        <div className="card">
          <div className="row-between mb-4">
            <div>
              <div className="report-head mb-2"><img src="/logo.svg" width="32" height="32" alt="" /><b style={{ color: 'var(--emerald)' }}>{report.company}</b></div>
              <h2 className="mb-0">{report.title}</h2>
              <div className="small muted">{report.filterText} · Generated {new Date().toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })} by {user.full_name}</div>
            </div>
            <div className="row">
              <a className="btn btn-primary btn-sm" href={downloadUrl(`/reports/${f.type}`, { ...params, format: 'pdf' })}><Icon name="download" size={16} />PDF</a>
              <a className="btn btn-ghost btn-sm" href={downloadUrl(`/reports/${f.type}`, { ...params, format: 'csv' })}><Icon name="file" size={16} />Excel (CSV)</a>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon name="printer" size={16} />Print</button>
            </div>
          </div>
          <div className="stats">{Object.entries(report.summary).map(([k, v]) => <div className="stat" key={k} style={{ padding: 14 }}><div className="stat-label">{k}</div><div className="stat-value" style={{ fontSize: '1.4rem' }}>{v}</div></div>)}</div>
          {report.rows.length === 0 ? <EmptyState icon="file" title="No records match these filters" /> : (
            <div className="table-wrap" style={{ maxHeight: 560 }}><table className="table">
              <thead><tr>{Object.values(report.columns).map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{report.rows.map((r, i) => <tr key={i}>{Object.keys(report.columns).map((k) => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}</tbody>
            </table></div>
          )}
          {report.totalRows > report.rows.length && <p className="small muted mt-4">Showing the first {report.rows.length} rows. The PDF and CSV include all {report.totalRows}.</p>}
        </div>
      )}
    </>
  );
}
