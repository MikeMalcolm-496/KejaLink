/** Admin overview: totals, pending verifications, moderation search, report shortcut, charts, recent activity. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { BarChart, StackedBars } from '../../components/Charts';
import { Alert, EmptyState, Loading, LoadError, StatCard, StatusBadge } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import useAdminAction from './useAdminAction';
import { fmtDate, fmtDateTime, label, money, nairobiDate, roleLabel } from '../../utils/format';

export default function Overview() {
  useTitle('Admin overview');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi('/admin/overview');
  const act = useAdminAction(reload);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [rep, setRep] = useState({ type: 'listings', from: nairobiDate(-30), to: nairobiDate(0) });

  const search = async (e) => { e.preventDefault(); if (q.trim()) setFound(await api.get('/admin/search', { q })); };
  const canManage = (u) => u.user_id !== user.user_id && (user.role === 'super_admin' || !['admin', 'super_admin'].includes(u.role));

  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  const s = data.stats;
  return (
    <>
      <div className="page-head"><div><span className="eyebrow">{roleLabel(user.role)}</span><h1>Overview</h1></div></div>
      <div className="stats">
        <StatCard label="Registered users" value={s.users} icon="users" to="/admin/users" />
        <StatCard label="Agents awaiting verification" value={s.pending_agents} icon="id" highlight={s.pending_agents > 0} to="/admin/agents" />
        <StatCard label="Active listings" value={s.active_listings} icon="building" to="/admin/listings" />
        <StatCard label="Viewings this month" value={s.viewings_month} icon="calendar" to="/admin/viewings" />
      </div>
      {s.open_reports > 0 && <Alert type="warn"><b>{s.open_reports}</b> listing report(s) from clients need review. <Link to="/admin/listings?reported=1">Review reports</Link></Alert>}

      <div className="card">
        <div className="card-title"><h2>Pending agent verifications</h2><Link to="/admin/agents" className="small">See all</Link></div>
        {data.pending.length === 0 ? <EmptyState icon="check" title="No agents waiting" text="New agent registrations appear here." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Agent</th><th>Agency</th><th>Licence no.</th><th>Registered</th><th>Decision</th></tr></thead>
            <tbody>{data.pending.map((a) => (
              <tr key={a.user_id}><td><b>{a.full_name}</b><div className="xsmall muted">{a.email}</div></td><td>{a.agency_name || 'Independent'}</td><td><code>{a.licence_no}</code></td><td>{fmtDate(a.created_at)}</td>
                <td><div className="req-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => act.withConfirm('approve_agent', { user_id: a.user_id }, { title: 'Approve agent?', text: `Approve ${a.full_name} (licence ${a.licence_no})? Confirm you have checked the licence with EARB.`, confirmText: 'Approve', tone: 'primary' })}>Approve</button>
                  <button className="btn btn-danger btn-sm" onClick={() => act.withReason('reject_agent', { user_id: a.user_id }, `Reject ${a.full_name}`)}>Reject</button>
                </div></td></tr>))}</tbody>
          </table></div>
        )}
      </div>

      <div className="grid-2 mt-6">
        <div className="card mt-0">
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Moderate</h2>
          <form onSubmit={search} role="search">
            <label htmlFor="mq" className="small bold">Find a user or listing</label>
            <div className="input-group mt-2"><input id="mq" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or listing title" />
              <button className="btn btn-primary btn-icon" aria-label="Search"><Icon name="search" /></button></div>
          </form>
          {found && found.users.length + found.listings.length === 0 && <p className="small muted mt-4">Nothing matches "{q}".</p>}
          {found && found.users.map((u) => (
            <div className="quote row-between mt-2" key={`u${u.user_id}`}><div><b>{u.full_name}</b><div className="xsmall muted">{roleLabel(u.role)} · {label(u.account_status)}</div></div>
              {canManage(u) && (u.account_status === 'active'
                ? <button className="btn btn-danger btn-sm" onClick={() => act.withReason('suspend_user', { user_id: u.user_id }, `Suspend ${u.full_name}`)}>Suspend user</button>
                : <button className="btn btn-outline btn-sm" onClick={() => act.run('reinstate_user', { user_id: u.user_id }).then(() => setFound(null)).catch(() => {})}>Reinstate</button>)}
            </div>
          ))}
          {found && found.listings.map((p) => (
            <div className="quote row-between mt-2" key={`p${p.property_id}`}><div><Link to={`/properties/${p.property_id}`} className="bold">{p.title}</Link><div className="xsmall muted">{p.location} · <StatusBadge status={p.listing_status} />{p.reports > 0 && <span style={{ color: 'var(--danger)' }}> · {p.reports} report(s)</span>}</div></div>
              {p.listing_status === 'removed'
                ? <button className="btn btn-outline btn-sm" onClick={() => act.run('restore_listing', { property_id: p.property_id }).catch(() => {})}>Restore</button>
                : <button className="btn btn-danger btn-sm" onClick={() => act.withReason('remove_listing', { property_id: p.property_id }, `Remove ${p.title}`)}>Remove listing</button>}
            </div>
          ))}
          {!found && <p className="small muted mt-4 mb-0">Suspended users cannot log in. Removed listings disappear from search and their viewings are cancelled. Each action needs a reason, which is saved to the activity log.</p>}
        </div>
        <form className="card mt-0" onSubmit={(e) => { e.preventDefault(); navigate(`/admin/reports?type=${rep.type}&from=${rep.from}&to=${rep.to}`); }}>
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Generate report</h2>
          <div className="field"><label htmlFor="rtype">Report type</label>
            <select id="rtype" className="select" value={rep.type} onChange={(e) => setRep({ ...rep, type: e.target.value })}>
              <option value="listings">Listings by status</option><option value="viewings">Viewings</option><option value="users">User registrations</option>
              <option value="agents">Agent performance</option><option value="payments">Payments</option><option value="audit">Activity log</option></select></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="rfrom">From</label><input id="rfrom" type="date" className="input" value={rep.from} onChange={(e) => setRep({ ...rep, from: e.target.value })} /></div>
            <div className="field"><label htmlFor="rto">To</label><input id="rto" type="date" className="input" value={rep.to} onChange={(e) => setRep({ ...rep, to: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary btn-block">Open report builder</button>
          <p className="small muted mt-4 mb-0">Featuring revenue this month: <b>{money(s.revenue_month)}</b></p>
        </form>
      </div>

      <div className="grid-2 mt-6">
        <div className="card mt-0"><h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Viewings booked (last 6 months)</h2><BarChart data={data.viewingsByMonth} label="Viewings booked per month" /></div>
        <div className="card mt-0"><h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Listings by type</h2><StackedBars data={data.listingsByType} label="Listings by property type" /></div>
      </div>

      <div className="card mt-6">
        <div className="card-title"><h2>Recent activity</h2><Link to="/admin/audit" className="small">Full activity log</Link></div>
        <ul className="timeline">{data.recent.map((l) => (
          <li key={l.log_id}><div><b>{l.full_name || 'Guest'}</b> · {label(l.action)}{l.details && <span className="muted">: {l.details.slice(0, 90)}</span>}<div className="xsmall muted">{fmtDateTime(l.created_at)} · {l.ip_address}</div></div></li>
        ))}</ul>
      </div>
      {act.dialogs}
    </>
  );
}
