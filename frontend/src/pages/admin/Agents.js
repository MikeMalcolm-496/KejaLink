/** Admin: agent verification queue and history (FR1). */
import { useState } from 'react';
import { EmptyState, Loading, LoadError } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import useAdminAction from './useAdminAction';
import { fmtDate } from '../../utils/format';

export default function Agents() {
  useTitle('Agent verification');
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi('/admin/agents', { tab, q: search });
  const act = useAdminAction(reload);
  return (
    <>
      <div className="page-head"><div><h1>Agent verification</h1><p>Check each licence number with the Estate Agents Registration Board (EARB) before approving. Only approved agents can post listings.</p></div></div>
      <div className="row-between mb-4">
        <div className="tabs mb-0">{['pending', 'approved', 'rejected'].map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} <span className="n">{data && data.counts[t] ? data.counts[t] : 0}</span></button>)}</div>
        <form className="input-group" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}><label htmlFor="aq" className="sr-only">Search agents</label><input id="aq" className="input" placeholder="Name, licence or agency" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-primary">Search</button></form>
      </div>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="id" title={`No ${tab} agents`} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Agent</th><th>Agency</th><th>Licence no.</th><th>Registered</th>{tab !== 'pending' && <th>Reviewed</th>}<th className="num">Listings</th><th>Actions</th></tr></thead>
            <tbody>{data.items.map((a) => (
              <tr key={a.user_id}>
                <td><b>{a.full_name}</b><div className="xsmall muted">{a.email} · {a.phone}</div></td>
                <td>{a.agency_name || 'Independent'}</td><td><code>{a.licence_no}</code></td><td className="small">{fmtDate(a.created_at)}</td>
                {tab !== 'pending' && <td className="small">{fmtDate(a.verified_at)} by {a.verifier || '-'}{a.rejection_reason && <div style={{ color: 'var(--danger)' }}>{a.rejection_reason}</div>}</td>}
                <td className="num">{a.listings}</td>
                <td><div className="req-actions">
                  {tab !== 'approved' && <button className="btn btn-primary btn-sm" onClick={() => act.withConfirm('approve_agent', { user_id: a.user_id }, { title: 'Approve agent?', text: `Approve ${a.full_name} (licence ${a.licence_no})?`, confirmText: 'Approve', tone: 'primary' })}>Approve</button>}
                  {tab !== 'rejected' && <button className="btn btn-danger btn-sm" onClick={() => act.withReason('reject_agent', { user_id: a.user_id }, `${tab === 'approved' ? 'Revoke approval for' : 'Reject'} ${a.full_name}`)}>{tab === 'approved' ? 'Revoke' : 'Reject'}</button>}
                </div></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
      {act.dialogs}
    </>
  );
}
