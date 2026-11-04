/** Admin: browse, search, sort and manage all accounts. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading, LoadError, Modal, Pagination, SortHeader, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import useAdminAction from './useAdminAction';
import { fmtDate, roleLabel, timeAgo } from '../../utils/format';

export default function Users() {
  useTitle('Users');
  const { user: me } = useAuth();
  const [f, setF] = useState({ q: '', role: '', status: '', sort: 'registered', dir: 'desc', page: 1 });
  const [q, setQ] = useState('');
  const [temp, setTemp] = useState(null);
  const { data, loading, error, reload } = useApi('/admin/users', f);
  // After a password reset, show the temporary password once so the admin can pass it on.
  const act = useAdminAction((r) => { reload(); if (r && r.tempPassword) setTemp(`${r.message} Temporary password: ${r.tempPassword}`); });
  const set = (c) => setF((x) => ({ ...x, page: 1, ...c }));
  const canManage = (u) => u.user_id !== me.user_id && (me.role === 'super_admin' || !['admin', 'super_admin'].includes(u.role));
  const sortProps = { sort: f.sort, dir: f.dir, onSort: (sort, dir) => set({ sort, dir }) };

  return (
    <>
      <div className="page-head"><div><h1>Users</h1><p>{data ? `${data.total} accounts` : ' '}</p></div><Link to="/admin/users/new" className="btn btn-primary"><Icon name="plus" />Register user</Link></div>
      <form className="card filters mb-6" onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <div className="field"><label htmlFor="uq">Search</label><input id="uq" className="input" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="urole">Role</label><select id="urole" className="select" value={f.role} onChange={(e) => set({ role: e.target.value })}><option value="">All roles</option>{['client', 'agent', 'admin', 'super_admin'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></div>
        <div className="field"><label htmlFor="ustatus">Status</label><select id="ustatus" className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
        <button className="btn btn-primary">Filter</button>
      </form>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="users" title="No users found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><SortHeader field="name" {...sortProps}>Name</SortHeader><SortHeader field="email" {...sortProps}>Contact</SortHeader><SortHeader field="role" {...sortProps}>Role</SortHeader>
              <SortHeader field="status" {...sortProps}>Status</SortHeader><SortHeader field="login" {...sortProps}>Last login</SortHeader><SortHeader field="registered" {...sortProps}>Registered</SortHeader><th>Actions</th></tr></thead>
            <tbody>{data.items.map((u) => (
              <tr key={u.user_id}>
                <td><b>{u.full_name}</b>{u.twofa_enabled && <span title="2FA on" style={{ color: 'var(--emerald)' }}> <Icon name="shield" size={14} label="2FA on" /></span>}
                  {u.locked_until && new Date(u.locked_until) > new Date() && <> <span className="badge tone-warn">Locked</span></>}</td>
                <td className="small">{u.email}<div className="muted">{u.phone}</div></td>
                <td>{roleLabel(u.role)}{u.role === 'agent' && <div><StatusBadge status={u.verification_status} /></div>}</td>
                <td><StatusBadge status={u.account_status} /></td>
                <td className="small">{u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}</td>
                <td className="small">{fmtDate(u.created_at)}</td>
                <td>{canManage(u) ? (
                  <div className="req-actions" style={{ flexWrap: 'nowrap' }}>
                    <Link to={`/admin/users/${u.user_id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${u.full_name}`}><Icon name="edit" size={15} /></Link>
                    <button className="btn btn-ghost btn-sm" title="Reset password" onClick={() => act.withConfirm('reset_password', { user_id: u.user_id }, { title: 'Reset password?', text: `Give ${u.full_name} a temporary password? It is shown once and e-mailed; they must change it at next login.`, confirmText: 'Reset password', tone: 'primary' }).then(() => {})}
                      aria-label={`Reset password for ${u.full_name}`}><Icon name="key" size={15} /></button>
                    {u.twofa_enabled && <button className="btn btn-ghost btn-sm" onClick={() => act.withConfirm('disable_2fa', { user_id: u.user_id }, { title: 'Turn off 2FA?', text: `Only do this after confirming ${u.full_name}'s identity.`, confirmText: 'Turn off 2FA' })}>2FA off</button>}
                    {u.account_status === 'active'
                      ? <button className="btn btn-danger btn-sm" onClick={() => act.withReason('suspend_user', { user_id: u.user_id }, `Suspend ${u.full_name}`)}>Suspend</button>
                      : <button className="btn btn-outline btn-sm" onClick={() => act.run('reinstate_user', { user_id: u.user_id }).catch(() => {})}>Reinstate</button>}
                    <button className="btn btn-danger btn-sm" aria-label={`Delete ${u.full_name}`} onClick={() => act.withConfirm('delete_user', { user_id: u.user_id }, { title: 'Delete account?', text: `Permanently delete ${u.full_name}? Their listings, viewings, inquiries and favourites will be deleted too. This cannot be undone.`, confirmText: 'Delete account' })}><Icon name="trash" size={15} /></button>
                  </div>) : u.user_id === me.user_id ? <span className="small muted">You</span> : null}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => setF({ ...f, page })} />}
      </div>
      {act.dialogs}
      {temp && <Modal title="Temporary password" onClose={() => setTemp(null)}><Alert type="success"><span className="temp-password">{temp}</span></Alert><p className="small muted mb-0">The user must choose a new password the first time they log in.</p></Modal>}
    </>
  );
}
