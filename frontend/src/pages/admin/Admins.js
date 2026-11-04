/** Super admin only: manage administrator accounts. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Loading, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import useAdminAction from './useAdminAction';
import { roleLabel, timeAgo } from '../../utils/format';

export default function Admins() {
  useTitle('Administrators');
  const { user: me } = useAuth();
  const { data, loading, reload } = useApi('/admin/admins');
  const act = useAdminAction(reload);
  const [promote, setPromote] = useState('');
  if (loading && !data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Administrators</h1><p>Only super admins see this page, create admins or remove admin rights.</p></div>
        <Link to="/admin/users/new?role=admin" className="btn btn-primary"><Icon name="shield" />Add administrator</Link></div>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>2FA</th><th className="num">Moderation actions</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>{data.admins.map((a) => (
            <tr key={a.user_id}><td className="bold">{a.full_name}</td><td className="small">{a.email}</td><td>{roleLabel(a.role)}</td><td><StatusBadge status={a.account_status} /></td>
              <td>{a.twofa_enabled ? 'On' : <span className="muted">Off</span>}</td><td className="num">{a.actions}</td><td className="small">{a.last_login_at ? timeAgo(a.last_login_at) : 'Never'}</td>
              <td>{a.user_id === me.user_id ? <span className="small muted">You</span> : a.role === 'admin' && (
                <div className="req-actions" style={{ flexWrap: 'nowrap' }}>
                  <button className="btn btn-danger btn-sm" onClick={() => act.withConfirm('change_role', { user_id: a.user_id, role: 'client' }, { title: 'Remove admin rights?', text: `${a.full_name} will become a normal client account.`, confirmText: 'Remove rights' })}>Remove admin rights</button>
                  {a.account_status === 'active'
                    ? <button className="btn btn-danger btn-sm" onClick={() => act.withReason('suspend_user', { user_id: a.user_id }, `Suspend ${a.full_name}`)}>Suspend</button>
                    : <button className="btn btn-outline btn-sm" onClick={() => act.run('reinstate_user', { user_id: a.user_id }).catch(() => {})}>Reinstate</button>}
                </div>)}</td></tr>))}</tbody>
        </table></div>
      </div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (promote) act.withConfirm('change_role', { user_id: Number(promote), role: 'admin' }, { title: 'Make admin?', text: 'Give this person full admin access?', confirmText: 'Make admin', tone: 'primary' }).then(() => setPromote('')); }}>
        <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Promote a client to admin</h2>
        <div className="filters"><div className="field"><label htmlFor="promote">Client account</label>
          <select id="promote" className="select" value={promote} onChange={(e) => setPromote(e.target.value)}><option value="">Choose…</option>{data.clients.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name} ({c.email})</option>)}</select></div>
          <button className="btn btn-primary" disabled={!promote}>Make admin</button></div>
      </form>
      {act.dialogs}
    </>
  );
}
